// Daily PDF digest "Dubai Property Today" (IG-COMMENT-DM, design APPROVED 2026-10-15: docs/pdf-digest-design.md +
// docs/pdf-digest-template.html). Pure functions data → HTML; render-job.mjs prints the PDF with Chromium (full CSS,
// real Arabic shaping) and screenshots the 20:00 post image.
//
// data = { date: "2026-10-16", date_label: "Friday, 16 October 2026", short_date: "16 Oct 2026", year: 2026,
//          keyword: "Marina", prepared_for: null|"handle",
//          figures: [{ value, unit, label }] (0–3, only real numbers from the day's items; none → no strip),
//          cards: [{ lang: "en"|"ar", tag, headline, summary, source, hero: dataURL|null, hero_shape: "4:5"|"9:16",
//                    source_url|null, instagram_url, reel_url|null }] }
// Owner rule 16 Oct 12:15 [stated]: on a dark background the dark-background logo (white letters, no plate);
// on the light page the light-background logo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = (f) => path.join(ROOT, "assets", f);
const parts = JSON.parse(fs.readFileSync(A("digest/parts.json"), "utf8"));
const css = fs.readFileSync(A("digest/digest.css"), "utf8");
const fonts = fs.readFileSync(A("digest/fonts.css"), "utf8");
const png = (f) => "data:image/png;base64," + fs.readFileSync(A(f)).toString("base64");
const LOGO_DARK_BG = png("logo-dark-bg.png");     // white letters → navy masthead / post
const LOGO_LIGHT_BG = png("logo-light-bg.png");   // black letters → light running heads

/** "2026-10-16" → "Friday, 16 October 2026" (the digest's OWN day, never the render day). */
export function dateLabelOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c]));
const PAGE1_CELLS = 2, PAGE_CELLS = 4;

// R6: 4:5 heroes fill the box, 9:16 (stories, reel covers) are shown whole on navy; no image → a calm block with the tag.
const EXTRA_CSS = `
.hero{background:linear-gradient(160deg,#1d3b5c 55%,#2c4f73)}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.hero.tall{background:var(--ink)} .hero.tall img{object-fit:contain}
.hero .none{position:absolute;inset:0;display:grid;place-items:center;font-family:PlexCond;font-weight:700;font-size:13pt;color:rgba(255,255,255,.18);letter-spacing:.06em}
.acts.one{grid-template-columns:1fr}
`;

function card(c) {
  const rtl = c.lang === "ar" ? ' dir="rtl" lang="ar"' : "";
  const hero = c.hero
    ? `<div class="hero${c.hero_shape === "9:16" ? " tall" : ""}"><img src="${esc(c.hero)}" alt=""><span class="tag">${esc(c.tag)}</span></div>`
    : `<div class="hero"><span class="none">DUBILOOK</span><span class="tag">${esc(c.tag)}</span></div>`;
  const src = c.source_url ? `<a class="btn red" href="${esc(c.source_url)}"><span>Read source</span>${parts.icons.arrow}</a>` : "";
  const ig = `<a class="btn ghost" href="${esc(c.instagram_url || "https://www.instagram.com/dubilook")}">${parts.icons.ig}<span>Instagram</span></a>`;
  const reel = c.reel_url ? `<a class="btn ghost wide" href="${esc(c.reel_url)}">${parts.icons.play}<span>Watch the reel</span></a>` : "";
  return `<article class="card">${hero}<div class="body">
  <h3${rtl}>${esc(c.headline)}</h3>
  ${c.summary ? `<p class="sum"${rtl}>${esc(c.summary)}</p>` : ""}
  ${c.source ? `<p class="src">${esc(c.source)}</p>` : ""}
  <div class="acts${src ? "" : " one"}">${src}${ig}</div>
  ${reel}
 </div></article>`;
}

function closing(d) {
  const legal = parts.legal.replace(/© \d{4} Dubilook/, `© ${esc(d.year)} Dubilook`);
  return `<aside class="endcol"><div class="close"><h4>Get the next file too</h4><p class="lead">Most evenings at 8 pm we post a new one (not on days with fewer than four stories). Comment its keyword and we send that file to your inbox.</p>${parts.socs}</div>
  ${legal}</aside>`;
}

/** Splits the cells (cards + the closing block) into pages: 2 under the masthead, then 4 a page. */
export function paginate(cells) {
  const pages = [cells.slice(0, PAGE1_CELLS)];
  for (let i = PAGE1_CELLS; i < cells.length; i += PAGE_CELLS) pages.push(cells.slice(i, i + PAGE_CELLS));
  return pages;
}

export function digestHtml(d) {
  const cells = [...d.cards.map(card), closing(d)];
  const pages = paginate(cells);
  const n = pages.length;
  const run = (k) => `<footer class="run"><span>Dubilook, your daily property briefing</span><span>Page ${k + 1} of ${n}</span></footer>`;
  const figures = (d.figures || []).slice(0, 3);
  const ledger = figures.length
    ? `<p class="ledger-cap">The day in ${figures.length === 1 ? "one figure" : figures.length === 2 ? "two figures" : "three figures"}</p>
 <div class="ledger" style="grid-template-columns:repeat(${figures.length},1fr)">${figures.map((f) => `<div><strong>${esc(f.value)}</strong><em>${esc(f.unit)}</em><span>${esc(f.label)}</span></div>`).join("")}</div>`
    : `<div style="height:4mm"></div>`;
  const stories = `${d.cards.length} ${d.cards.length === 1 ? "story" : "stories"}`;
  const sheets = pages.map((cells, k) => k === 0
    ? `<section class="sheet">
 <header class="mast">
  <div class="row"><span class="logo"><img src="${LOGO_DARK_BG}" alt="Dubilook"></span><span class="edition">Evening edition</span></div>
  <h1>Dubai Property<br>Today</h1>
  <div class="dateline"><b>${esc(d.date_label)}</b><span>${stories}</span></div>
  ${d.prepared_for ? `<div class="for"><i>@</i><span>Prepared for <b>@${esc(d.prepared_for)}</b></span></div>` : ""}
 </header>
 ${ledger}
 <div class="grid">${cells.join("")}</div>
 ${run(k)}
</section>`
    : `<section class="sheet">
 <div class="runhead"><img class="rlogo" src="${LOGO_LIGHT_BG}" alt="Dubilook"><span>Dubai Property Today, ${esc(d.short_date)}</span></div>
 <div class="grid">${cells.join("")}</div>
 ${run(k)}
</section>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dubai Property Today, ${esc(d.date_label)}</title>
<style>${fonts}${css}${EXTRA_CSS}</style></head><body>
${sheets.join("\n")}
</body></html>`;
}

// ── the 20:00 Instagram post (4:5, 1080×1350): "comment KEYWORD → we DM you today's PDF" ──
// DRAFT — shown to the owner before the switch goes on (prompt 2026-10-16 small batch, PART 3).
export function postHtml(d) {
  // Owner 16 Oct 14:10 [stated]: the thumbnails are three DIFFERENT stories of the day — never one story twice (a news
  // post and its carousel slide, its Arabic post or its reel share a `story` key); fewer distinct stories → fewer tiles.
  const seen = new Set(), thumbs = [];
  for (const c of d.cards) {
    const key = c.story || c.source_url || c.headline;
    if (!c.hero || seen.has(key)) continue;
    seen.add(key); thumbs.push(c);
    if (thumbs.length === 3) break;
  }
  const dateLabel = d.date_label || dateLabelOf(d.date);
  const kw = esc(String(d.keyword || "").toUpperCase());
  const grid = thumbs.length
    ? `<div class="thumbs n${thumbs.length}">${thumbs.map((c) => `<div class="th${c.hero_shape === "9:16" ? " tall" : ""}"><img src="${esc(c.hero)}" alt=""></div>`).join("")}</div>`
    : `<div class="thumbs n0"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden}
body{background:#12263a;color:#fff;font-family:Plex,sans-serif;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(900px 600px at 85% 0%,rgba(227,6,19,.22),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(70,120,170,.25),transparent 60%)}
.top{position:absolute;left:84px;right:84px;top:76px;display:flex;justify-content:space-between;align-items:center}
.top img{height:64px;display:block}
.top span{font-size:24px;color:#b9c7d6;letter-spacing:.08em;text-transform:uppercase}
h1{position:absolute;left:84px;top:178px;font-family:PlexCond;font-weight:700;font-size:118px;line-height:.95;letter-spacing:-.01em}
.date{position:absolute;left:84px;top:430px;font-size:34px;color:#d5dfe9}
.date b{color:#fff;font-weight:600}
.thumbs{position:absolute;left:84px;right:84px;top:505px;display:flex;justify-content:center;gap:24px}
.th{position:relative;width:288px;aspect-ratio:4/5;border-radius:18px;overflow:hidden;background:#0b1a29;box-shadow:0 18px 40px rgba(0,0,0,.35)}
.th img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.th.tall img{object-fit:contain}
.pdf{position:absolute;left:84px;top:900px;font-size:30px;color:#c8d4e0}
.pill{position:absolute;left:84px;right:84px;top:968px;background:#e30613;border-radius:26px;padding:34px 40px;font-family:PlexCond;font-weight:700;font-size:56px;line-height:1.05;letter-spacing:.01em;box-shadow:0 20px 50px rgba(227,6,19,.35)}
.pill u{text-decoration-thickness:6px;text-underline-offset:10px}
.foot{position:absolute;left:84px;right:84px;bottom:58px;display:flex;justify-content:space-between;font-size:24px;color:#9fb0c2}
</style></head><body><div class="glow"></div>
<div class="top"><img src="${LOGO_DARK_BG}" alt="Dubilook"><span>Evening edition</span></div>
<h1>Dubai Property<br>Today</h1>
<div class="date"><b>${esc(dateLabel)}</b> · ${d.cards.length} stories in one PDF</div>
${grid}
<div class="pdf">${d.cards.every((c) => c.source_url) ? "Today's stories with their source links" : "Today's stories"} — in one file.</div>
<div class="pill">COMMENT <u>${kw}</u> → WE'LL DM YOU TODAY'S PDF</div>
<div class="foot"><span>Most evenings at 8 pm</span><span>@dubilook</span></div>
</body></html>`;
}
