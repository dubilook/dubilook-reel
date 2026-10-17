// Keyword CTA pill on PHOTO news cards (batch 2026-10-17 PART 1). Items 268 (bar) and 273 (panel) carried
// dm_keyword but no pill: drawCard() only drew it in the no-photo branch.
// For every photo layout (panel photo-bottom / panel photo-top / bar / overlay / split) × short + long keyword:
//   1. the card WITH a keyword differs from the card WITHOUT one (the pill is drawn)
//   2. the pill box never touches the headline block, the footer (source line + disclaimer) or the bar strip
//   3. without a keyword nothing is recorded as a pill (old pixel path)
//   node studio/test-cta-photo.mjs <fixturesDir with 2 jpgs> [outDir]
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = process.argv[2] || path.join(ROOT, "..", "out", "cta-photo-1017", "fixtures");
const outDir = process.argv[3] || path.join(ROOT, "..", "out", "cta-photo-1017");
const jpgs = fs.readdirSync(fx).filter((n) => /\.jpe?g$/i.test(n)).sort();
if (jpgs.length < 2) { console.error("need 2 jpgs in " + fx); process.exit(2); }
const dataUrl = (n) => "data:image/jpeg;base64," + fs.readFileSync(path.join(fx, n)).toString("base64");
const BRIGHT = dataUrl(jpgs.find((n) => /burj/i.test(n)) || jpgs[0]), DARK = dataUrl(jpgs.find((n) => !/burj/i.test(n)) || jpgs[1]);

const base = { type: "news", category: "property", headline: "Etihad Rail passenger trains to link Abu Dhabi and Dubai in 2026", red: ["Etihad Rail"],
  summary: "The operator says trips between the two cities will take about 57 minutes.", angle: "Commuters get a fixed-time option.",
  source: "KHALEEJ TIMES", date: "2026-10-16", photo_credit: "Photo: test fixture" };
const LAYOUTS = [
  ["panel-photo-bottom", { layout: "panel", photo_side: "bottom", photo: BRIGHT }],
  ["panel-photo-top", { layout: "panel", photo_side: "top", photo: DARK }],
  ["bar", { layout: "bar", photo: BRIGHT }],
  ["overlay", { layout: "overlay", photo: DARK }],
  ["split", { photo_mode: "split", photo: BRIGHT }],
  ["nophoto-control", {}],
];
const KW = [["short", "Rail"], ["long", "Registrations"]];

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
fs.mkdirSync(outDir, { recursive: true });

// render in the page, return the jpeg + the pixel count that differs from a reference render + the recorded boxes
const render = (card, ref) => page.evaluate(([c, r]) => {
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  const g = cv.getContext("2d"); window.DUBILOOK_POSTS.draw(g, c, 1350);
  const boxes = typeof window.DUBILOOK_POSTS.boxes === "function" ? window.DUBILOOK_POSTS.boxes() : null;
  const px = g.getImageData(0, 0, 1080, 1350).data;
  let diff = 0;
  if (r) { const rc = document.createElement("canvas"); rc.width = 1080; rc.height = 1350; const rg = rc.getContext("2d");
    window.DUBILOOK_POSTS.draw(rg, r, 1350); const q = rg.getImageData(0, 0, 1080, 1350).data;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - q[i]) + Math.abs(px[i + 1] - q[i + 1]) + Math.abs(px[i + 2] - q[i + 2]) > 30) diff++; }
  return { jpg: cv.toDataURL("image/jpeg", 0.9), diff, boxes };
}, [card, ref]);

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log("  ✗ " + msg); } };
const hit = (a, b) => a.y0 < b.y1 && b.y0 < a.y1 && (a.x0 ?? 0) < (b.x1 ?? 1080) && (b.x0 ?? 0) < (a.x1 ?? 1080);
const sheet = [];
for (const [name, extra] of LAYOUTS) {
  const plain = { ...base, ...extra };
  const r0 = await render(plain, null);
  fs.writeFileSync(path.join(outDir, `${name}-none.jpg`), Buffer.from(r0.jpg.split(",")[1], "base64")); sheet.push(`${name}-none`);
  ok(!r0.boxes || !r0.boxes.some((b) => b.k === "pill"), `${name}: no keyword must draw no pill`);
  for (const [kn, kw] of KW) {
    const r = await render({ ...plain, dm_keyword: kw }, plain);
    fs.writeFileSync(path.join(outDir, `${name}-${kn}.jpg`), Buffer.from(r.jpg.split(",")[1], "base64")); sheet.push(`${name}-${kn}`);
    ok(r.diff > 8000, `${name}/${kn}: card with keyword "${kw}" looks the same as without (${r.diff} px differ) — no pill`);
    if (!r.boxes) { ok(false, `${name}/${kn}: renderer exposes no boxes() — overlap cannot be checked`); continue; }
    const pill = r.boxes.find((b) => b.k === "pill");
    ok(!!pill, `${name}/${kn}: no pill box recorded`);
    if (!pill) continue;
    ok(pill.x0 >= 0 && pill.x1 <= 1080 && pill.y0 >= 0 && pill.y1 <= 1350, `${name}/${kn}: pill outside the card ${JSON.stringify(pill)}`);
    for (const b of r.boxes.filter((b) => b.k !== "pill"))
      ok(!hit(pill, b), `${name}/${kn}: pill ${JSON.stringify(pill)} overlaps ${b.k} ${JSON.stringify(b)}`);
  }
}
// contact sheet: one row per layout (none · short · long)
const tiles = sheet.map((n) => "data:image/jpeg;base64," + fs.readFileSync(path.join(outDir, n + ".jpg")).toString("base64"));
const sh = await page.evaluate(async (list) => {
  const c = document.createElement("canvas"), tw = 300, th = 375; c.width = tw * 3; c.height = th * (list.length / 3);
  const g = c.getContext("2d");
  for (let i = 0; i < list.length; i++) { const im = new Image(); await new Promise((r) => { im.onload = r; im.src = list[i]; });
    g.drawImage(im, (i % 3) * tw, Math.floor(i / 3) * th, tw, th); }
  return c.toDataURL("image/jpeg", 0.85);
}, tiles);
fs.writeFileSync(path.join(outDir, "00-contact-sheet.jpg"), Buffer.from(sh.split(",")[1], "base64"));
await browser.close(); server.close();
console.log(`${checks - fails}/${checks} checks passed → ${outDir}`);
process.exit(fails ? 1 : 0);
