// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_EDU — light-theme "education" feed cards (1080 × 1350)
//  Same brand language as post-renderer.js (Anton headlines with red
//  phrases, PJS text, lens + Dubilook™), on warm paper instead of black.
//
//  Contract:
//    await window.DUBILOOK_EDU.init(src)
//    window.DUBILOOK_EDU.draw(ctx, card)
//
//  card.type = "law"       { headline, red[], body, ref, source }          — legal "Did you know?"
//            = "term"      { term, full?, definition, example?, source }   — term of the day
//            = "myth"      { myth, fact, ref?, source }                    — myth vs fact
//            = "number"    { number, unit?, label, body, source }          — number of the day
//            = "list-cover"{ title, red[], subtitle, of }                  — checklist carousel slide 1
//            = "list-item" { n, title, body, slide:{n, of} }               — one checklist step
//            = "list-cta"  { text, slide:{n, of} }                         — last slide
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const W = 1080, H = 1350, M = 80;
  const PAPER = "#f6f3ee", INK = "#141414", RED = "#e3141c", MUTED = "#6e6a64", RULE = "#d9d3ca", PANEL = "#ffffff";
  const A = {};

  const font = (w, s) => w + " " + s + "px PJS, -apple-system, system-ui, sans-serif";
  const heavy = (s) => "400 " + s + "px Anton, Impact, 'Arial Narrow', sans-serif";

  function spaced(ctx, text, x, y, sp, align) {
    const chars = [...String(text)];
    const total = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    ctx.textAlign = "left";
    chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; });
  }
  function wrap(ctx, text, maxW) {
    const out = []; let line = "";
    String(text || "").split(/\s+/).filter(Boolean).forEach((w) => {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }
  // wrap, then even out line lengths so the last line is not a widow
  function balanced(ctx, text, maxW) {
    let lines = wrap(ctx, text, maxW);
    if (lines.length < 2) return lines;
    for (let w = maxW; w > maxW * 0.55; w -= 10) {
      const t = wrap(ctx, text, w);
      if (t.length > lines.length) break;
      lines = t;
    }
    return lines;
  }
  function redMask(words, phrases) {
    const mask = words.map(() => false);
    const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9%.,]/g, "");
    (phrases || []).forEach((p) => {
      const pw = String(p).trim().split(/\s+/).map(norm);
      for (let i = 0; i + pw.length <= words.length; i++)
        if (pw.every((x, k) => norm(words[i + k]) === x)) for (let k = 0; k < pw.length; k++) mask[i + k] = true;
    });
    return mask;
  }

  // ── chrome ──────────────────────────────────────────────────
  function background(ctx) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    // faint red arcs in two corners — the dark theme's glowing arcs, quietened
    const arc = (cx, cy, r, a0, a1) => {
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(227,20,28,0)"); g.addColorStop(0.5, "rgba(227,20,28,0.55)"); g.addColorStop(1, "rgba(227,20,28,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    };
    arc(-60, -60, 360, Math.PI * 0.02, Math.PI * 0.48);
    arc(W + 60, H + 60, 300, Math.PI * 1.02, Math.PI * 1.48);
  }
  function brandRow(ctx, y) {
    ctx.textBaseline = "alphabetic";
    ctx.font = heavy(46);
    const word = "Dubilook", ww = ctx.measureText(word).width;
    const lw = A.lens ? 58 : 0, lh = A.lens ? A.lens.height * (lw / A.lens.width) : 0;
    let x = (W - (lw + (lw ? 16 : 0) + ww + 22)) / 2;
    if (A.lens) { ctx.drawImage(A.lens, x, y - lh + 8, lw, lh); x += lw + 16; }
    ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.fillText(word, x, y);
    ctx.font = font(600, 16); ctx.fillText("™", x + ww + 4, y - 28);
  }
  function slideTag(ctx, slide, y) {
    if (!slide) return;
    ctx.font = font(600, 22); ctx.fillStyle = MUTED; ctx.textBaseline = "alphabetic";
    spaced(ctx, slide.n + " / " + slide.of, W - M, y, 3, "right");
  }
  // red pill with white letters: "DID YOU KNOW? · LAW"
  function pill(ctx, text, y) {
    ctx.font = font(800, 24);
    const sp = 6, chars = [...text];
    const tw = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1);
    const pw = tw + 56, ph = 54, x = (W - pw) / 2;
    ctx.fillStyle = RED; roundRect(ctx, x, y - ph + 14, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic";
    spaced(ctx, text, W / 2, y - 5, sp, "center");
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panel(ctx, x, y, w, h) {
    ctx.save(); ctx.shadowColor = "rgba(40,30,20,0.10)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    ctx.fillStyle = PANEL; roundRect(ctx, x, y, w, h, 28); ctx.fill(); ctx.restore();
  }
  function footer(ctx, card) {
    const y = H - 70;
    ctx.fillStyle = RULE; ctx.fillRect(M, y - 74, W - 2 * M, 2);
    ctx.textBaseline = "alphabetic";
    ctx.font = font(500, 18); ctx.fillStyle = MUTED;
    spaced(ctx, "SOURCE", M, y - 30, 5, "left");
    ctx.font = font(800, 24); ctx.fillStyle = INK;
    spaced(ctx, String(card.source || "").toUpperCase(), M, y + 4, 2, "left");
    ctx.font = font(600, 22); ctx.fillStyle = MUTED;
    spaced(ctx, "SAVE  ·  SHARE  ·  @DUBILOOK", W - M, y + 4, 3, "right");
  }
  // Anton block, words in `red` phrases coloured red, auto-fit into [top, bottom]
  function bigText(ctx, text, red, top, bottom, maxSize, maxLines) {
    const maxW = W - 2 * M;
    text = String(text || "").trim().toUpperCase();
    const words = text.split(/\s+/), mask = redMask(words, red);
    let size = maxSize, lines;
    for (; size >= 50; size -= 2) {
      ctx.font = heavy(size); lines = balanced(ctx, text, maxW);
      if (lines.length <= maxLines && lines.length * size * 1.07 <= bottom - top) break;
    }
    const lh = size * 1.07;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let y = top + (bottom - top - lines.length * lh) / 2 + size * 0.9, wi = 0;
    lines.forEach((ln) => {
      const lw = ln.split(" "), sp = ctx.measureText(" ").width * 0.8;
      const total = lw.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp * (lw.length - 1);
      let x = (W - total) / 2;
      lw.forEach((wd) => {
        ctx.fillStyle = mask[wi] ? RED : INK; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = size * 0.02;
        ctx.strokeText(wd, x, y); ctx.fillText(wd, x, y); x += ctx.measureText(wd).width + sp; wi++;
      });
      y += lh;
    });
    return y - lh + size * 0.2;
  }
  function para(ctx, text, y, size, color, weight, maxW) {
    ctx.font = font(weight || 500, size); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const lines = balanced(ctx, text, maxW || W - 2 * M - 40), lh = size * 1.4;
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + i * lh));
    ctx.textAlign = "left";
    return y + (lines.length - 1) * lh;
  }
  function paraHeight(ctx, text, size, weight, maxW) {
    ctx.font = font(weight || 500, size);
    return balanced(ctx, text, maxW || W - 2 * M - 40).length * size * 1.4;
  }

  // ── card types ──────────────────────────────────────────────
  function drawLaw(ctx, c) {
    background(ctx); brandRow(ctx, 118);
    pill(ctx, "DID YOU KNOW?  ·  LAW", 220);
    const bodyH = paraHeight(ctx, c.body, 36) + (c.ref ? 120 : 0);
    const end = bigText(ctx, c.headline, c.red, 270, H - 230 - bodyH - 50, 150, 4);
    let y = para(ctx, c.body, end + 70, 36, "#3a3632");
    if (c.ref) {
      y += 70;
      ctx.fillStyle = RED; ctx.fillRect(W / 2 - 28, y - 30, 56, 4);
      para(ctx, c.ref, y + 16, 26, MUTED, 600);
    }
    footer(ctx, c);
  }

  function drawTerm(ctx, c) {
    background(ctx); brandRow(ctx, 118);
    pill(ctx, "TERM OF THE DAY", 220);
    // the term itself, huge
    const term = String(c.term).toUpperCase();
    let size = 260; ctx.font = heavy(size);
    while (ctx.measureText(term).width > W - 2 * M && size > 90) { size -= 6; ctx.font = heavy(size); }
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(term, W / 2, 300 + size * 0.9);
    let y = 300 + size * 0.9 + 64;
    if (c.full) { ctx.font = font(600, 30); ctx.fillStyle = RED; spaced(ctx, c.full.toUpperCase(), W / 2, y, 3, "center"); y += 40; }
    // definition panel
    const defH = paraHeight(ctx, c.definition, 36, 500, W - 2 * M - 120);
    const exH = c.example ? paraHeight(ctx, c.example, 28, 500, W - 2 * M - 120) + 110 : 0;
    const ph = defH + exH + 90;
    const py = Math.max(y + 20, (y + H - 170 - ph) / 2);
    panel(ctx, M, py, W - 2 * M, ph);
    ctx.fillStyle = RED; ctx.fillRect(M, py + 28, 8, ph - 56);
    let ty = para(ctx, c.definition, py + 70, 36, INK, 500, W - 2 * M - 120);
    if (c.example) {
      ty += 84;
      ctx.font = font(800, 20); ctx.fillStyle = MUTED; spaced(ctx, "EXAMPLE", W / 2, ty - 6, 5, "center");
      para(ctx, c.example, ty + 40, 28, "#4a4540", 500, W - 2 * M - 120);
    }
    footer(ctx, c);
  }

  function drawMyth(ctx, c) {
    background(ctx); brandRow(ctx, 118);
    pill(ctx, "MYTH  VS  FACT", 220);
    const x = M, w = W - 2 * M, gap = 40;
    const mythH = paraHeight(ctx, c.myth, 40, 600, w - 120) + 130;
    const factH = paraHeight(ctx, c.fact, 38, 600, w - 120) + (c.ref ? 100 : 0) + 160;
    const top = Math.max(290, (290 + H - 190 - mythH - gap - factH) / 2);
    // myth: muted, struck through
    panel(ctx, x, top, w, mythH);
    ctx.font = heavy(44); ctx.fillStyle = MUTED; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("✕  MYTH", x + 50, top + 76);
    ctx.font = font(600, 40); ctx.fillStyle = "#8f8981"; ctx.textAlign = "center";
    const ml = balanced(ctx, c.myth, w - 120);
    ml.forEach((ln, i) => {
      const yy = top + 140 + i * 56; ctx.fillText(ln, W / 2, yy);
      const lw = ctx.measureText(ln).width; ctx.fillStyle = RED; ctx.fillRect(W / 2 - lw / 2, yy - 14, lw, 3); ctx.fillStyle = "#8f8981";
    });
    // fact: ink on white with red edge
    const fy = top + mythH + gap;
    panel(ctx, x, fy, w, factH);
    ctx.fillStyle = RED; ctx.fillRect(x, fy + 28, 8, factH - 56);
    ctx.font = heavy(44); ctx.fillStyle = RED; ctx.textAlign = "left";
    ctx.fillText("✓  FACT", x + 50, fy + 76);
    let y = para(ctx, c.fact, fy + 150, 38, INK, 600, w - 120);
    if (c.ref) para(ctx, c.ref, y + 80, 24, MUTED, 600, w - 120);
    footer(ctx, c);
  }

  function drawNumber(ctx, c) {
    background(ctx); brandRow(ctx, 118);
    pill(ctx, "NUMBER OF THE DAY", 220);
    const num = String(c.number);
    // a long body (4 lines) needs room above the footer rule: smaller number
    let size = String(c.body || "").length > 120 ? 370 : 420; ctx.font = heavy(size);
    while (ctx.measureText(num).width > W - 2 * M - 40 && size > 140) { size -= 10; ctx.font = heavy(size); }
    ctx.fillStyle = RED; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    // Place by the real ink box: a comma or "," tail hangs below the baseline and ran into the unit line (2026-10-04)
    const mt = ctx.measureText(num);
    const asc = mt.actualBoundingBoxAscent || size * 0.92, desc = Math.max(0, mt.actualBoundingBoxDescent || 0);
    const ny = 300 + asc;
    ctx.fillText(num, W / 2, ny);
    let y = ny + desc + 18;
    if (c.unit) { ctx.font = font(800, 30); ctx.fillStyle = INK; spaced(ctx, c.unit.toUpperCase(), W / 2, y + 30, 6, "center"); y += 50; }
    const end = bigText(ctx, c.label, c.red, y + 20, y + 200, 84, 2);
    para(ctx, c.body, end + 70, 34, "#3a3632");
    footer(ctx, c);
  }

  function drawListCover(ctx, c) {
    background(ctx); brandRow(ctx, 118);
    if (c.of) slideTag(ctx, { n: 1, of: c.of }, 116);
    pill(ctx, "CHECKLIST", 220);
    const end = bigText(ctx, c.title, c.red, 300, 900, 170, 4);
    if (c.subtitle) para(ctx, c.subtitle, end + 80, 36, "#3a3632");
    ctx.font = font(800, 26); ctx.fillStyle = INK;
    spaced(ctx, "SWIPE  →", W / 2, H - 110, 6, "center");
  }

  function drawListItem(ctx, c) {
    background(ctx); brandRow(ctx, 118); slideTag(ctx, c.slide, 116);
    // big step number + tick
    ctx.font = heavy(300); ctx.fillStyle = RED; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(String(c.n).padStart(2, "0"), W / 2, 520);
    const end = bigText(ctx, c.title, c.red, 560, 820, 110, 3);
    const ph = paraHeight(ctx, c.body, 34, 500, W - 2 * M - 120) + 90;
    const py = Math.max(end + 50, 860);
    panel(ctx, M, py, W - 2 * M, ph);
    para(ctx, c.body, py + 68, 34, "#3a3632", 500, W - 2 * M - 120);
    ctx.font = font(600, 22); ctx.fillStyle = MUTED;
    spaced(ctx, "SAVE THIS CHECKLIST", W / 2, H - 80, 5, "center");
  }

  function drawListCta(ctx, c) {
    background(ctx); brandRow(ctx, 118); slideTag(ctx, c.slide, 116);
    const end = bigText(ctx, c.text || "Send this to someone renting in Dubai", c.red || ["Send"], 300, 860, 160, 4);
    para(ctx, "Follow @dubilook for daily Dubai property news", end + 90, 32, "#3a3632", 600);
    para(ctx, "Join the community on Telegram · link in bio", end + 142, 28, MUTED);
    if (A.logoInk) { const w = 230, h = A.logoInk.height * (w / A.logoInk.width); ctx.drawImage(A.logoInk, (W - w) / 2, H - 70 - h, w, h); }
  }

  // ── assets ──────────────────────────────────────────────────
  function loadImg(url) {
    return new Promise((res) => { if (!url) return res(null);
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  }
  async function loadFonts(src) {
    if (!window.FontFace || !document.fonts) return;
    const at = (n) => (src && src[n]) ? src[n] : "assets/" + n + ".woff2";
    await Promise.all([["PJS", "500", "pjs-500"], ["PJS", "600", "pjs-600"], ["PJS", "800", "pjs-800"], ["Anton", "400", "anton"]]
      .map(([fam, w, n]) => new FontFace(fam, "url(" + at(n) + ")", { weight: w }).load().then((ff) => document.fonts.add(ff)).catch(() => {})));
    try { await document.fonts.ready; } catch (e) {}
  }

  const DRAW = { law: drawLaw, term: drawTerm, myth: drawMyth, number: drawNumber,
    "list-cover": drawListCover, "list-item": drawListItem, "list-cta": drawListCta };

  window.DUBILOOK_EDU = {
    W, H,
    async init(src) {
      await loadFonts(src);
      A.lens = await loadImg((src && src["logo-lens"]) || "assets/logo-lens.png");
      // the original colour logo (black word, red lens) — same file as dubilook.com/site-assets/dubilook-logo.png
      A.logoInk = await loadImg((src && src["logo-dark"]) || "assets/logo-dark.png");
      return { lens: !!A.lens, logo: !!A.logoInk };
    },
    draw(ctx, card) {
      const fn = DRAW[card.type];
      if (!fn) throw new Error("edu: unknown card type " + card.type);
      try { ctx.direction = "ltr"; } catch (e) {}
      ctx.save(); fn(ctx, card); ctx.restore();
    }
  };
})();
