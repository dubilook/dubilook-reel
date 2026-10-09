// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_POSTS — 4:5 feed cards (1080 × 1350) in the stories look
//  Same visual language as stories-renderer.js (black, red glowing arcs,
//  Anton headlines with red phrases, PJS text), re-laid-out for the feed.
//
//  Contract:
//    await window.DUBILOOK_POSTS.init(src)
//    window.DUBILOOK_POSTS.draw(ctx, card)
//
//  card.type = "news" | "fact"            — single post or carousel slide
//              { headline, red[], summary, angle?, source, date, category,
//                slide?: {n, of} }
//            = "cover"                    — carousel slide 1
//              { title, date, hooks:[3], of }
//            = "cta"                      — carousel last slide
//              { text, slide:{n, of} }
//            = "story-cover"              — 9:16 story that announces a new post
//              { title, hooks:[..], label }
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const W = 1080;
  let H = 1350;
  const M = 80;
  const RED = "#e3141c", WHITE = "#ffffff", GREY = "#b9b9b9";
  const DISCLAIMER = "Dubilook™ is the narrator only. Information is attributed to the cited source and is not independently claimed by Dubilook™.";
  const A = {};

  const font = (w, s) => w + " " + s + "px PJS, -apple-system, system-ui, sans-serif";
  const heavy = (s) => "400 " + s + "px Anton, Impact, 'Arial Narrow', sans-serif";
  // Headline fonts, tried in order (owner 2026-10-09): Anton → Barlow Condensed → airy Anton (owner's pick 2026-10-09).
  // A font is used when the headline fits in it at ≥ min px; a long headline Anton would squeeze moves on.
  // lh = line height (× size), stroke = outline weight (× size) that fattens Anton.
  const HEAD_FONTS = [
    { css: (s) => "400 " + s + "px Anton, Impact, 'Arial Narrow', sans-serif", lh: 1.07, stroke: 0.028, space: 0.8, min: 124 },
    { css: (s) => "800 " + s + "px 'Barlow Condensed', 'Arial Narrow', sans-serif", lh: 1.06, stroke: 0, space: 1, min: 96 },
    { css: (s) => "400 " + s + "px Anton, Impact, 'Arial Narrow', sans-serif", lh: 1.16, stroke: 0, space: 0.9, min: 0 },   // "airy" Anton: more line gap, no outline
  ];

  function spaced(ctx, text, x, y, sp, align) {
    const chars = [...String(text)];
    let w = 0;
    chars.forEach((c, i) => { w += ctx.measureText(c).width + (i < chars.length - 1 ? sp : 0); });
    let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    const prev = ctx.textAlign; ctx.textAlign = "left";
    chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; });
    ctx.textAlign = prev;
    return w;
  }
  function wrap(ctx, text, maxW) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    const lines = []; let cur = "";
    words.forEach((wd) => { const t = cur ? cur + " " + wd : wd;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function balanced(ctx, text, maxW) {
    const base = wrap(ctx, text, maxW);
    if (base.length < 2) return base;
    let lo = maxW * 0.45, hi = maxW;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2;
      if (wrap(ctx, text, mid).length > base.length) lo = mid; else hi = mid; }
    return wrap(ctx, text, hi);
  }
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
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    if (!m) return String(d || "").toUpperCase();
    const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][+m[2] - 1];
    return (+m[3]) + " " + mon + " " + m[1];
  }

  // ── background: black + two glowing red arcs (same recipe as stories) ──
  const arcCache = {};
  function glowArc(g, cx, cy, r, a0, a1) {
    const layer = document.createElement("canvas"); layer.width = W; layer.height = H;
    const c = layer.getContext("2d");
    const ring = (inner, outer, stops) => {
      const rg = c.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, outer);
      stops.forEach(([t, col]) => rg.addColorStop(t, col));
      c.fillStyle = rg; c.beginPath();
      c.arc(cx, cy, outer, a0 - 0.25, a1 + 0.25); c.arc(cx, cy, Math.max(0, inner), a1 + 0.25, a0 - 0.25, true);
      c.closePath(); c.fill();
    };
    const prof = (peak) => { const st = [];
      for (let k = 0; k <= 20; k++) { const t = k / 20, d = Math.abs(t - 0.5) * 2;
        st.push([t, "rgba(255,24,36," + (peak * Math.pow(1 - d, 2.4)).toFixed(4) + ")"]); }
      return st; };
    ring(r - 260, r + 260, prof(0.24)); ring(r - 90, r + 90, prof(0.55)); ring(r - 26, r + 26, prof(0.85));
    c.lineCap = "round"; c.lineWidth = 5; c.strokeStyle = "rgba(255,40,50,1)";
    c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke();
    c.lineWidth = 1.8; c.strokeStyle = "rgba(255,190,190,0.8)";
    c.beginPath(); c.arc(cx, cy, r, a0 + 0.40, a1 - 0.40); c.stroke();
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const m = c.createLinearGradient(x0, y0, x1, y1);
    m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(0.28, "rgba(0,0,0,1)");
    m.addColorStop(0.72, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-in"; c.fillStyle = m; c.fillRect(0, 0, W, H);
    g.drawImage(layer, 0, 0);
  }
  function background(ctx) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, H * 0.62);
    g.addColorStop(0, "rgba(255,255,255,0.045)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!arcCache[H]) {
      const lay = document.createElement("canvas"); lay.width = W; lay.height = H;
      const g2 = lay.getContext("2d");
      const k = H / 1920 * 0.85 + 0.15;
      glowArc(g2, -80, -80, 470 * k, Math.PI * 0.02, Math.PI * 0.48);
      glowArc(g2, W + 80, H + 80, 380 * k, Math.PI * 1.02, Math.PI * 1.48);
      arcCache[H] = lay;
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(arcCache[H], 0, 0); ctx.restore();
  }

  // ── optional photo (image bank): drawn under the text, cover-cropped, darkened so white text stays readable ──
  const PHOTOS = {};
  function coverDraw(ctx, img, x, y, w, h, focusY) {
    const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    const sx = (img.width - sw) / 2, sy = Math.min(img.height - sh, Math.max(0, (img.height - sh) * (focusY ?? 0.5)));
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  // mode "split": photo on the top part, fading into the black card · "full": whole card, dark veil
  function photoLayer(ctx, img, mode, splitH) {
    if (mode === "split") {
      coverDraw(ctx, img, 0, 0, W, splitH, 0.45);
      const g = ctx.createLinearGradient(0, 0, 0, splitH);
      g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.25, "rgba(0,0,0,0.15)");
      g.addColorStop(0.62, "rgba(0,0,0,0.35)"); g.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, splitH);
    } else {
      coverDraw(ctx, img, 0, 0, W, H, 0.5);
      ctx.fillStyle = "rgba(0,0,0,0.58)"; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      const t = ctx.createLinearGradient(0, 0, 0, 260);
      t.addColorStop(0, "rgba(0,0,0,0.6)"); t.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = t; ctx.fillRect(0, 0, W, 260);
    }
  }
  function photoCredit(ctx, card, dark) {
    if (!card.photo_credit) return;
    ctx.save(); ctx.font = font(500, 15); ctx.fillStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText(card.photo_credit, W - 24, H - 18); ctx.restore();
  }

  // ── adaptive photo card (owner 2026-10-09): bright photos may leave the black theme — the card takes its
  //    panel colour from the photo and puts the photo where it hurts the text least ──
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
  const rgb = (c, a) => a == null ? "rgb(" + c.join(",") + ")" : "rgba(" + c.join(",") + "," + a + ")";
  function analyse(img) {
    const w = 36, h = 45, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); coverDraw(g, img, 0, 0, w, h, 0.5);
    const d = g.getImageData(0, 0, w, h).data;
    const band = (y0, y1) => { let r = 0, gg = 0, b = 0, n = 0, e = 0, l2 = 0;
      for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
        const L = lum([d[i], d[i + 1], d[i + 2]]); l2 += L;
        if (x > 0) e += Math.abs(L - lum([d[i - 4], d[i - 3], d[i - 2]]));
        if (y > y0) e += Math.abs(L - lum([d[i - w * 4], d[i - w * 4 + 1], d[i - w * 4 + 2]])); }
      return { col: [r / n, gg / n, b / n].map(Math.round), lum: l2 / n, busy: e / n }; };
    return { top: band(0, Math.round(h * 0.4)), bottom: band(Math.round(h * 0.6), h), all: band(0, h) };
  }
  // photo on one side, a panel in the photo's own colour on the other; text in the panel
  function drawPhotoCard(ctx, card, img, label) {
    const a = analyse(img);
    // the calmer (less busy) side of the photo becomes the panel side
    const panelTop = card.photo_side === "bottom" ? true : card.photo_side === "top" ? false : a.top.busy < a.bottom.busy;
    const edge = panelTop ? a.top : a.bottom;
    const light = edge.lum > 0.58;
    const panel = light ? mix(edge.col, [255, 255, 255], 0.72) : mix(edge.col, [0, 0, 0], 0.72);
    const ink = light ? [17, 17, 17] : [255, 255, 255], sub = light ? "#3a3a3a" : "#d6d6d6", soft = light ? "#555" : "#9a9a9a";
    const photoH = Math.round(H * 0.44), fade = 200;
    ctx.fillStyle = rgb(panel); ctx.fillRect(0, 0, W, H);
    const py = panelTop ? H - photoH : 0;
    coverDraw(ctx, img, 0, py, W, photoH, panelTop ? 0.65 : 0.35);
    const g = panelTop ? ctx.createLinearGradient(0, py, 0, py + fade) : ctx.createLinearGradient(0, py + photoH, 0, py + photoH - fade);
    g.addColorStop(0, rgb(panel, 1)); g.addColorStop(1, rgb(panel, 0));
    ctx.fillStyle = g; ctx.fillRect(0, panelTop ? py : py + photoH - fade, W, fade);
    const T = { ink, sub, soft, light };
    if (panelTop) {
      brandRow(ctx, 118, T); slideTag(ctx, card.slide, 116);
      kicker(ctx, label, 206);
      // the angle line is left out on photo cards: the panel is shorter (it stays in the caption)
      headlineBlock(ctx, card.headline, card.red, 250, H - photoH - 10, { summary: card.summary }, T);
      // source + disclaimer over the bottom of the photo, on a dark scrim
      const sc = ctx.createLinearGradient(0, H - 260, 0, H); sc.addColorStop(0, "rgba(0,0,0,0)"); sc.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = sc; ctx.fillRect(0, H - 260, W, 260);
      footer(ctx, card, H - 50);
    } else {
      const top = photoH - 40;
      ctx.save(); const sc = ctx.createLinearGradient(0, 0, 0, 220); sc.addColorStop(0, "rgba(0,0,0,0.55)"); sc.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sc; ctx.fillRect(0, 0, W, 220); ctx.restore();
      brandRow(ctx, 118); slideTag(ctx, card.slide, 116);
      kicker(ctx, label, top + 30);
      headlineBlock(ctx, card.headline, card.red, top + 60, H - 220, { summary: card.summary }, T);
      footer(ctx, card, H - 70, T);
    }
    photoCredit(ctx, card, light && !panelTop);
    return { panelTop, light };
  }

  // "bar" — newsroom look: photo on top, a dark strip with the label + date, a red block carrying the headline,
  //         a black footer strip with the source and the disclaimer
  function drawBarCard(ctx, card, img, label) {
    const photoH = 690, stripH = 70, footH = 150, blockTop = photoH + stripH, blockBot = H - footH;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    coverDraw(ctx, img, 0, 0, W, photoH, 0.5);
    const sc = ctx.createLinearGradient(0, 0, 0, 200); sc.addColorStop(0, "rgba(0,0,0,0.6)"); sc.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sc; ctx.fillRect(0, 0, W, 200);
    brandRow(ctx, 96);
    ctx.fillStyle = "rgba(10,10,10,0.92)"; ctx.fillRect(0, photoH, W, stripH);
    ctx.textBaseline = "alphabetic"; ctx.font = font(800, 26); ctx.fillStyle = WHITE;
    spaced(ctx, label + "   ·   " + fmtDate(card.date), W / 2, photoH + 46, 5, "center");
    ctx.fillStyle = RED; ctx.fillRect(0, blockTop, W, blockBot - blockTop);
    headlineBlock(ctx, card.headline, card.red, blockTop + 34, blockBot - 34, {}, { ink: [255, 255, 255], sub: "#fff", soft: "#fff", red: "#111111", maxSize: 150 });
    ctx.fillStyle = "#000"; ctx.fillRect(0, blockBot, W, footH);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.font = font(500, 18); ctx.fillStyle = "#8a8a8a"; spaced(ctx, "SOURCE", M, blockBot + 52, 5, "left");
    ctx.font = font(800, 25); ctx.fillStyle = WHITE; spaced(ctx, String(card.source || "").toUpperCase(), M, blockBot + 88, 3, "left");
    ctx.font = font(600, 22); ctx.fillStyle = "#cfcfcf"; spaced(ctx, "@dubilook", M, blockBot + 124, 2, "left");
    ctx.font = font(500, 18); ctx.fillStyle = "#bdbdbd";
    const colX = 600, lines = wrap(ctx, DISCLAIMER, W - M - colX);
    lines.forEach((ln, i) => ctx.fillText(ln, colX, blockBot + 48 + i * 25));
    photoCredit(ctx, card);
  }

  // "overlay" — full-bleed photo, headline bottom-left over a dark gradient
  function drawOverlayCard(ctx, card, img, label) {
    coverDraw(ctx, img, 0, 0, W, H, 0.4);
    const g = ctx.createLinearGradient(0, H * 0.28, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.45, "rgba(0,0,0,0.72)"); g.addColorStop(1, "rgba(0,0,0,0.94)");
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.28, W, H * 0.72);
    const t = ctx.createLinearGradient(0, 0, 0, 220); t.addColorStop(0, "rgba(0,0,0,0.6)"); t.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = t; ctx.fillRect(0, 0, W, 220);
    brandRow(ctx, 110);
    // pill on the left, just above the headline
    const end = headlineBlock(ctx, card.headline, card.red, 560, H - 200, { summary: card.summary },
      { ink: [255, 255, 255], sub: "#e2e2e2", soft: "#aaa", left: true, maxW: W - 2 * M, valign: "bottom", maxSize: 130,
        onTop: (yTop) => pillLeft(ctx, label, M, yTop - 24) });
    footer(ctx, card, H - 50);
    photoCredit(ctx, card);
    return end;
  }
  function pillLeft(ctx, text, x, y) {
    ctx.font = font(800, 26); let w = 0; [...text].forEach((c, i) => { w += ctx.measureText(c).width + (i < text.length - 1 ? 6 : 0); });
    ctx.fillStyle = RED; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y - 38, w + 48, 50, 25); else ctx.rect(x, y - 38, w + 48, 50); ctx.fill();
    ctx.fillStyle = WHITE; spaced(ctx, text, x + 24, y - 4, 6, "left");
  }

  // reel cover 1080×1920: photo full-bleed, the hook big in the middle (the profile grid shows only the centre 3:4)
  function drawReelCover(ctx, card) {
    background(ctx);
    const img = card.photo ? PHOTOS[card.photo] : null;
    if (img) {
      coverDraw(ctx, img, 0, 0, W, H, 0.45);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.3, W, H * 0.45);
    }
    brandRow(ctx, 330);
    const end = headlineBlock(ctx, card.title, card.red || [], 560, 1380, {}, { ink: [255, 255, 255], sub: "#fff", soft: "#ddd", maxSize: 190,
      onTop: (yTop) => kicker(ctx, String(card.label || "NEWS").toUpperCase(), yTop - 30) });
    ctx.font = font(800, 28); ctx.fillStyle = "#f2f2f2"; ctx.textBaseline = "alphabetic";
    spaced(ctx, "WATCH THE REEL  ▶", W / 2, 1520, 6, "center");
    photoCredit(ctx, card);
  }

  // compact horizontal brand row: lens + Dubilook™
  function brandRow(ctx, y, T) {
    ctx.textBaseline = "alphabetic";
    ctx.font = heavy(46);
    const word = "Dubilook", ww = ctx.measureText(word).width;
    const lw = A.lens ? 58 : 0, lh = A.lens ? A.lens.height * (lw / A.lens.width) : 0;
    const total = lw + (lw ? 16 : 0) + ww + 22;
    let x = (W - total) / 2;
    if (A.lens) { ctx.drawImage(A.lens, x, y - lh + 8, lw, lh); x += lw + 16; }
    ctx.fillStyle = T ? rgb(T.ink) : WHITE; ctx.textAlign = "left"; ctx.fillText(word, x, y);
    ctx.font = font(600, 16); ctx.fillText("™", x + ww + 4, y - 28);
    return y;
  }
  function slideTag(ctx, slide, y) {
    if (!slide) return;
    ctx.font = font(600, 22); ctx.fillStyle = "#8a8a8a"; ctx.textBaseline = "alphabetic";
    spaced(ctx, slide.n + " / " + slide.of, W - M, y, 3, "right");
  }
  // label above the headline: white text on a red pill (owner 2026-10-09: the small red text was unreadable)
  function kicker(ctx, text, y) {
    ctx.textBaseline = "alphabetic";
    ctx.font = font(800, 28);
    let w = 0; [...text].forEach((c, i) => { w += ctx.measureText(c).width + (i < text.length - 1 ? 6 : 0); });
    const ph = 54, pw = w + 56, px = (W - pw) / 2, py = y - 40;
    ctx.fillStyle = RED; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 27); else ctx.rect(px, py, pw, ph); ctx.fill();
    ctx.fillStyle = WHITE; spaced(ctx, text, W / 2, py + 37, 6, "center");
  }
  function headlineBlock(ctx, text, red, top, bottom, extra, T) {
    const INK = T ? rgb(T.ink) : WHITE, SUB = T ? T.sub : GREY, ANG = T ? T.sub : "#e8e8e8";
    const maxW = (T && T.maxW) || W - 2 * 72, LEFT = !!(T && T.left), REDC = (T && T.red) || RED;
    text = String(text || "").trim().toUpperCase();
    const words = text.split(/\s+/), mask = redMask(words, red);
    const sumSize = 34, sumLH = sumSize * 1.36, angSize = 28, angLH = angSize * 1.38;
    let size, lines, lh, sumLines = [], angLines = [], blockH, F;
    const fit = (f) => {
      let r = null;
      for (let sz = (T && T.maxSize) || 200; sz >= 54; sz -= 2) {
        ctx.font = f.css(sz); const ls = LEFT ? wrap(ctx, text, maxW) : balanced(ctx, text, maxW), l = sz * f.lh;
        ctx.font = font(500, sumSize); const su = extra.summary ? balanced(ctx, extra.summary, maxW - 40) : [];
        ctx.font = font(600, angSize); const an = extra.angle ? balanced(ctx, extra.angle, maxW - 80) : [];
        const bh = ls.length * l + (su.length ? 44 + su.length * sumLH : 0) + (an.length ? 64 + an.length * angLH : 0);
        r = { size: sz, lines: ls, lh: l, sumLines: su, angLines: an, blockH: bh, F: f };
        if (ls.length <= 4 && bh <= bottom - top) break;
      }
      return r;
    };
    let best = null;
    for (const f of HEAD_FONTS) {
      const r = fit(f);
      if (r.size >= f.min) { best = r; break; }   // big enough in this font → use it
      best = r;                                   // none comfortable → the last font
    }
    ({ size, lines, lh, sumLines, angLines, blockH, F } = best);
    const yTop = T && T.valign === "bottom" ? bottom - blockH : top + (bottom - top - blockH) / 2;
    if (T && T.onTop) T.onTop(yTop, size);
    let y = yTop + size * 0.95;
    ctx.textBaseline = "alphabetic";
    let wi = 0;
    lines.forEach((ln) => {
      ctx.font = F.css(size);
      const lw = ln.split(" "), sp = ctx.measureText(" ").width * F.space;
      const total = lw.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp * (lw.length - 1);
      let x = LEFT ? (W - maxW) / 2 : (W - total) / 2;
      lw.forEach((wd) => {
        ctx.fillStyle = mask[wi] ? REDC : INK; ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = size * F.stroke; ctx.lineJoin = "miter";
        if (F.stroke > 0) ctx.strokeText(wd, x, y); ctx.fillText(wd, x, y);
        x += ctx.measureText(wd).width + sp; wi++;
      });
      y += lh;
    });
    y += -lh + 44 + sumSize * 1.1;
    ctx.textAlign = LEFT ? "left" : "center";
    const tx = LEFT ? (W - maxW) / 2 : W / 2;
    if (sumLines.length) {
      ctx.font = font(500, sumSize); ctx.fillStyle = SUB;
      sumLines.forEach((ln) => { ctx.fillText(ln, tx, y); y += sumLH; });
    }
    if (angLines.length) {
      y += 20;
      ctx.fillStyle = RED; ctx.fillRect(W / 2 - 28, y - angSize - 6, 56, 4);
      y += 28;
      ctx.font = font(600, angSize); ctx.fillStyle = ANG;
      angLines.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += angLH; });
    }
    ctx.textAlign = "left";
    return y;
  }
  function footer(ctx, card, yBase, T) {
    ctx.textBaseline = "alphabetic";
    ctx.font = font(500, 18); ctx.fillStyle = T ? T.soft : "#8a8a8a";
    spaced(ctx, "SOURCE", M, yBase - 84, 5, "left");
    ctx.font = font(800, 25); ctx.fillStyle = T ? rgb(T.ink) : WHITE;
    spaced(ctx, String(card.source || "").toUpperCase(), M, yBase - 48, 3, "left");
    ctx.fillStyle = RED; ctx.fillRect(M, yBase - 30, 60, 5);
    ctx.font = font(500, 18); ctx.fillStyle = T ? T.soft : "#8a8a8a";
    spaced(ctx, fmtDate(card.date), M, yBase, 3, "left");
    ctx.font = font(500, 19); ctx.fillStyle = T ? T.sub : "#cfcfcf";
    const colX = 620, colW = W - M - colX, lines = wrap(ctx, DISCLAIMER, colW), lh = 27;
    lines.forEach((ln, i) => ctx.fillText(ln, colX, yBase - (lines.length - 1 - i) * lh));
  }

  // ── card types ──────────────────────────────────────────────
  function drawCard(ctx, card) {
    const img = card.photo ? PHOTOS[card.photo] : null;
    const mode = card.photo_mode || "auto";
    const label = card.label ? String(card.label).toUpperCase() : card.type === "fact" ? "DID YOU KNOW?"
      : (card.category === "property" ? "UAE PROPERTY NEWS" : "UAE NEWS");
    const footBase = H - 70;
    // photo layouts rotate so the feed does not look the same every post (owner 2026-10-09);
    // the site sets card.layout, otherwise it is picked from the headline
    if (img && mode === "auto") {
      const L = ["panel", "bar", "overlay"], pick = card.layout || L[[...String(card.headline || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % L.length];
      if (pick === "bar") drawBarCard(ctx, card, img, label);
      else if (pick === "overlay") drawOverlayCard(ctx, card, img, label);
      else drawPhotoCard(ctx, card, img, label);
      return;
    }
    if (img && mode === "split") {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const splitH = Math.round(H * 0.5);
      photoLayer(ctx, img, "split", splitH);
      brandRow(ctx, 118); slideTag(ctx, card.slide, 116);
      kicker(ctx, label, splitH - 70);
      headlineBlock(ctx, card.headline, card.red, splitH - 40, footBase - 150, { summary: card.summary, angle: card.angle });
    } else {
      background(ctx);
      if (img) photoLayer(ctx, img, "full");
      brandRow(ctx, 118); slideTag(ctx, card.slide, 116);
      kicker(ctx, label, 206);
      headlineBlock(ctx, card.headline, card.red, 236, footBase - 150, { summary: card.summary, angle: card.angle });
    }
    footer(ctx, card, footBase);
    photoCredit(ctx, card);
  }

  function drawCover(ctx, card, storyLabel) {
    background(ctx);
    if (card.photo && PHOTOS[card.photo]) photoLayer(ctx, PHOTOS[card.photo], "full");
    const top = H > 1400 ? 300 : 118;
    brandRow(ctx, top);
    if (card.of) slideTag(ctx, { n: 1, of: card.of }, top - 2);
    const cy0 = top + 120;
    ctx.textBaseline = "alphabetic";
    if (storyLabel) { kicker(ctx, storyLabel, cy0); }
    else kicker(ctx, fmtDate(card.date), cy0);          // date in the red pill too (owner 2026-10-09: small red text unreadable)

    // title
    const title = String(card.title || "").toUpperCase();
    let size = 150; ctx.font = heavy(size);
    let tl = balanced(ctx, title, W - 2 * M);
    while ((tl.length > 2 || tl.some((l) => ctx.measureText(l).width > W - 2 * M)) && size > 70) {
      size -= 4; ctx.font = heavy(size); tl = balanced(ctx, title, W - 2 * M); }
    let y = cy0 + 40 + size * 0.95;
    ctx.fillStyle = WHITE; ctx.textAlign = "center";
    tl.forEach((ln) => { ctx.lineWidth = size * 0.028; ctx.strokeStyle = WHITE; ctx.strokeText(ln, W / 2, y); ctx.fillText(ln, W / 2, y); y += size * 1.05; });
    ctx.textAlign = "left";

    // numbered hooks
    y += 30;
    const hooks = (card.hooks || []).slice(0, 3);
    const rowH = H > 1400 ? 170 : 150;
    hooks.forEach((h, i) => {
      const ry = y + i * rowH;
      ctx.fillStyle = card.photo ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(M, ry, W - 2 * M, rowH - 24);
      ctx.fillStyle = RED; ctx.fillRect(M, ry, 8, rowH - 24);
      ctx.font = heavy(64); ctx.fillStyle = RED; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), M + 40, ry + (rowH - 24) / 2 + 4);
      let fs = 52; ctx.font = heavy(fs);
      const txt = String(h).toUpperCase();
      while (ctx.measureText(txt).width > W - 2 * M - 150 && fs > 30) { fs -= 2; ctx.font = heavy(fs); }
      ctx.fillStyle = WHITE; ctx.fillText(txt, M + 120, ry + (rowH - 24) / 2 + 4);
      ctx.textBaseline = "alphabetic";
    });

    // swipe cue / footer
    const fy = H > 1400 ? H - 420 : H - 90;
    ctx.font = font(800, 26); ctx.fillStyle = "#d2d2d2";
    spaced(ctx, storyLabel ? "SEE THE NEW POST ON OUR PAGE" : "SWIPE FOR DETAILS  →", W / 2, fy, 6, "center");
    if (A.logo && H > 1400) {
      const w = 230, h = A.logo.height * (w / A.logo.width);
      ctx.drawImage(A.logo, (W - w) / 2, H - 340 - h + 6, w, h);
    }
    photoCredit(ctx, card);
  }

  function drawCta(ctx, card) {
    background(ctx);
    brandRow(ctx, 118);
    slideTag(ctx, card.slide, 116);
    const text = String(card.text || "Send this to a colleague who needs it").toUpperCase();
    const words = text.split(/\s+/);
    const mask = words.map((w, i) => i === 0);
    let size = 170; ctx.font = heavy(size);
    let lines = balanced(ctx, text, W - 2 * M);
    while (lines.length * size * 1.07 > 620 && size > 80) { size -= 4; ctx.font = heavy(size); lines = balanced(ctx, text, W - 2 * M); }
    let y = (H - lines.length * size * 1.07) / 2 + size * 0.8 - 40, wi = 0;
    lines.forEach((ln) => {
      const lw = ln.split(" "), sp = ctx.measureText(" ").width * 0.8;
      const total = lw.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp * (lw.length - 1);
      let x = (W - total) / 2;
      lw.forEach((wd) => { ctx.fillStyle = mask[wi] ? RED : WHITE; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = size * 0.028;
        ctx.strokeText(wd, x, y); ctx.fillText(wd, x, y); x += ctx.measureText(wd).width + sp; wi++; });
      y += size * 1.07;
    });
    y += 40;
    ctx.font = font(600, 32); ctx.fillStyle = GREY; ctx.textAlign = "center";
    ctx.fillText("Follow @dubilook for daily Dubai property news", W / 2, y); y += 52;
    ctx.fillStyle = "#8a8a8a"; ctx.font = font(500, 28);
    ctx.fillText("Join the community on Telegram · link in bio", W / 2, y);
    ctx.textAlign = "left";
    if (A.logo) { const w = 230, h = A.logo.height * (w / A.logo.width); ctx.drawImage(A.logo, (W - w) / 2, H - 70 - h, w, h); }
  }

  function loadImg(url) {
    return new Promise((res) => { if (!url) return res(null);
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  }
  async function loadFonts(src) {
    if (!window.FontFace || !document.fonts) return;
    const at = (n) => (src && src[n]) ? src[n] : "assets/" + n + ".woff2";
    await Promise.all([["PJS", "500", "pjs-500"], ["PJS", "600", "pjs-600"], ["PJS", "800", "pjs-800"], ["Anton", "400", "anton"],
                       ["Barlow Condensed", "800", "barlow-800"]]
      .map(([fam, w, n]) => new FontFace(fam, "url(" + at(n) + ")", { weight: w }).load().then((ff) => document.fonts.add(ff)).catch(() => {})));
    try { await document.fonts.ready; } catch (e) {}
  }

  window.DUBILOOK_POSTS = {
    W, get H() { return H; },
    async init(src) {
      await loadFonts(src);
      A.lens = await loadImg((src && src["logo-lens"]) || "assets/logo-lens.png");
      A.logo = await loadImg((src && src["logo-light"]) || "assets/logo-light.png");
      return { lens: !!A.lens, logo: !!A.logo };
    },
    // preload a bank photo (same-origin URL or data: URL) before draw(); returns true when usable
    async photo(url) { if (!url) return false; if (!PHOTOS[url]) PHOTOS[url] = await loadImg(url); return !!PHOTOS[url]; },
    // height: 1350 for feed, 1920 for the story that announces a post
    draw(ctx, card, height) {
      H = height || 1350;
      try { ctx.direction = "ltr"; } catch (e) {}
      ctx.save();
      if (card.type === "cover") drawCover(ctx, card);
      else if (card.type === "story-cover") drawCover(ctx, card, card.label || "NEW POST");
      else if (card.type === "cta") drawCta(ctx, card);
      else if (card.type === "reel-cover") drawReelCover(ctx, card);
      else drawCard(ctx, card);
      ctx.restore();
    }
  };
})();
