// Corner keyword badge (batch R68 PART 1, owner 2026-10-17 [stated]): the «COMMENT X → WE'LL DM YOU THE SOURCE» pill
// is gone; a small gold tab sits flush in the top-right corner (B5-gold-68pct.jpg). Rendered through host.html
// renderCard exactly as render-job.mjs does, for every 4:5 layout × a 3-letter and a 6-letter keyword:
//   1. with a keyword: badge box flush top-right (x1 = 1080, y0 = 0), ~99 px high, gold #C9A24A inside
//   2. every pixel that changes against the same card WITHOUT a keyword lies inside the badge (+ shadow) or the slide tag
//      (it moves down below the badge) — no pill elsewhere
//   3. the badge never touches the logo, slide tag, kicker, headline block, footer or bar strip (renderer boxes)
//   4. without a keyword: no badge recorded, the corner is not gold
//   node studio/test-keyword-badge.mjs [fixturesDir with 2 jpgs]
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = process.argv[2] || path.join(ROOT, "..", "out", "cta-photo-1017", "fixtures");
const jpgs = fs.readdirSync(fx).filter((n) => /\.jpe?g$/i.test(n)).sort();
if (jpgs.length < 2) { console.error("need 2 jpgs in " + fx); process.exit(2); }
const dataUrl = (n) => "data:image/jpeg;base64," + fs.readFileSync(path.join(fx, n)).toString("base64");
const BRIGHT = dataUrl(jpgs.find((n) => /burj/i.test(n)) || jpgs[0]), DARK = dataUrl(jpgs.find((n) => !/burj/i.test(n)) || jpgs[1]);

const news = { type: "news", category: "property", headline: "Etihad Rail passenger trains to link Abu Dhabi and Dubai in 2026", red: ["Etihad Rail"],
  summary: "The operator says trips between the two cities will take about 57 minutes.", angle: "Commuters get a fixed-time option.",
  source: "KHALEEJ TIMES", date: "2026-10-16", photo_credit: "Photo: test fixture" };
const CASES = [
  ["post-nophoto", "post", { ...news }],
  ["post-panel-photo-bottom", "post", { ...news, layout: "panel", photo_side: "bottom", photo: BRIGHT }],
  ["post-panel-photo-top", "post", { ...news, layout: "panel", photo_side: "top", photo: DARK }],
  ["post-bar", "post", { ...news, layout: "bar", photo: BRIGHT }],
  ["post-overlay", "post", { ...news, layout: "overlay", photo: DARK }],
  ["post-split", "post", { ...news, photo_mode: "split", photo: BRIGHT }],
  ["carousel-cover", "post", { type: "cover", title: "Five things that moved Dubai property this week", date: "2026-10-16", hooks: ["Ejari goes digital", "Rail link dates", "Service fees index"], of: 7 }],
  ["carousel-content", "post", { ...news, slide: { n: 3, of: 7 } }],
  ["arabic-post", "ar", { type: "news", category: "property", headline: "قطار الاتحاد يربط أبوظبي ودبي في 2026", red: ["قطار الاتحاد"], summary: "الرحلة بين المدينتين حوالي 57 دقيقة.", source: "KHALEEJ TIMES", date: "2026-10-16" }],
  ["edu-law", "edu", { type: "law", headline: "Your landlord needs 12 months notice", red: ["12 months"], body: "Notice must go by notary or registered mail.", ref: "Law No. 26 of 2007", source: "DLD" }],
  ["edu-list-item", "edu", { type: "list-item", n: 2, title: "Check the title deed", body: "Ask for the DLD title deed and match the owner's name.", slide: { n: 3, of: 6 } }],
];
const KW = [["3", "Bay"], ["6", "Tenant"]];
const GUARD = ["brand", "slide", "kicker", "head", "foot", "strip"];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/studio/host.html`);
await page.evaluate(() => window.ready);
for (const u of [BRIGHT, DARK]) await page.evaluate((x) => window.DUBILOOK_POSTS.photo(x), u);

// renderCard (the production path) twice — with and without the keyword — and compare in the page
const run = (kind, card, kw) => page.evaluate(async ([k, c, w]) => {
  const pix = async (url) => { const im = new Image(); im.src = url; await im.decode();
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
  const withKw = window.renderCard(k, { ...c, dm_keyword: w }, 0.95);
  const lr = window.lastRender || {};
  const badge = lr.badge || null, boxes = lr.boxes || [];
  const plain = window.renderCard(k, c, 0.95);
  const plainBadge = (window.lastRender || {}).badge || null;
  const A = await pix(withKw), B = await pix(plain);
  let outside = 0, first = null;
  const pad = 44;
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    const i = (y * A.w + x) * 4;
    if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) <= 40) continue;
    const inBadge = badge && x >= badge.x0 - pad && y <= badge.y1 + pad;
    // the carousel slide tag («3 / 7») moves down below the badge — that box may change too
    const inSlide = boxes.some((b) => b.k === "slide" && x >= b.x0 - 4 && x <= b.x1 + 4 && y >= b.y0 - 4 && y <= b.y1 + 4);
    if (!inBadge && !inSlide) { outside++; if (!first) first = [x, y]; }
  }
  const at = (P, x, y) => { const i = (y * P.w + x) * 4; return [P.d[i], P.d[i + 1], P.d[i + 2]]; };
  const gold = badge ? at(A, badge.x0 + 10, 8) : null;
  const corner = at(B, A.w - 12, 8);
  return { badge, boxes, plainBadge, outside, first, gold, corner };
}, [kind, card, kw]);

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const isGold = (p) => p && Math.abs(p[0] - 0xC9) < 30 && Math.abs(p[1] - 0xA2) < 30 && Math.abs(p[2] - 0x4A) < 30;
const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
for (const [name, kind, card] of CASES) {
  for (const [len, kw] of KW) {
    const r = await run(kind, card, kw), tag = `${name} kw${len}`;
    ok(r.badge && r.badge.x1 === 1080 && r.badge.y0 === 0, `${tag}: no badge flush top-right: ${JSON.stringify(r.badge)}`);
    ok(r.badge && r.badge.y1 >= 90 && r.badge.y1 <= 110 && r.badge.x1 - r.badge.x0 >= 110 && r.badge.x1 - r.badge.x0 <= 300, `${tag}: badge size off: ${JSON.stringify(r.badge)}`);
    ok(isGold(r.gold), `${tag}: badge not gold: ${r.gold}`);
    ok(r.outside === 0, `${tag}: ${r.outside} px changed outside the badge (first at ${r.first}) — a pill is still drawn`);
    const clash = r.badge ? r.boxes.filter((b) => GUARD.includes(b.k) && hit(r.badge, b)) : [];
    ok(r.badge && !clash.length, `${tag}: badge touches ${JSON.stringify(clash)}`);
    ok(r.boxes.some((b) => b.k === "brand"), `${tag}: renderer recorded no logo box`);
    ok(!r.plainBadge && !isGold(r.corner), `${tag}: card WITHOUT keyword has a badge / gold corner`);
  }
  console.log(`  ${name} done`);
}
await browser.close(); server.close();
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
