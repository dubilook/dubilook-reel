// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_BADGE — the corner keyword badge (owner 2026-10-17 [stated], batch R68)
//  Replaces the «COMMENT X → WE'LL DM YOU THE SOURCE» pill on every image. A small gold tab flush in the
//  top-right corner: «COMMENT» small and letter-spaced above the keyword, no icon. Sizes and colours are
//  badge(0.68) of out/keyword-corner-1017/source-build3.py (approved sample B5-gold-68pct.jpg).
//  host.html draws it LAST on every 4:5 card that carries dm_keyword; the renderers keep the corner free
//  (the slide tag moves down while a badge is there).
//
//    window.DUBILOOK_BADGE.draw(ctx, keyword, W) → {x0, y0, x1, y1}
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";
  const GOLD = "#C9A24A", INK = "#0B0B0D";
  const S = 0.68, s = (v) => Math.floor(v * S);
  const PAD_T = s(30), PAD_R = s(44), PAD_B = s(26), PAD_L = s(40), RAD = s(40);
  const SMALL = s(20), SMALL_SP = s(5), GAP = s(10), BIG = s(64), BIG_SP = s(4);
  const font = (px) => "800 " + px + "px PJS, -apple-system, system-ui, sans-serif";
  // CSS letter-spacing: every glyph is followed by the spacing (the last one too)
  const spacedW = (ctx, t, sp) => [...t].reduce((a, c) => a + ctx.measureText(c).width + sp, 0);
  function spacedText(ctx, t, cx, y, sp) {
    let x = cx - spacedW(ctx, t, sp) / 2;
    for (const c of t) { ctx.fillText(c, x, y); x += ctx.measureText(c).width + sp; }
  }
  // the badge's size without drawing it
  function measure(ctx, keyword, W) {
    const kw = String(keyword).toUpperCase();
    ctx.save();
    ctx.font = font(SMALL); const ws = spacedW(ctx, "COMMENT", SMALL_SP);
    ctx.font = font(BIG); const wk = spacedW(ctx, kw, BIG_SP);
    ctx.restore();
    const w = Math.ceil(Math.max(ws, wk)) + PAD_L + PAD_R, h = PAD_T + SMALL + GAP + BIG + PAD_B;
    return { kw, x0: W - w, y0: 0, x1: W, y1: h, w, h };
  }
  function draw(ctx, keyword, W) {
    if (!keyword) return null;
    W = W || 1080;
    const b = measure(ctx, keyword, W);
    ctx.save();
    try { ctx.direction = "ltr"; } catch (e) {}
    // tab: square top and right (flush to the edges), rounded bottom-left, soft shadow (0 8px 28px rgba(0,0,0,.4))
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y0); ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x0 + RAD, b.y1);
    ctx.arcTo(b.x0, b.y1, b.x0, b.y1 - RAD, RAD); ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = INK;
    const cx = b.x0 + PAD_L + (b.w - PAD_L - PAD_R) / 2;
    // line boxes are line-height 1: the cap height of PJS 800 is ~0.72 em, centred in the em box
    ctx.font = font(SMALL); ctx.globalAlpha = 0.75;
    spacedText(ctx, "COMMENT", cx + SMALL_SP / 2, PAD_T + SMALL * 0.86, SMALL_SP);
    ctx.globalAlpha = 1;
    ctx.font = font(BIG);
    spacedText(ctx, b.kw, cx + BIG_SP / 2, PAD_T + SMALL + GAP + BIG * 0.86, BIG_SP);
    ctx.restore();
    return { x0: Math.round(b.x0), y0: 0, x1: W, y1: Math.round(b.y1) };
  }
  window.DUBILOOK_BADGE = { draw, measure, GOLD };
})();
