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

  // compact horizontal brand row: lens + Dubilook™
  function brandRow(ctx, y) {
    ctx.textBaseline = "alphabetic";
    ctx.font = heavy(46);
    const word = "Dubilook", ww = ctx.measureText(word).width;
    const lw = A.lens ? 58 : 0, lh = A.lens ? A.lens.height * (lw / A.lens.width) : 0;
    const total = lw + (lw ? 16 : 0) + ww + 22;
    let x = (W - total) / 2;
    if (A.lens) { ctx.drawImage(A.lens, x, y - lh + 8, lw, lh); x += lw + 16; }
    ctx.fillStyle = WHITE; ctx.textAlign = "left"; ctx.fillText(word, x, y);
    ctx.font = font(600, 16); ctx.fillText("™", x + ww + 4, y - 28);
    return y;
  }
  function slideTag(ctx, slide, y) {
    if (!slide) return;
    ctx.font = font(600, 22); ctx.fillStyle = "#8a8a8a"; ctx.textBaseline = "alphabetic";
    spaced(ctx, slide.n + " / " + slide.of, W - M, y, 3, "right");
  }
  function kicker(ctx, text, y) {
    ctx.font = font(800, 24); ctx.fillStyle = RED; ctx.textBaseline = "alphabetic";
    spaced(ctx, text, W / 2, y, 7, "center");
  }
  function headlineBlock(ctx, text, red, top, bottom, extra) {
    const maxW = W - 2 * 72;
    text = String(text || "").trim().toUpperCase();
    const words = text.split(/\s+/), mask = redMask(words, red);
    const sumSize = 34, sumLH = sumSize * 1.36, angSize = 28, angLH = angSize * 1.38;
    let size = 200, lines, lh, sumLines = [], angLines = [], blockH;
    for (; size >= 54; size -= 2) {
      ctx.font = heavy(size); lines = balanced(ctx, text, maxW); lh = size * 1.07;
      ctx.font = font(500, sumSize); sumLines = extra.summary ? balanced(ctx, extra.summary, maxW - 40) : [];
      ctx.font = font(600, angSize); angLines = extra.angle ? balanced(ctx, extra.angle, maxW - 80) : [];
      blockH = lines.length * lh + (sumLines.length ? 44 + sumLines.length * sumLH : 0)
             + (angLines.length ? 64 + angLines.length * angLH : 0);
      if (lines.length <= 4 && blockH <= bottom - top) break;
    }
    let y = top + (bottom - top - blockH) / 2 + size * 0.95;
    ctx.textBaseline = "alphabetic";
    let wi = 0;
    lines.forEach((ln) => {
      ctx.font = heavy(size);
      const lw = ln.split(" "), sp = ctx.measureText(" ").width * 0.8;
      const total = lw.reduce((a, w) => a + ctx.measureText(w).width, 0) + sp * (lw.length - 1);
      let x = (W - total) / 2;
      lw.forEach((wd) => {
        ctx.fillStyle = mask[wi] ? RED : WHITE; ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = size * 0.028; ctx.lineJoin = "miter";
        ctx.strokeText(wd, x, y); ctx.fillText(wd, x, y);
        x += ctx.measureText(wd).width + sp; wi++;
      });
      y += lh;
    });
    y += -lh + 44 + sumSize * 1.1;
    ctx.textAlign = "center";
    if (sumLines.length) {
      ctx.font = font(500, sumSize); ctx.fillStyle = GREY;
      sumLines.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += sumLH; });
    }
    if (angLines.length) {
      y += 20;
      ctx.fillStyle = RED; ctx.fillRect(W / 2 - 28, y - angSize - 6, 56, 4);
      y += 28;
      ctx.font = font(600, angSize); ctx.fillStyle = "#e8e8e8";
      angLines.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += angLH; });
    }
    ctx.textAlign = "left";
    return y;
  }
  function footer(ctx, card, yBase) {
    ctx.textBaseline = "alphabetic";
    ctx.font = font(500, 18); ctx.fillStyle = "#8a8a8a";
    spaced(ctx, "SOURCE", M, yBase - 84, 5, "left");
    ctx.font = font(800, 25); ctx.fillStyle = WHITE;
    spaced(ctx, String(card.source || "").toUpperCase(), M, yBase - 48, 3, "left");
    ctx.fillStyle = RED; ctx.fillRect(M, yBase - 30, 60, 5);
    ctx.font = font(500, 18); ctx.fillStyle = "#8a8a8a";
    spaced(ctx, fmtDate(card.date), M, yBase, 3, "left");
    ctx.font = font(500, 19); ctx.fillStyle = "#cfcfcf";
    const colX = 620, colW = W - M - colX, lines = wrap(ctx, DISCLAIMER, colW), lh = 27;
    lines.forEach((ln, i) => ctx.fillText(ln, colX, yBase - (lines.length - 1 - i) * lh));
  }

  // ── card types ──────────────────────────────────────────────
  function drawCard(ctx, card) {
    background(ctx);
    brandRow(ctx, 118);
    slideTag(ctx, card.slide, 116);
    const label = card.type === "fact" ? "DID YOU KNOW?"
      : (card.category === "property" ? "UAE PROPERTY NEWS" : "UAE NEWS");
    kicker(ctx, label, 206);
    const footBase = H - 70;
    headlineBlock(ctx, card.headline, card.red, 236, footBase - 150, { summary: card.summary, angle: card.angle });
    footer(ctx, card, footBase);
  }

  function drawCover(ctx, card, storyLabel) {
    background(ctx);
    const top = H > 1400 ? 300 : 118;
    brandRow(ctx, top);
    if (card.of) slideTag(ctx, { n: 1, of: card.of }, top - 2);
    const cy0 = top + 120;
    ctx.textBaseline = "alphabetic";
    if (storyLabel) { kicker(ctx, storyLabel, cy0); }
    else { ctx.font = font(800, 24); ctx.fillStyle = RED; spaced(ctx, fmtDate(card.date), W / 2, cy0, 7, "center"); }

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
      ctx.fillStyle = "rgba(255,255,255,0.06)";
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
    await Promise.all([["PJS", "500", "pjs-500"], ["PJS", "600", "pjs-600"], ["PJS", "800", "pjs-800"], ["Anton", "400", "anton"]]
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
    // height: 1350 for feed, 1920 for the story that announces a post
    draw(ctx, card, height) {
      H = height || 1350;
      try { ctx.direction = "ltr"; } catch (e) {}
      ctx.save();
      if (card.type === "cover") drawCover(ctx, card);
      else if (card.type === "story-cover") drawCover(ctx, card, card.label || "NEW POST");
      else if (card.type === "cta") drawCta(ctx, card);
      else drawCard(ctx, card);
      ctx.restore();
    }
  };
})();
