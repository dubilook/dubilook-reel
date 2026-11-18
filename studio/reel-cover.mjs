// Bundle 2a (OI-103, owner 18 Nov 2026): a reel ALWAYS gets a cover image. With a bank photo the cover is the hook
// over the photo, as before. Without one (no photo found, or the photo could not be fetched) the engine draws a
// TEMPLATE cover from the reel's own data: logo, kicker, hook, and the reel's figure when it has one. The site keeps
// a news reel without a cover image out of the queue (ReelCheck, log fix 11 Nov A6); this is what stops that hold.
export function reelCoverCard(d, photo = {}) {
  const n = d.statValue, has = n !== null && n !== undefined && n !== "" && Number.isFinite(Number(n));
  return {
    type: "reel-cover", title: d.hook || d.headline || "", label: d.kicker || "NEWS",
    // the figure is drawn only on the template cover (a photo cover stays the hook over the photo)
    stat: has ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "",
    stat_unit: has ? String(d.statUnit || "") : "", stat_label: has ? String(d.statLabelShort || d.statLabel || "") : "",
    ...photo,
  };
}
