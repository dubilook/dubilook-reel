// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_RENDERER — پورت Canvas از reel.html
//  برای رندر روی گوشی با Scriptable / سافاری
//
//  قرارداد:
//    await window.DUBILOOK_RENDERER.init(D, layout)
//    window.DUBILOOK_RENDERER.draw(ctx, W, H, p, D)     p = 0..1
//    window.DUBILOOK_RENDERER.duration                   ثانیه
// ═══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  const TOTAL = 24.8;
  const W = 1080, H = 1920;

  // ── چیدمان: safe (اینستاگرام) و full (واتساپ/تلگرام) ─────────
  const LAYOUTS = {
    safe: { logoTop: 262, barTop: 250, scTop: 372, scBottom: 640, srcBottom: 566,
            plotH: 470, plotMt: 40, h1: 76, big: 54, q: 58, ico: 136, icoImg: 80, endLogo: 540 },
    full: { logoTop: 104, barTop: 2,   scTop: 230, scBottom: 170, srcBottom: 78,
            plotH: 620, plotMt: 30, h1: 84, big: 60, q: 64, ico: 158, icoImg: 92, endLogo: 620 }
  };

  const M = 80;                       // حاشیهٔ چپ و راست
  const GOLD_STOPS = [[0, "#ffdd85"], [0.46, "#f5c451"], [1, "#dd9d26"]];

  const SC = [
    { id: 1, t: 0.20, d: 4.00 },
    { id: 2, t: 4.20, d: 6.00 },
    { id: 3, t: 10.20, d: 4.00 },
    { id: 4, t: 14.20, d: 4.00 },
    { id: 5, t: 18.20, d: 3.20 },
    { id: 6, t: 21.40, d: 3.40 }
  ];

  // ── توابع شتاب ───────────────────────────────────────────────
  const cl = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const p2i = (x) => x * x;
  const p2o = (x) => 1 - (1 - x) * (1 - x);
  const p3o = (x) => 1 - Math.pow(1 - x, 3);
  const p4o = (x) => 1 - Math.pow(1 - x, 4);
  const p2io = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const p3io = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const backOut = (x, s) => { s = s || 1.7; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

  // پیشرفت یک بازه: ۰ قبل از شروع، ۱ بعد از پایان
  const seg = (t, at, dur) => cl((t - at) / dur);

  const nf = (n) => Math.round(n).toLocaleString("en-US");

  // ── ابزار رسم ────────────────────────────────────────────────
  function rr(ctx, x, y, w, h, r) {
    // شعاع هرگز از نصف کوچک‌ترین ضلع بیشتر نشود، وگرنه مسیر به شکل پروانه درمی‌آید
    const cap = Math.max(0, Math.min(w, h) / 2);
    const rad = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.min(v, cap));
    ctx.beginPath();
    ctx.moveTo(x + rad[0], y);
    ctx.lineTo(x + w - rad[1], y); ctx.quadraticCurveTo(x + w, y, x + w, y + rad[1]);
    ctx.lineTo(x + w, y + h - rad[2]); ctx.quadraticCurveTo(x + w, y + h, x + w - rad[2], y + h);
    ctx.lineTo(x + rad[3], y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad[3]);
    ctx.lineTo(x, y + rad[0]); ctx.quadraticCurveTo(x, y, x + rad[0], y);
    ctx.closePath();
  }

  function goldFill(ctx, x, w) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    GOLD_STOPS.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function font(weight, size) { return weight + " " + size + "px PJS, -apple-system, system-ui, sans-serif"; }

  // شکستن متن به سطرها با عرض بیشینه
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text).split("\n").forEach((para) => {
      const words = para.split(" ");
      let line = "";
      words.forEach((w) => {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
        else line = test;
      });
      out.push(line);
    });
    return out;
  }

  // متن را با اندازه‌ای می‌چیند که حتماً داخل عرض جا شود.
  // اگر فونت اختصاصی بارگذاری نشده باشد، فونت جایگزین پهن‌تر است و
  // بدون این کوچک‌سازی متن از قاب بیرون می‌زند.
  function fitLines(ctx, text, maxW, weight, size, minRatio) {
    let s = size;
    const floor = size * (minRatio || 0.68);
    let lines;
    for (;;) {
      ctx.font = font(weight, s);
      lines = wrap(ctx, text, maxW);
      let widest = 0;
      lines.forEach((l) => { widest = Math.max(widest, ctx.measureText(l).width); });
      if (widest <= maxW || s <= floor) break;
      s = Math.max(floor, s * Math.min(0.97, maxW / widest));
    }
    ctx.font = font(weight, s);
    return { lines, size: s };
  }

  function shadow(ctx, color, blur, oy) {
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy || 0;
  }
  function noShadow(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

  // ── دارایی‌ها ────────────────────────────────────────────────
  const A = {};          // تصاویر
  let L = LAYOUTS.safe;
  let bgBaked = null;    // پس‌زمینهٔ پخته‌شده
  let bgBlur = null;     // نسخهٔ بلور، برای پشت کارت‌های شیشه‌ای
  let grainPat = null;

  function loadImg(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  async function loadFonts() {
    // اگر صفحه خودش PJS را با @font-face تعریف کرده، کاری لازم نیست
    try { if (document.fonts && document.fonts.check('800 76px PJS')) { await document.fonts.ready; return; } } catch (e) {}
    if (!window.FontFace || !document.fonts) return;
    const defs = [["800", "assets/pjs-800.woff2"], ["600", "assets/pjs-600.woff2"], ["500", "assets/pjs-500.woff2"]];
    await Promise.all(defs.map(([w, u]) => {
      const f = new FontFace("PJS", "url(" + u + ")", { weight: w });
      return f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
    }));
    try { await document.fonts.ready; } catch (e) {}
  }

  // پس‌زمینه یک‌بار پخته می‌شود: عکس + محو‌شدگی
  function bakeBackground() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");

    x.fillStyle = "#05070f"; x.fillRect(0, 0, W, H);

    if (A.photo) {
      const s = Math.max(W / A.photo.width, H / A.photo.height);
      const dw = A.photo.width * s, dh = A.photo.height * s;
      x.drawImage(A.photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    const fade = x.createLinearGradient(0, 0, 0, H);
    [[0, .62], [.22, .50], [.44, .34], [.62, .30], [.84, .55], [1, .86]]
      .forEach(([o, a]) => fade.addColorStop(o, "rgba(5,7,15," + a + ")"));
    x.fillStyle = fade; x.fillRect(0, 0, W, H);
    bgBaked = c;

    // نسخهٔ بلور: کوچک و بزرگ کردن، ارزان‌تر از فیلتر زنده
    const b = document.createElement("canvas");
    b.width = Math.round(W / 12); b.height = Math.round(H / 12);
    const bx = b.getContext("2d");
    bx.drawImage(c, 0, 0, b.width, b.height);
    bgBlur = b;
  }

  function bakeGrain() {
    const s = 160, c = document.createElement("canvas");
    c.width = s; c.height = s;
    const x = c.getContext("2d");
    const img = x.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    grainPat = c;
  }

  // ── کارت شیشه‌ای ─────────────────────────────────────────────
  function glass(ctx, x, y, w, h, r) {
    ctx.save();
    rr(ctx, x, y, w, h, r); ctx.clip();
    if (bgBlur) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(bgBlur, 0, 0, bgBlur.width, bgBlur.height, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
    g.addColorStop(0, "rgba(255,255,255,.088)");
    g.addColorStop(1, "rgba(255,255,255,.024)");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();

    ctx.save();
    rr(ctx, x + .5, y + .5, w - 1, h - 1, r);
    ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  // نور دونده روی لبهٔ کارت
  function neon(ctx, x, y, w, h, r, prog, len, color) {
    if (prog <= 0 || prog >= 1) return;
    const per = 2 * (w + h);
    const head = (prog * per) % per;
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    rr(ctx, x, y, w, h, r);
    ctx.lineWidth = 3;
    ctx.setLineDash([len, per]);
    ctx.lineDashOffset = -head;
    ctx.strokeStyle = color;
    shadow(ctx, color, 26);
    ctx.stroke();
    ctx.restore();
    noShadow(ctx);
  }

  // ── چرم ثابت: نوار پیشرفت، لوگو، خط منبع ────────────────────
  function chrome(ctx, t, D) {
    const p = t / TOTAL;

    // نوار
    ctx.fillStyle = "rgba(150,190,240,.14)";
    ctx.fillRect(0, L.barTop, W, 2);
    if (p > 0) {
      const g = ctx.createLinearGradient(0, 0, W * p, 0);
      g.addColorStop(0, "rgba(90,170,255,0)");
      g.addColorStop(.55, "rgba(120,195,255,.35)");
      g.addColorStop(.92, "rgba(190,230,255,.95)");
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fillRect(0, L.barTop, W * p, 2);

      const hx = W * p, hy = L.barTop + 1;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 30);
      hg.addColorStop(0, "rgba(234,246,255,1)");
      hg.addColorStop(.22, "rgba(160,215,255,.85)");
      hg.addColorStop(.55, "rgba(90,170,255,.30)");
      hg.addColorStop(1, "rgba(60,140,255,0)");
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(hx, hy, 30, 0, 6.284); ctx.fill();
      ctx.fillStyle = "#eaf6ff";
      ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 6.284); ctx.fill();
    }

    // لوگو
    if (A.logo) {
      const a = seg(t, 0.10, .7), e = p3o(a);
      const wgt = 252, hgt = A.logo.height * (wgt / A.logo.width);
      const sc = .93 + .07 * e;
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(M + wgt / 2, L.logoTop + hgt / 2 + (-16 * (1 - e)));
      ctx.scale(sc, sc);
      ctx.drawImage(A.logo, -wgt / 2, -hgt / 2, wgt, hgt);
      ctx.restore();
    }

    // منبع و تاریخ
    const sa = seg(t, 0.55, .7);
    if (sa > 0) {
      ctx.save();
      ctx.globalAlpha = sa;
      shadow(ctx, "rgba(5,7,15,.95)", 14, 2);
      const y = H - L.srcBottom;
      ctx.font = font(500, 19);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#8593bb";
      ctx.fillText("SOURCE  ", M, y);
      const off = ctx.measureText("SOURCE  ").width;
      ctx.font = font(600, 19);
      ctx.fillStyle = "#a8b5d8";
      ctx.fillText(D.source || "", M + off, y);
      ctx.textAlign = "right";
      ctx.font = font(500, 19);
      ctx.fillStyle = "#8593bb";
      ctx.fillText(D.date || "", W - M, y);
      ctx.restore();
      noShadow(ctx);
    }
  }

  // ── قرص عنوان ────────────────────────────────────────────────
  function pill(ctx, x, y, text, a, scale) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(600, 24);
    const tw = ctx.measureText(text).width + 24 * 2 + 11 + 14 + text.length * 4.8;
    const w = ctx.measureText(text).width * 1 + 22 + 28 + 11 + 14;
    const h = 62;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const g = ctx.createLinearGradient(0, 0, w * .6, h);
    g.addColorStop(0, "rgba(245,196,81,.22)");
    g.addColorStop(1, "rgba(245,196,81,.07)");
    rr(ctx, 0, 0, w, h, 100); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(245,196,81,.45)"; ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = "#f5c451";
    shadow(ctx, "rgba(245,196,81,.65)", 16);
    ctx.beginPath(); ctx.arc(22 + 5.5, h / 2, 5.5, 0, 6.284); ctx.fill();
    noShadow(ctx);

    ctx.fillStyle = "#ffdd85";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = font(600, 24);
    letterSpaced(ctx, text, 22 + 11 + 14, h / 2, 24 * 0.20);
    ctx.restore();
    return { w: w * scale, h: h * scale };
  }

  // متن با فاصلهٔ حروف
  function letterSpaced(ctx, text, x, y, sp) {
    let cx = x;
    for (const ch of String(text)) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + sp;
    }
    return cx - x;
  }
  function spacedWidth(ctx, text, sp) {
    let w = 0;
    for (const ch of String(text)) w += ctx.measureText(ch).width + sp;
    return w;
  }

  // ── صحنه ۱ — قلاب ───────────────────────────────────────────
  function scene1(ctx, t, D) {
    const box = { x: M, y: L.scTop, w: W - M * 2, h: H - L.scBottom - L.scTop };

    // اندازه‌گیری برای وسط‌چین عمودی
    const fitH = fitLines(ctx, D.hook || "", box.w, 800, L.h1);
    const lines = fitH.lines, h1s = fitH.size, lh = h1s * 1.06;
    const fitS = fitLines(ctx, D.sub || "", Math.min(820, box.w), 500, 33, .8);
    const subLines = fitS.lines, subs = fitS.size;
    const PILL_H = D.kicker ? 62 : 0, PILL_GAP = D.kicker ? 38 : 0, SUB_GAP = 34;
    const totalH = PILL_H + PILL_GAP + lines.length * lh + SUB_GAP + subLines.length * subs * 1.42;
    let top = box.y + Math.max(0, (box.h - totalH) / 2);

    // قرص
    const pa = seg(t, 0.28, .5);
    const pv = backOut(pa, 2);
    if (pa > 0 && D.kicker) pill(ctx, box.x, top + 20 * (1 - p3o(pa)), D.kicker, pa, .9 + .1 * pv);

    // عنوان — هر سطر از پایین بالا می‌آید، داخل ماسک خودش
    const goldTail = (D.hookGold || "").trim();
    const hookStr = String(D.hook || "");
    const goldStart = goldTail && hookStr.endsWith(goldTail) ? hookStr.length - goldTail.length : -1;
    let consumed = 0;

    let y = top + PILL_H + PILL_GAP + h1s * 0.82;
    lines.forEach((ln, i) => {
      const a = seg(t, 0.44 + i * 0.10, .82);
      const e = p4o(a);
      const ty = (1 - e) * lh * 1.12;
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x - 10, y - lh * 0.86, box.w + 20, lh); ctx.clip();
      ctx.font = font(800, h1s);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

      // بخش طلایی — ممکن است بین چند سطر شکسته باشد
      let plain = ln, gold = "";
      if (goldStart >= 0) {
        const local = goldStart - consumed;
        if (local <= 0) { plain = ""; gold = ln; }
        else if (local < ln.length) { plain = ln.slice(0, local); gold = ln.slice(local); }
      }
      consumed += ln.length + 1;

      ctx.fillStyle = "#ffffff";
      ctx.fillText(plain, box.x, y + ty);
      if (gold) {
        const gx = box.x + ctx.measureText(plain).width;
        ctx.fillStyle = goldFill(ctx, gx, ctx.measureText(gold).width || 1);
        ctx.fillText(gold, gx, y + ty);
      }
      ctx.restore();
      y += lh;
    });

    // زیرعنوان
    const sa = seg(t, 1.05, .6), se = p3o(sa);
    if (sa > 0) {
      ctx.save();
      ctx.globalAlpha = se;
      ctx.font = font(500, subs);
      ctx.fillStyle = "#9dadd6";
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      let sy = y + 34 + 24 * (1 - se);
      subLines.forEach((s) => { ctx.fillText(s, box.x, sy); sy += subs * 1.42; });
      ctx.restore();
    }
  }
  let pillTop = 0;

  // ── صحنه ۲ — عدد یا نمودار ──────────────────────────────────
  function scene2(ctx, t, D) {
    const box = { x: M, y: L.scTop, w: W - M * 2, h: H - L.scBottom - L.scTop };
    const hasChart = !!(D.chart && D.chart.bars && D.chart.bars.length);

    const ca = seg(t, 4.24, .7), ce = p3o(ca);
    if (ca <= 0) return;

    const padX = 48, padY = 44;
    const cardH = hasChart ? (L.plotH + L.plotMt + 58 + padY * 2 + 40) : 560;
    const cardY = box.y + (box.h - cardH) / 2;

    ctx.save();
    ctx.globalAlpha = ce;
    ctx.translate(0, 48 * (1 - ce));

    glass(ctx, box.x, cardY, box.w, cardH, 42);
    neon(ctx, box.x, cardY, box.w, cardH, 42, seg(t, 4.55, 2.6), 700, "#eef3ff");

    // سربرگ کارت
    const ia = backOut(seg(t, 4.50, .6), 2.4);
    const icoKey = (D.icons && D.icons.stat) || "";
    if (A[icoKey] && ia > 0) {
      ctx.save();
      ctx.translate(box.x + padX + 29, cardY + padY + 29);
      ctx.rotate((-40 + 40 * ia) * Math.PI / 180);
      ctx.scale(ia, ia);
      ctx.drawImage(A[icoKey], -29, -29, 58, 58);
      ctx.restore();
    }
    const la = seg(t, 4.58, .5);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = ce * la;
      ctx.font = font(600, 28);
      ctx.fillStyle = "#c3d0f0";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      letterSpaced(ctx, D.statLabelShort || "", box.x + padX + 58 + 20 - 16 * (1 - la), cardY + padY + 29, 28 * .14);
      ctx.restore();
    }

    const plotX = box.x + padX, plotY = cardY + padY + 58 + L.plotMt;
    const plotW = box.w - padX * 2, plotH = L.plotH;

    if (hasChart) drawChart(ctx, t, D, plotX, plotY, plotW, plotH);
    else drawBigStat(ctx, t, D, box.x, cardY, box.w, cardH);

    ctx.restore();
  }

  function drawBigStat(ctx, t, D, x, y, w, h) {
    const na = seg(t, 4.80, 1.5), ne = p3o(na);
    const val = (D.statValue || 0) * ne;
    const cx = x + w / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, na * 3);
    const sc = .8 + .2 * backOut(Math.min(1, na * 2.5), 1.8);
    ctx.translate(cx, y + h * .46);
    ctx.scale(sc, sc);
    ctx.font = font(800, 180);
    ctx.fillStyle = goldFill(ctx, -w / 2, w);
    ctx.textBaseline = "middle";
    ctx.fillText(nf(val), 0, 0);
    ctx.restore();

    const ua = seg(t, 5.60, .5);
    if (ua > 0) {
      ctx.save();
      ctx.globalAlpha = ua;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = font(600, 52);
      ctx.fillStyle = "#ffdd85";
      ctx.fillText(D.statUnit || "", cx, y + h * .46 + 100 + 18 * (1 - p2o(ua)));
      ctx.restore();
    }
    const ba = seg(t, 5.85, .5);
    if (ba > 0) {
      ctx.save();
      ctx.globalAlpha = ba;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = font(500, 32);
      ctx.fillStyle = "#9dadd6";
      const ls = wrap(ctx, D.statLabel || "", w - 140);
      let ly = y + h * .46 + 180 + 18 * (1 - p2o(ba));
      ls.forEach((s) => { ctx.fillText(s, cx, ly); ly += 32 * 1.4; });
      ctx.restore();
    }
  }

  function drawChart(ctx, t, D, x, y, w, h) {
    const bars = D.chart.bars;
    const max = Math.max.apply(null, bars.map((b) => b.value)) || 1;
    const rightPad = 104, axisW = w - rightPad;
    const baseY = y + h - 70;
    // سقف میله‌ها پایین‌تر می‌آید تا عدد و نشانِ بالای میله جا شوند و روی هم نیفتند
    const hasBadge = bars.some((b) => b.badge);
    const topY = y + (hasBadge ? 200 : 110);

    // خطوط راهنما
    const ga = p2o(seg(t, 4.84, .58));
    for (let i = 1; i <= 3; i++) {
      const gy = baseY - (baseY - topY) * (i / 3);
      ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + axisW * ga, gy); ctx.stroke();
      const ta = seg(t, 4.92 + i * .06, .42);
      if (ta > 0) {
        ctx.save(); ctx.globalAlpha = ta;
        ctx.font = font(500, 20); ctx.fillStyle = "#606e99";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(nf(max * (i / 3)), x + w, gy);
        ctx.restore();
      }
    }

    // محور
    const aa = p3io(seg(t, 4.70, .7));
    const ag = ctx.createLinearGradient(x, 0, x + axisW, 0);
    ag.addColorStop(0, "rgba(255,255,255,.36)"); ag.addColorStop(1, "rgba(255,255,255,.08)");
    ctx.fillStyle = ag; ctx.fillRect(x, baseY, axisW * aa, 2);

    // میله‌ها
    const gap = 88, n = bars.length;
    const zoneX = x + 30, zoneW = w - 160 - 30;
    const bw = (zoneW - gap * (n - 1)) / n;

    bars.forEach((b, k) => {
      const at = 5.24 + k * 0.78, dur = .9 + k * .2;
      const e = p3o(seg(t, at, dur));
      const full = (baseY - topY) * (b.value / max);
      const bh = full * e;
      const bx = zoneX + k * (bw + gap);
      const by = baseY - bh;
      const isGold = b.color === "gold";

      if (bh > 2) {
        ctx.save();
        rr(ctx, bx, by, bw, bh, [18, 18, 4, 4]);
        ctx.clip();
        const g = ctx.createLinearGradient(0, by, 0, baseY);
        if (isGold) { g.addColorStop(0, "#ffdd85"); g.addColorStop(1, "#e5a32b"); }
        else { g.addColorStop(0, "#6480ea"); g.addColorStop(1, "#2f4399"); }
        ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);

        // برق مورب
        const sh = seg(t, 6.35 + k * .55, 1.5);
        if (sh > 0 && sh < 1) {
          const sp = p2io(sh);
          const sx = bx + (-1.6 + 5.8 * sp) * bw;
          ctx.save();
          ctx.translate(sx, by);
          ctx.transform(1, 0, Math.tan(-20 * Math.PI / 180), 1, 0, 0);
          const sg = ctx.createLinearGradient(0, 0, bw * .46, 0);
          sg.addColorStop(0, "rgba(255,255,255,0)");
          sg.addColorStop(.3, "rgba(255,255,255,.10)");
          sg.addColorStop(.5, "rgba(255,255,255,.62)");
          sg.addColorStop(.7, "rgba(255,255,255,.10)");
          sg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = sg;
          ctx.fillRect(0, -bh * .25, bw * .46, bh * 1.5);
          ctx.restore();
        }
        ctx.restore();

        ctx.save();
        rr(ctx, bx, by, bw, bh, [18, 18, 4, 4]);
        ctx.strokeStyle = "rgba(255,255,255," + (isGold ? .55 : .26) + ")";
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }

      // عدد بالای میله
      const va = seg(t, at, .28);
      if (va > 0) {
        ctx.save();
        ctx.globalAlpha = va;
        ctx.font = font(800, 50);
        ctx.fillStyle = isGold ? "#ffdd85" : "#a9bcff";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(nf(b.value * e), bx + bw / 2, by - 18);
        ctx.restore();
      }

      // برچسب زیر میله
      const xa = seg(t, 5.00 + k * .09, .48);
      if (xa > 0) {
        ctx.save();
        ctx.globalAlpha = xa;
        ctx.font = font(600, 25);
        ctx.fillStyle = "#8b9ac6";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        let ly = baseY + 22 + 14 * (1 - p2o(xa));
        String(b.label).split("\n").forEach((s) => { ctx.fillText(s, bx + bw / 2, ly); ly += 25 * 1.32; });
        ctx.restore();
      }

      // نشان روی میلهٔ طلایی
      if (b.badge) {
        const ba = seg(t, 7.30, .62);
        if (ba > 0) {
          const s = backOut(ba, 2.7) * .6 + .4;
          ctx.save();
          ctx.globalAlpha = Math.min(1, ba * 2);
          ctx.font = font(600, 23);
          const tw = ctx.measureText(b.badge).width + 44;
          // درست بالای عددِ میله؛ عدد در by-18 نوشته می‌شود و بلندایش حدود ۵۰
          ctx.translate(bx + bw / 2, by - 18 - 50 - 42);
          ctx.scale(s, s);
          const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2 * .4, 52);
          g.addColorStop(0, "rgba(245,196,81,.26)"); g.addColorStop(1, "rgba(245,196,81,.08)");
          rr(ctx, -tw / 2, -26, tw, 52, 100);
          shadow(ctx, "rgba(245,196,81,.55)", 42);
          ctx.fillStyle = g; ctx.fill();
          noShadow(ctx);
          ctx.strokeStyle = "rgba(245,196,81,.5)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#ffdd85";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(b.badge, 0, 1);
          ctx.restore();
        }
      }
    });
  }

  // ── صحنه‌های متنی ۳ و ۴ ─────────────────────────────────────
  function textScene(ctx, t, D, n) {
    const box = { x: M, y: L.scTop, w: W - M * 2, h: H - L.scBottom - L.scTop };
    const cfg = n === 3
      ? { at: 10.28, rot: -25, lead: "WHAT HAPPENED", txt: D.detail, ico: D.icons && D.icons.detail, rule: false }
      : { at: 14.28, rot: 25, lead: "WHY IT MATTERS", txt: D.takeaway, ico: D.icons && D.icons.takeaway, rule: true };

    // اندازه‌گیری برای وسط‌چین عمودی
    const fit = fitLines(ctx, cfg.txt || "", box.w, 800, L.big);
    const txtLines = fit.lines, bigs = fit.size;
    const totalH = L.ico + 34 + (cfg.rule ? 48 : 0) + 27 + 26 + txtLines.length * bigs * 1.22;
    let y = box.y + Math.max(0, (box.h - totalH) / 2);

    // کاشی آیکون
    const ia = seg(t, cfg.at, .62), ie = backOut(ia, 2.2);
    if (ia > 0) {
      ctx.save();
      ctx.translate(box.x + L.ico / 2, y + L.ico / 2);
      ctx.rotate((cfg.rot * (1 - ie)) * Math.PI / 180);
      ctx.scale(ie, ie);
      glass(ctx, -L.ico / 2, -L.ico / 2, L.ico, L.ico, 36);
      if (A[cfg.ico]) ctx.drawImage(A[cfg.ico], -L.icoImg / 2, -L.icoImg / 2, L.icoImg, L.icoImg);
      ctx.restore();
      neon(ctx, box.x, y, L.ico, L.ico, 36, seg(t, cfg.at + .22, 1.6), 300, "#eaf0ff");
    }
    y += L.ico + 34;

    if (cfg.rule) {
      const ra = p3o(seg(t, 14.48, .55));
      const g = ctx.createLinearGradient(box.x, 0, box.x + 96, 0);
      g.addColorStop(0, "#ffdd85"); g.addColorStop(1, "#e5a32b");
      shadow(ctx, "rgba(245,196,81,.6)", 26);
      ctx.fillStyle = g;
      rr(ctx, box.x, y, 96 * ra, 6, 6); ctx.fill();
      noShadow(ctx);
      y += 42;
    }

    const la = seg(t, cfg.at + .18, .5);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = la;
      ctx.font = font(600, 27);
      ctx.fillStyle = "#8b9ac6";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      letterSpaced(ctx, cfg.lead, box.x - 18 * (1 - la), y, 27 * .20);
      ctx.restore();
      y += 27 + 26;
    }

    const ta = seg(t, cfg.at + .30, .7), te = p3o(ta);
    if (ta > 0) {
      ctx.save();
      ctx.globalAlpha = te;
      ctx.font = font(800, bigs);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      shadow(ctx, "rgba(5,7,15,.9)", 26, 3);
      let ty = y + 30 * (1 - te);
      txtLines.forEach((s) => { ctx.fillText(s, box.x, ty); ty += bigs * 1.22; });
      ctx.restore();
      noShadow(ctx);
    }
  }

  // ── صحنه ۵ — پرسش ───────────────────────────────────────────
  function scene5(ctx, t, D) {
    const box = { x: M, y: L.scTop, w: W - M * 2, h: H - L.scBottom - L.scTop };
    const cx = W / 2;

    const fitQ = fitLines(ctx, D.question || "", Math.min(860, box.w), 800, L.q);
    const lines = fitQ.lines, qs = fitQ.size;
    const blockH = L.ico + 44 + lines.length * qs * 1.24 + 46 + 29;
    let y = box.y + (box.h - blockH) / 2;

    const ia = seg(t, 18.28, .66), ie = backOut(ia, 2.3);
    if (ia > 0) {
      ctx.save();
      ctx.translate(cx, y + L.ico / 2 + 30 * (1 - ie));
      ctx.scale(ie, ie);
      glass(ctx, -L.ico / 2, -L.ico / 2, L.ico, L.ico, 36);
      const k = (D.icons && D.icons.question) || "chat-two-bubbles-oval";
      if (A[k]) ctx.drawImage(A[k], -L.icoImg / 2, -L.icoImg / 2, L.icoImg, L.icoImg);
      ctx.restore();
      neon(ctx, cx - L.ico / 2, y, L.ico, L.ico, 36, seg(t, 18.50, 1.4), 300, "#eaf0ff");
    }
    y += L.ico + 44;

    const qa = seg(t, 18.50, .7), qe = p3o(qa);
    if (qa > 0) {
      ctx.save();
      ctx.globalAlpha = qe;
      ctx.font = font(800, qs);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      shadow(ctx, "rgba(5,7,15,.9)", 26, 3);
      let ty = y + 30 * (1 - qe);
      lines.forEach((s) => { ctx.fillText(s, cx, ty); ty += qs * 1.24; });
      ctx.restore();
      noShadow(ctx);
      y += lines.length * qs * 1.24;
    }

    const ca = seg(t, 18.86, .55);
    if (ca > 0) {
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.font = font(600, 29);
      ctx.fillStyle = "#ffdd85";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("Tell us below", cx, y + 46 + 18 * (1 - p2o(ca)));
      ctx.restore();
    }
  }

  // ── صحنه ۶ — کارت پایانی ────────────────────────────────────
  function scene6(ctx, t) {
    const cx = W / 2, cy = H / 2 - 60;

    // لنز که می‌چرخد و باز می‌شود
    const la = seg(t, 21.46, .9), lo = seg(t, 22.10, .5);
    if (A.lens && la > 0 && lo < 1) {
      const e = backOut(la, 1.7);
      const sc = (.2 + .8 * e) * (1 + 1.6 * p2i(lo));
      ctx.save();
      ctx.globalAlpha = .9 * Math.min(1, la * 2) * (1 - lo);
      ctx.translate(cx, cy);
      ctx.rotate((-120 + 120 * e) * Math.PI / 180);
      ctx.scale(sc, sc);
      const s = 150;
      ctx.drawImage(A.lens, -s / 2, -s / 2, s, s);
      ctx.restore();
    }

    const ea = seg(t, 22.24, .75);
    if (ea > 0 && A.endLogo) {
      const e = backOut(ea, 1.6);
      const w = L.endLogo, h = A.endLogo.height * (w / A.endLogo.width);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ea * 2);
      ctx.translate(cx, cy);
      const sc = .86 + .14 * e;
      ctx.scale(sc, sc);
      ctx.drawImage(A.endLogo, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    const ra = p3o(seg(t, 22.70, .7));
    if (ra > 0) {
      const rw = 480 * ra, ry = cy + 150;
      const g = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
      g.addColorStop(0, "rgba(245,196,81,0)");
      g.addColorStop(.5, "#f5c451");
      g.addColorStop(1, "rgba(245,196,81,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - rw / 2, ry, rw, 2);
    }

    const ta = seg(t, 22.92, .6);
    if (ta > 0) {
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.font = font(600, 34);
      ctx.fillStyle = "#c7d3f2";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("Dubai property, decoded daily", cx, cy + 194 + 20 * (1 - p2o(ta)));
      ctx.restore();
    }
    const ua = seg(t, 23.14, .6);
    if (ua > 0) {
      ctx.save();
      ctx.globalAlpha = ua;
      ctx.font = font(600, 27);
      ctx.fillStyle = "#8593bb";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const y = cy + 194 + 34 + 22 + 16 * (1 - p2o(ua));
      const wdt = spacedWidth(ctx, "DUBILOOK.COM", 27 * .22);
      ctx.textAlign = "left";
      letterSpaced(ctx, "DUBILOOK.COM", cx - wdt / 2, y, 27 * .22);
      ctx.restore();
    }
  }

  // ── محو‌شدگی صحنه ───────────────────────────────────────────
  function sceneAlpha(t, s) {
    if (t < s.t || t >= s.t + s.d) return 0;
    const outAt = s.t + s.d - .34;
    if (t < outAt) return 1;
    return 1 - p2i((t - outAt) / .34);
  }

  function dimAlpha(t) {
    if (t < 10.10) return 0;
    if (t < 10.60) return .55 * p2io((t - 10.10) / .5);
    if (t < 14.20) return .55;
    if (t < 14.60) return .55 + .07 * ((t - 14.20) / .4);
    if (t < 18.20) return .62;
    if (t < 18.60) return .62 - .04 * ((t - 18.20) / .4);
    if (t < 21.30) return .58;
    if (t < 21.90) return .58 * (1 - p2io((t - 21.30) / .6));
    return 0;
  }

  // ── API ──────────────────────────────────────────────────────
  window.DUBILOOK_RENDERER = {
    duration: TOTAL,

    // src اختیاری است: نگاشت نام به data-URI، برای وقتی دارایی‌ها
    // داخل خود صفحه جاسازی شده‌اند (حالت Artifact). اگر نباشد،
    // از مسیرهای نسبی assets/ استفاده می‌شود (حالت گیت‌هاب).
    async init(D, layout, src) {
      L = LAYOUTS[layout === "full" ? "full" : "safe"];
      await loadFonts();

      const at = (name, fallback) => (src && src[name]) ? src[name] : fallback;

      const want = [["photo",   at("dubai-night", "assets/dubai-night.jpg")],
                    ["logo",    at("logo-light",  "assets/logo-light.png")],
                    ["endLogo", at("logo-light",  "assets/logo-light.png")],
                    ["lens",    at("logo-lens",   "assets/logo-lens.png")]];

      const icons = new Set();
      if (D && D.icons) Object.keys(D.icons).forEach((k) => D.icons[k] && icons.add(D.icons[k]));
      icons.add("chat-two-bubbles-oval");
      icons.forEach((n) => want.push([n, at(n, "assets/" + n + ".svg")]));

      await Promise.all(want.map(async ([key, url]) => { A[key] = await loadImg(url); }));

      bakeBackground();
      bakeGrain();

      // گزارش وضعیت، برای عیب‌یابی از سمت Scriptable
      try {
        window.__fontsOk = !!(document.fonts && document.fonts.check('800 76px PJS'));
      } catch (e) { window.__fontsOk = false; }
      window.__assetsOk = Object.keys(A).filter((k) => A[k]).length + "/" + Object.keys(A).length;
      return true;
    },

    draw(ctx, Wc, Hc, p, D) {
      const t = cl(p) * TOTAL;
      D = D || {};

      // بوم جهت متن را از صفحه به ارث می‌برد. اگر صفحه راست‌به‌چپ باشد،
      // نقطه و ویرگول و علامت سؤالِ متن انگلیسی به ابتدای سطر می‌پرند.
      try { ctx.direction = "ltr"; } catch (e) {}

      // پس‌زمینه
      if (bgBaked) ctx.drawImage(bgBaked, 0, 0);
      else { ctx.fillStyle = "#05070f"; ctx.fillRect(0, 0, W, H); }

      const da = dimAlpha(t);
      if (da > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "rgba(5,7,15,.30)");
        g.addColorStop(.45, "rgba(5,7,15,.55)");
        g.addColorStop(1, "rgba(5,7,15,.78)");
        ctx.save(); ctx.globalAlpha = da; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }

      if (grainPat) {
        ctx.save();
        ctx.globalAlpha = .05;
        ctx.globalCompositeOperation = "overlay";
        const pat = ctx.createPattern(grainPat, "repeat");
        ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      chrome(ctx, t, D);

      SC.forEach((s) => {
        const a = sceneAlpha(t, s);
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha = a;
        // هیچ چیزی نمی‌تواند از حاشیهٔ چپ و راست بیرون بزند، هر فونتی که بارگذاری شده باشد
        ctx.beginPath();
        ctx.rect(M - 14, 0, W - (M - 14) * 2, H);
        ctx.clip();
        if (s.id === 1) scene1(ctx, t, D);
        else if (s.id === 2) scene2(ctx, t, D);
        else if (s.id === 3) textScene(ctx, t, D, 3);
        else if (s.id === 4) textScene(ctx, t, D, 4);
        else if (s.id === 5) scene5(ctx, t, D);
        else if (s.id === 6) scene6(ctx, t);
        ctx.restore();
      });
    }
  };
})();
