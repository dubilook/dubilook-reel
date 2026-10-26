// ═══════════════════════════════════════════════════════════════
//  DUBILOOK_BADGE — the corner keyword badge (owner 2026-10-17 [stated], batch R68)
//  Replaces the «COMMENT X → WE'LL DM YOU THE SOURCE» pill on every image. A small gold tab flush in a
//  top corner: «COMMENT» small and letter-spaced above the keyword, no icon. Sizes and colours are
//  badge(0.68) of out/keyword-corner-1017/source-build3.py (approved sample B5-gold-68pct.jpg).
//  Fix pack 1.5 #9 (owner 2026-10-26): the corner is the top-LEFT — Instagram's own «4/6» counter overlays the
//  top-right corner of a carousel and hid the keyword. The tab is mirrored (square top-left, rounded bottom-right);
//  the logo is centred and the category pill sits lower, so nothing collides (test-keyword-badge.mjs checks the boxes).
//  host.html draws it LAST on every 4:5 card that carries dm_keyword; the slide tag («4 / 6», top-right) stays
//  where it was (owner 2026-10-26: keep our own counter).
//
//    window.DUBILOOK_BADGE.draw(ctx, keyword, W) → {x0, y0, x1, y1}
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";
  const GOLD = "#C9A24A", INK = "#0B0B0D";
  const S = 0.68, s = (v) => Math.floor(v * S);
  const PAD_T = s(30), PAD_L = s(44), PAD_B = s(26), PAD_R = s(40), RAD = s(40);   // the flush edge (left) gets the wider pad
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
    return { kw, x0: 0, y0: 0, x1: w, y1: h, w, h };
  }
  function draw(ctx, keyword, W) {
    if (!keyword) return null;
    W = W || 1080;
    const b = measure(ctx, keyword, W);
    ctx.save();
    try { ctx.direction = "ltr"; } catch (e) {}
    // tab: square top and left (flush to the edges), rounded bottom-right, soft shadow (0 8px 28px rgba(0,0,0,.4))
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y0); ctx.lineTo(b.x1, b.y1 - RAD);
    ctx.arcTo(b.x1, b.y1, b.x1 - RAD, b.y1, RAD); ctx.lineTo(b.x0, b.y1); ctx.closePath(); ctx.fill();
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
    return { x0: 0, y0: 0, x1: Math.round(b.x1), y1: Math.round(b.y1) };
  }
  window.DUBILOOK_BADGE = { draw, measure, GOLD };
})();
