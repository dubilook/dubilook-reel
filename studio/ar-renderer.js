// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_AR — Arabic (RTL) cards in the same brand language
//  Dark news cards (story 1080×1920, post 1080×1350) and the light
//  education card (1080×1350), mirrored for right-to-left reading:
//  arcs top-right / bottom-left, source block on the right.
//  Brand stays Latin (lens + Dubilook™); digits stay Western (0-9).
//
//  Contract:
//    await window.DUBILOOK_AR.init(src)
//    window.DUBILOOK_AR.draw(ctx, card, height)
//
//  card.type = "news" | "fact"   { headline, red[], summary, source, date, category }
//                                 height 1920 → story, 1350 → feed post
//            = "law"             { headline, red[], body, ref, source }   (light, 1350)
//  headline face: Lalezar (owner choice 2026-10-03); text: Cairo. card.font = "cairo" forces Cairo
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const W = 1080, M = 80;
  let H = 1350;
  const RED = "#e3141c", WHITE = "#ffffff", GREY = "#b9b9b9";
  const PAPER = "#f6f3ee", INK = "#141414", MUTED = "#6e6a64", RULE = "#d9d3ca";
  const DISCLAIMER = "Dubilook™ ناقلٌ للخبر فقط. المعلومات منسوبة إلى المصدر المذكور، ولا تتبنّاها Dubilook™ بشكل مستقل.";
  const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const A = {};
  let HEAD = "Lalezar";

  const ar = (w, s) => w + " " + s + "px Cairo, Tahoma, sans-serif";
  const head = (s) => "900 " + s + "px " + HEAD + ", Cairo, Tahoma, sans-serif";
  const latin = (w, s) => w + " " + s + "px PJS, -apple-system, system-ui, sans-serif";
  const anton = (s) => "400 " + s + "px Anton, Impact, sans-serif";

  function rtl(ctx, on) { try { ctx.direction = on ? "rtl" : "ltr"; } catch (e) {} }

  function wrap(ctx, text, maxW) {
    const out = []; let line = "";
    String(text || "").trim().split(/\s+/).filter(Boolean).forEach((w) => {
      const t = line ? line + " " + w : w;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }
  function balanced(ctx, text, maxW) {
    const base = wrap(ctx, text, maxW);
    if (base.length < 2) return base;
    let lo = maxW * 0.45, hi = maxW;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2;
      if (wrap(ctx, text, mid).length > base.length) lo = mid; else hi = mid; }
    return wrap(ctx, text, hi);
  }
  // Arabic-aware compare: drop tashkeel, tatweel and punctuation; unify alef/yaa/taa marbuta
  const norm = (s) => String(s).replace(/[ً-ْـ]/g, "").replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}%.]/gu, "").toLowerCase();
  function redMask(words, phrases) {
    const mask = words.map(() => false), nw = words.map(norm);
    (phrases || []).forEach((ph) => {
      const pw = String(ph).trim().split(/\s+/).map(norm).filter(Boolean);
      for (let i = 0; pw.length && i + pw.length <= nw.length; i++)
        if (pw.every((x, k) => nw[i + k] === x)) for (let k = 0; k < pw.length; k++) mask[i + k] = true;
    });
    return mask;
  }
  function fmtDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    return m ? (+m[3]) + " " + MONTHS[+m[2] - 1] + " " + m[1] : String(d || "");
  }
  // keep Latin tokens (Dubilook™, @dubilook, AED) and "25(2)" in their own LTR island inside RTL text
  const iso = (s) => String(s || "").replace(/[A-Za-z@#][A-Za-z0-9@#._™-]*|\d+\(\d+\)/g, "⁦$&⁩");
  const isLatin = (s) => /^[\x00-ɏ\s]+$/.test(String(s || ""));

  // one line of words laid out right-to-left, centred on cx; each word coloured by mask
  function rtlLine(ctx, words, mask, wi, cx, y, base, gap) {
    const ws = words.map((w) => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    let x = cx + total / 2;
    ctx.textAlign = "right";
    words.forEach((wd, i) => {
      ctx.fillStyle = mask[wi + i] ? RED : base;
      ctx.fillText(wd, x, y);
      x -= ws[i] + gap;
    });
    return wi + words.length;
  }

  // ── backgrounds ─────────────────────────────────────────────
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
  function darkBg(ctx) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, H * 0.62);
    g.addColorStop(0, "rgba(255,255,255,0.045)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!arcCache[H]) {
      const lay = document.createElement("canvas"); lay.width = W; lay.height = H;
      const g2 = lay.getContext("2d");
      const k = H / 1920 * 0.85 + 0.15;
      // mirrored: top-right and bottom-left
      glowArc(g2, W + 80, -80, 470 * k, Math.PI * 0.52, Math.PI * 0.98);
      glowArc(g2, -80, H + 80, 380 * k, Math.PI * 1.52, Math.PI * 1.98);
      arcCache[H] = lay;
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(arcCache[H], 0, 0); ctx.restore();
  }
  function lightBg(ctx) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    const arc = (cx, cy, r, a0, a1) => {
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(227,20,28,0)"); g.addColorStop(0.5, "rgba(227,20,28,0.55)"); g.addColorStop(1, "rgba(227,20,28,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    };
    arc(W + 60, -60, 360, Math.PI * 0.52, Math.PI * 0.98);
    arc(-60, H + 60, 300, Math.PI * 1.52, Math.PI * 1.98);
  }

  // ── brand (Latin, unchanged) ────────────────────────────────
  function brandStack(ctx, y) {
    rtl(ctx, false);
    let yy = y;
    if (A.lens) { const w = 124, h = A.lens.height * (w / A.lens.width); ctx.drawImage(A.lens, (W - w) / 2, yy, w, h); yy += h + 62; }
    ctx.textBaseline = "alphabetic"; ctx.font = anton(76); ctx.fillStyle = WHITE; ctx.textAlign = "center";
    ctx.fillText("Dubilook", W / 2 - 14, yy);
    const ww = ctx.measureText("Dubilook").width;
    ctx.font = latin(600, 22); ctx.fillText("™", W / 2 - 14 + ww / 2 + 16, yy - 44);
    // Arabic tagline instead of REAL INSIGHTS / A BRIGHTER VIEW
    rtl(ctx, true);
    ctx.font = ar(600, 26); ctx.fillStyle = "#9a9a9a";
    ctx.fillText("رؤى حقيقية · نظرة أوضح", W / 2, yy + 50);
    return yy + 50;
  }
  function brandRow(ctx, y, ink) {
    rtl(ctx, false);
    ctx.textBaseline = "alphabetic"; ctx.font = anton(46);
    const word = "Dubilook", ww = ctx.measureText(word).width;
    const lw = A.lens ? 58 : 0, lh = A.lens ? A.lens.height * (lw / A.lens.width) : 0;
    let x = (W - (lw + (lw ? 16 : 0) + ww + 22)) / 2;
    if (A.lens) { ctx.drawImage(A.lens, x, y - lh + 8, lw, lh); x += lw + 16; }
    ctx.fillStyle = ink || WHITE; ctx.textAlign = "left"; ctx.fillText(word, x, y);
    ctx.font = latin(600, 16); ctx.fillText("™", x + ww + 4, y - 28);
  }

  function kicker(ctx, text, y, size) {
    rtl(ctx, true);
    ctx.font = ar(800, size || 34); ctx.fillStyle = RED; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, W / 2, y);
  }

  // headline + summary, centred vertically in [top, bottom]
  function headlineBlock(ctx, text, red, top, bottom, summary, maxSize, maxLines, base, sumColor) {
    rtl(ctx, true);
    const maxW = W - 2 * 76;
    text = iso(text); summary = summary && iso(summary);
    const words = String(text || "").trim().split(/\s+/), mask = redMask(words, red);
    const sumSize = H > 1400 ? 40 : 35, sumLH = sumSize * 1.6;
    let size = maxSize, lines, lh, sum = [], blockH;
    for (; size >= 52; size -= 2) {
      ctx.font = head(size); lines = balanced(ctx, text, maxW); lh = size * 1.32;
      ctx.font = ar(500, sumSize); sum = summary ? balanced(ctx, summary, maxW - 60) : [];
      blockH = lines.length * lh + (sum.length ? 40 + sum.length * sumLH : 0);
      if (lines.length <= maxLines && blockH <= bottom - top) break;
    }
    ctx.textBaseline = "alphabetic";
    let y = top + (bottom - top - blockH) / 2 + size * 1.0, wi = 0;
    ctx.font = head(size);
    const gap = ctx.measureText(" ").width;
    lines.forEach((ln) => { wi = rtlLine(ctx, ln.split(" "), mask, wi, W / 2, y, base || WHITE, gap); y += lh; });
    y += -lh + 40 + sumSize * 1.25;
    if (sum.length) {
      ctx.font = ar(500, sumSize); ctx.fillStyle = sumColor || GREY; ctx.textAlign = "center";
      sum.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += sumLH; });
    }
    return y - sumLH;
  }

  // source block on the RIGHT, disclaimer on the LEFT (mirror of English)
  function darkFooter(ctx, card, yBase, big) {
    const s = big ? 1 : 0.9;
    rtl(ctx, true); ctx.textBaseline = "alphabetic"; ctx.textAlign = "right";
    ctx.font = ar(600, 24 * s); ctx.fillStyle = "#8a8a8a";
    ctx.fillText("المصدر", W - M, yBase - 96 * s);
    const src = String(card.source || "");
    if (isLatin(src)) { rtl(ctx, false); ctx.font = latin(800, 27 * s); ctx.fillStyle = WHITE; ctx.textAlign = "right"; ctx.fillText(src.toUpperCase(), W - M, yBase - 52 * s); rtl(ctx, true); }
    else { ctx.font = ar(800, 30 * s); ctx.fillStyle = WHITE; ctx.fillText(iso(src), W - M, yBase - 52 * s); }
    ctx.fillStyle = RED; ctx.fillRect(W - M - 64, yBase - 34 * s, 64, 5);
    ctx.font = ar(600, 23 * s); ctx.fillStyle = "#8a8a8a"; ctx.textAlign = "right";
    ctx.fillText(fmtDate(card.date), W - M, yBase);

    ctx.font = ar(500, 22 * s); ctx.fillStyle = "#d2d2d2"; ctx.textAlign = "right";
    const colW = 400, colRight = M + colW, lines = wrap(ctx, iso(DISCLAIMER), colW), lh = 36 * s;
    lines.forEach((ln, i) => ctx.fillText(ln, colRight, yBase - (lines.length - 1 - i) * lh));
  }

  // ── card types ──────────────────────────────────────────────
  function label(card) {
    return card.type === "fact" ? "هل تعلم؟" : (card.category === "property" ? "أخبار عقارات الإمارات" : "أخبار الإمارات");
  }

  function drawStory(ctx, card) {
    darkBg(ctx);
    const bBottom = brandStack(ctx, 150);
    const kY = bBottom + 110;
    kicker(ctx, label(card), kY, 36);
    headlineBlock(ctx, card.headline, card.red, kY + 40, H - 340 - 300, card.summary, 190, 5);
    darkFooter(ctx, card, H - 340 - 120, true);
    if (A.logo) { rtl(ctx, false); const w = 230, h = A.logo.height * (w / A.logo.width); ctx.drawImage(A.logo, (W - w) / 2, H - 340 - h + 6, w, h); }
  }

  function drawPost(ctx, card) {
    darkBg(ctx);
    brandRow(ctx, 118);
    kicker(ctx, label(card), 212, 32);
    const footBase = H - 70;
    headlineBlock(ctx, card.headline, card.red, 240, footBase - 160, card.summary, 140, 4);
    darkFooter(ctx, card, footBase, false);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pill(ctx, text, y) {
    rtl(ctx, true);
    ctx.font = ar(800, 30);
    const pw = ctx.measureText(text).width + 64, ph = 60, x = (W - pw) / 2;
    ctx.fillStyle = RED; roundRect(ctx, x, y - ph + 16, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, W / 2, y - 4);
  }
  function para(ctx, text, y, size, color, weight) {
    rtl(ctx, true);
    ctx.font = ar(weight || 500, size); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const lines = balanced(ctx, iso(text), W - 2 * M - 40), lh = size * 1.6;
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + i * lh));
    return y + (lines.length - 1) * lh;
  }
  function paraHeight(ctx, text, size, weight) {
    ctx.font = ar(weight || 500, size);
    return balanced(ctx, iso(text), W - 2 * M - 40).length * size * 1.6;
  }

  function drawLaw(ctx, c) {
    lightBg(ctx); brandRow(ctx, 118, INK);
    pill(ctx, "هل تعلم؟  ·  قانون", 222);
    const bodyH = paraHeight(ctx, c.body, 36) + (c.ref ? 120 : 0);
    const end = headlineBlock(ctx, c.headline, c.red, 270, H - 230 - bodyH - 40, "", 130, 4, INK);
    let y = para(ctx, c.body, end + 90, 36, "#3a3632");
    if (c.ref) {
      y += 74;
      ctx.fillStyle = RED; ctx.fillRect(W / 2 - 28, y - 34, 56, 4);
      para(ctx, c.ref, y + 14, 27, MUTED, 600);
    }
    // footer: source on the right, call to save on the left
    const fy = H - 70;
    ctx.fillStyle = RULE; ctx.fillRect(M, fy - 80, W - 2 * M, 2);
    rtl(ctx, true); ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = ar(600, 21); ctx.fillStyle = MUTED; ctx.fillText("المصدر", W - M, fy - 34);
    ctx.font = ar(800, 28); ctx.fillStyle = INK; ctx.fillText(iso(c.source), W - M, fy + 4);
    ctx.font = ar(700, 24); ctx.fillStyle = MUTED; ctx.textAlign = "left";
    ctx.fillText(iso("احفظ · شارك · @dubilook"), M, fy + 4);
  }

  // ── assets ──────────────────────────────────────────────────
  function loadImg(url) {
    return new Promise((res) => { if (!url) return res(null);
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  }
  async function loadFonts(src) {
    if (!window.FontFace || !document.fonts) return;
    const at = (n, ext) => (src && src[n]) ? src[n] : "assets/" + n + "." + ext;
    const list = [["PJS", "500", at("pjs-500", "woff2")], ["PJS", "600", at("pjs-600", "woff2")], ["PJS", "800", at("pjs-800", "woff2")],
      ["Anton", "400", at("anton", "woff2")], ["Cairo", "200 1000", at("cairo", "ttf")], ["Lalezar", "900", at("lalezar", "ttf")]];
    await Promise.all(list.map(([fam, w, u]) => new FontFace(fam, "url(" + u + ")", { weight: w }).load()
      .then((ff) => document.fonts.add(ff)).catch(() => {})));
    try { await document.fonts.ready; } catch (e) {}
  }

  window.DUBILOOK_AR = {
    W, get H() { return H; },
    async init(src) {
      await loadFonts(src);
      A.lens = await loadImg((src && src["logo-lens"]) || "assets/logo-lens.png");
      A.logo = await loadImg((src && src["logo-light"]) || "assets/logo-light.png");
      const ck = (f) => { try { return document.fonts.check(f, "دبي"); } catch (e) { return false; } };
      return { lens: !!A.lens, logo: !!A.logo, cairo: ck("900 40px Cairo"), lalezar: ck("900 40px Lalezar") };
    },
    draw(ctx, card, height) {
      H = card.type === "law" ? 1350 : (height || 1350);
      HEAD = card.font === "cairo" ? "Cairo" : "Lalezar";
      ctx.save();
      if (card.type === "law") drawLaw(ctx, card);
      else if (H > 1400) drawStory(ctx, card);
      else drawPost(ctx, card);
      ctx.restore();
    }
  };
})();
