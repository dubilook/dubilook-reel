// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_STORIES — daily news story cards (1080 × 1920)
//  STORIES_RENDERER_V4
//
//  Contract:
//    await window.DUBILOOK_STORIES.init(src)        src optional {name: dataURI}
//    window.DUBILOOK_STORIES.draw(ctx, card, meta)
//
//  card.type  = "divider" | "news" | "fact"
//  news/fact: { headline, red:[phrases], summary, source, date, category }
//  divider:   { date: "2026-09-21", count: 12 }
// ═══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  const W = 1080, H = 1920;
  const SAFE_TOP = 250, SAFE_BOTTOM = 340;   // Instagram story UI zones
  const M = 80;                              // side margin
  const RED = "#e3141c";
  const WHITE = "#ffffff";
  const GREY = "#b9b9b9";
  const DIM = "#7c7c7c";

  const DISCLAIMER = "Dubilook\u2122 is the narrator only. Information is attributed to the cited source and is not independently claimed by Dubilook\u2122.";
  const TAGLINE = ["REAL INSIGHTS", "A BRIGHTER VIEW"];

  const A = {};

  const font = (w, s) => w + " " + s + "px PJS, -apple-system, system-ui, sans-serif";
  const heavy = (s) => "400 " + s + "px Anton, Impact, 'Arial Narrow', sans-serif";

  // ── helpers ──────────────────────────────────────────────────
  function spaced(ctx, text, x, y, sp, align) {
    // letter-spaced text; align: left | center | right
    const chars = [...text];
    let w = 0;
    chars.forEach((c, i) => { w += ctx.measureText(c).width + (i < chars.length - 1 ? sp : 0); });
    let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    const prev = ctx.textAlign;
    ctx.textAlign = "left";
    chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; });
    ctx.textAlign = prev;
    return w;
  }

  function wrap(ctx, text, maxW) {
    const words = String(text || "").trim().split(/\s+/);
    const lines = [];
    let cur = "";
    words.forEach((wd) => {
      const t = cur ? cur + " " + wd : wd;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; }
      else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // balanced wrap: same line count, narrowest width → no lonely last word
  function balanced(ctx, text, maxW) {
    const base = wrap(ctx, text, maxW);
    if (base.length < 2) return base;
    let lo = maxW * 0.45, hi = maxW;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (wrap(ctx, text, mid).length > base.length) lo = mid; else hi = mid;
    }
    return wrap(ctx, text, hi);
  }

  // which words of the headline are red
  function redMask(words, phrases) {
    const mask = words.map(() => false);
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%.]/g, "");
    (phrases || []).forEach((ph) => {
      const pw = String(ph).trim().split(/\s+/).map(norm).filter(Boolean);
      if (!pw.length) return;
      const nw = words.map(norm);
      for (let i = 0; i + pw.length <= nw.length; i++) {
        let ok = true;
        for (let j = 0; j < pw.length; j++) if (nw[i + j] !== pw[j]) { ok = false; break; }
        if (ok) for (let j = 0; j < pw.length; j++) mask[i + j] = true;
      }
    });
    return mask;
  }

  function fmtDate(d) {
    if (!d) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) return String(d).toUpperCase();
    const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][+m[2] - 1];
    return (+m[3]) + " " + mon + " " + m[1];
  }

  // Gmail may wrap names in a redirect; keep the bare name
  function srcName(s) {
    s = String(s || "").trim();
    const q = /[?&]q=([^&]+)/.exec(s);
    if (/google\.[a-z.]+\/url/i.test(s) && q) s = decodeURIComponent(q[1]);
    if (/^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+/.test(s)) {
      s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
    }
    return s.toUpperCase();
  }

  // ── fixed layers ─────────────────────────────────────────────
  function background(ctx, light) {
    ctx.fillStyle = light ? "#ffffff" : "#000";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, H * 0.62);
    g.addColorStop(0, light ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.045)");
    g.addColorStop(1, light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Glowing arc, drawn with radial gradients (no shadowBlur → no banding
  // or pixelation). The light profile falls off smoothly on both sides of
  // the line, a wide soft spill lights the black surface, and both ends
  // fade out. Rendered once into an offscreen layer and cached.
  let arcLayer = null, arcLayerLight = null;

  function glowArc(g, cx, cy, r, a0, a1, light) {
    const layer = document.createElement("canvas");
    layer.width = W; layer.height = H;
    const c = layer.getContext("2d");

    const ring = (inner, outer, stops) => {
      const rg = c.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, outer);
      stops.forEach(([t, col]) => rg.addColorStop(t, col));
      c.fillStyle = rg;
      c.beginPath();
      c.arc(cx, cy, outer, a0 - 0.25, a1 + 0.25);
      c.arc(cx, cy, Math.max(0, inner), a1 + 0.25, a0 - 0.25, true);
      c.closePath();
      c.fill();
    };
    // profile: position of the line inside [inner, outer] is 0.5
    const prof = (w, peak) => {
      const st = [];
      for (let k = 0; k <= 20; k++) {
        const t = k / 20, d = Math.abs(t - 0.5) * 2;          // 0 at line, 1 at edge
        const a = peak * Math.pow(1 - d, 2.4);
        st.push([t, "rgba(255,24,36," + a.toFixed(4) + ")"]);
      }
      return st;
    };
    ring(r - 260, r + 260, prof(260, light ? 0.10 : 0.24));   // broad spill on the surface
    ring(r - 90,  r + 90,  prof(90,  light ? 0.30 : 0.55));   // glow
    ring(r - 26,  r + 26,  prof(26,  0.85));                  // tight bloom

    // bright core
    c.lineCap = "round";
    c.lineWidth = 5;
    c.strokeStyle = "rgba(255,40,50,1)";
    c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke();
    c.lineWidth = 1.8;
    c.strokeStyle = light ? "rgba(255,120,120,0.9)" : "rgba(255,190,190,0.8)";
    c.beginPath(); c.arc(cx, cy, r, a0 + 0.40, a1 - 0.40); c.stroke();

    // fade both ends along the arc
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const m = c.createLinearGradient(x0, y0, x1, y1);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(0.28, "rgba(0,0,0,1)");
    m.addColorStop(0.72, "rgba(0,0,0,1)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-in";
    c.fillStyle = m;
    c.fillRect(0, 0, W, H);

    g.drawImage(layer, 0, 0);
  }

  function buildArcs(light) {
    const lay = document.createElement("canvas");
    lay.width = W; lay.height = H;
    const g = lay.getContext("2d");
    glowArc(g, -80, -80, 470, Math.PI * 0.02, Math.PI * 0.48, light);          // top-left
    glowArc(g, W + 80, H + 80, 380, Math.PI * 1.02, Math.PI * 1.48, light);    // bottom-right
    return lay;
  }

  function arcs(ctx, light) {
    if (light) { arcLayerLight = arcLayerLight || buildArcs(true); ctx.drawImage(arcLayerLight, 0, 0); return; }
    arcLayer = arcLayer || buildArcs(false);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";    // behaves like light on black
    ctx.drawImage(arcLayer, 0, 0);
    ctx.restore();
  }

  // stacked brand: lens mark, wordmark, two-line tagline
  function brand(ctx, y, light) {
    let yy = y;
    if (A.lens) {
      const w = 124, h = A.lens.height * (w / A.lens.width);
      ctx.drawImage(A.lens, (W - w) / 2, yy, w, h);
      yy += h + 62;
    }
    ctx.textBaseline = "alphabetic";
    ctx.font = heavy(76);
    ctx.fillStyle = light ? "#0b0b0b" : WHITE;
    ctx.textAlign = "center";
    ctx.fillText("Dubilook", W / 2 - 14, yy);
    const ww = ctx.measureText("Dubilook").width;
    ctx.font = font(600, 22);
    ctx.fillText("\u2122", W / 2 - 14 + ww / 2 + 16, yy - 44);
    ctx.textAlign = "left";

    ctx.font = font(500, 20);
    ctx.fillStyle = light ? "#6d6d6d" : "#9a9a9a";
    yy += 44;
    spaced(ctx, TAGLINE[0], W / 2, yy, 6, "center");
    yy += 30;
    spaced(ctx, TAGLINE[1], W / 2, yy, 6, "center");
    return yy;
  }

  function footer(ctx, card) {
    const yBase = H - SAFE_BOTTOM - 120;   // full logo sits below, on the safe line
    ctx.textBaseline = "alphabetic";

    // left: SOURCE / name / short red rule / date
    ctx.font = font(500, 20);
    ctx.fillStyle = "#8a8a8a";
    spaced(ctx, "SOURCE", M, yBase - 92, 5, "left");
    ctx.font = font(800, 27);
    ctx.fillStyle = WHITE;
    spaced(ctx, srcName(card.source), M, yBase - 52, 3, "left");
    ctx.fillStyle = RED;
    ctx.fillRect(M, yBase - 32, 64, 5);
    ctx.font = font(500, 20);
    ctx.fillStyle = "#8a8a8a";
    spaced(ctx, fmtDate(card.date), M, yBase, 3, "left");

    // right: disclaimer block, left-aligned inside the right column
    ctx.font = font(500, 22);
    ctx.fillStyle = "#d2d2d2";
    const colX = 610, colW = W - M - colX;
    const lines = wrap(ctx, DISCLAIMER, colW);
    const lh = 31;
    lines.forEach((ln, i) => ctx.fillText(ln, colX, yBase - (lines.length - 1 - i) * lh));

    // full wordmark logo, small, centred at the bottom
    if (A.logo) {
      const w = 230, h = A.logo.height * (w / A.logo.width);
      ctx.drawImage(A.logo, (W - w) / 2, H - SAFE_BOTTOM - h + 6, w, h);
    }
  }

  function kicker(ctx, text, y) {
    ctx.font = font(800, 26);
    ctx.fillStyle = RED;
    ctx.textBaseline = "alphabetic";
    spaced(ctx, text, W / 2, y, 7, "center");
  }

  // headline block, centred in [top, bottom]; returns its bottom y
  function headline(ctx, text, red, top, bottom, summary) {
    const maxW = W - 2 * 72;
    text = String(text || "").trim().toUpperCase();
    const words = text.split(/\s+/);
    const mask = redMask(words, red);

    let size = 300, lines, lh, sumLines = [], sumSize = 40, sumLH, blockH;
    for (; size >= 58; size -= 2) {
      ctx.font = heavy(size);
      lines = balanced(ctx, text, maxW);
      lh = size * 1.07;
      ctx.font = font(500, sumSize);
      sumLines = summary ? balanced(ctx, summary, maxW - 60) : [];
      sumLH = sumSize * 1.38;
      blockH = lines.length * lh + (sumLines.length ? 56 + sumLines.length * sumLH : 0);
      if (lines.length <= 5 && blockH <= bottom - top) break;
    }

    let y = top + (bottom - top - blockH) / 2 + size * 0.95;
    ctx.textBaseline = "alphabetic";
    let wi = 0;
    lines.forEach((ln) => {
      ctx.font = heavy(size);
      const lw = ln.split(" ");
      const sp = ctx.measureText(" ").width * 0.8;
      const total = lw.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp * (lw.length - 1);
      let x = (W - total) / 2;
      lw.forEach((wd) => {
        ctx.fillStyle = mask[wi] ? RED : WHITE;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = size * 0.028;           // thickens Anton a notch
        ctx.lineJoin = "miter";
        ctx.strokeText(wd, x, y);
        ctx.fillText(wd, x, y);
        x += ctx.measureText(wd).width + sp;
        wi++;
      });
      y += lh;
    });
    y += -lh + 56 + sumSize * 1.1;

    if (sumLines.length) {
      ctx.font = font(500, sumSize);
      ctx.fillStyle = GREY;
      ctx.textAlign = "center";
      sumLines.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += sumLH; });
      ctx.textAlign = "left";
    }
    return y;
  }

  // ── card types ───────────────────────────────────────────────
  function drawStory(ctx, card, meta) {
    background(ctx, false);
    arcs(ctx);
    const bBottom = brand(ctx, 150, false);

    const isFact = card.type === "fact";
    const label = isFact ? "DID YOU KNOW?"
      : (card.category === "property" ? "UAE PROPERTY NEWS" : "UAE NEWS");
    const kY = bBottom + 110;
    kicker(ctx, label, kY);

    headline(ctx, card.headline, card.red, kY + 36, H - SAFE_BOTTOM - 290, card.summary);
    footer(ctx, card);
  }

  // divider is WHITE so it stands out in the gallery between days
  function drawDivider(ctx, card) {
    background(ctx, true);
    arcs(ctx, true);
    brand(ctx, 150, true);

    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(card.date || "");
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date();
    const day = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][d.getUTCDay()];
    const mon = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"][d.getUTCMonth()];

    const cy = H * 0.52;
    ctx.textBaseline = "alphabetic";
    ctx.font = font(800, 34);
    ctx.fillStyle = RED;
    spaced(ctx, day, W / 2, cy - 330, 12, "center");

    ctx.font = heavy(430);
    ctx.fillStyle = "#0b0b0b";
    ctx.textAlign = "center";
    ctx.fillText(String(d.getUTCDate()), W / 2, cy + 90);

    ctx.font = heavy(70);
    ctx.fillText(mon, W / 2, cy + 200);
    ctx.fillStyle = RED;
    ctx.fillText(String(d.getUTCFullYear()), W / 2, cy + 280);
    ctx.textAlign = "left";

    ctx.fillStyle = RED;
    ctx.fillRect(W / 2 - 40, cy + 330, 80, 6);

    ctx.font = font(600, 26);
    ctx.fillStyle = "#6d6d6d";
    spaced(ctx, "TODAY'S NEWS & PROPERTY FACTS", W / 2, cy + 400, 4, "center");
  }

  // ── loading ──────────────────────────────────────────────────
  function loadImg(url) {
    return new Promise((res) => {
      if (!url) return res(null);
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    });
  }

  async function loadFonts(src) {
    if (!window.FontFace || !document.fonts) return;
    const at = (n) => (src && src[n]) ? src[n] : "assets/" + n + ".woff2";
    await Promise.all([["PJS", "500", "pjs-500"], ["PJS", "600", "pjs-600"], ["PJS", "800", "pjs-800"],
                       ["Anton", "400", "anton"]].map(([fam, w, n]) => {
      const f = new FontFace(fam, "url(" + at(n) + ")", { weight: w });
      return f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
    }));
    try { await document.fonts.ready; } catch (e) {}
  }

  window.DUBILOOK_STORIES = {
    W, H,
    async init(src) {
      await loadFonts(src);
      A.lens = await loadImg((src && src["logo-lens"]) || "assets/logo-lens.png");
      A.logo = await loadImg((src && src["logo-light"]) || "assets/logo-light.png");
      const ck = (f) => { try { return document.fonts.check(f); } catch (e) { return false; } };
      window.__storiesOk = { lens: !!A.lens, logo: !!A.logo, pjs: ck("800 76px PJS"), anton: ck("400 76px Anton") };
      return window.__storiesOk;
    },
    draw(ctx, card, meta) {
      try { ctx.direction = "ltr"; } catch (e) {}
      ctx.save();
      if (card && card.type === "divider") drawDivider(ctx, card);
      else drawStory(ctx, card || {}, meta);
      ctx.restore();
    }
  };
})();
