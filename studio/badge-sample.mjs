// R68 samples: the corner keyword badge on every layout (3-letter + 6-letter keyword + none), Arabic, edu,
// carousel cover / content / end poster, and the reel's S5 frame — rendered through host.html renderCard exactly
// as render-job.mjs does, plus 00-contact-sheet.jpg.
//   node studio/badge-sample.mjs [outDir] [fixturesDir]
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "r68");
const fx = process.argv[3] || path.join(ROOT, "..", "out", "cta-photo-1017", "fixtures");
const jpgs = fs.readdirSync(fx).filter((n) => /\.jpe?g$/i.test(n)).sort();
const dataUrl = (n) => "data:image/jpeg;base64," + fs.readFileSync(path.join(fx, n)).toString("base64");
const BRIGHT = dataUrl(jpgs.find((n) => /burj/i.test(n)) || jpgs[0]), DARK = dataUrl(jpgs.find((n) => !/burj/i.test(n)) || jpgs[1]);

const news = { type: "news", category: "property", headline: "Etihad Rail passenger trains to link Abu Dhabi and Dubai in 2026", red: ["Etihad Rail"],
  summary: "The operator says trips between the two cities will take about 57 minutes.", angle: "Commuters get a fixed-time option.",
  source: "KHALEEJ TIMES", date: "2026-10-16", photo_credit: "Photo: test fixture" };
const LAY = [
  ["nophoto", "post", { ...news }],
  ["panel-bottom", "post", { ...news, layout: "panel", photo_side: "bottom", photo: BRIGHT }],
  ["panel-top", "post", { ...news, layout: "panel", photo_side: "top", photo: DARK }],
  ["bar", "post", { ...news, layout: "bar", photo: BRIGHT }],
  ["overlay", "post", { ...news, layout: "overlay", photo: DARK }],
  ["split", "post", { ...news, photo_mode: "split", photo: BRIGHT }],
  ["arabic", "ar", { type: "news", category: "property", headline: "قطار الاتحاد يربط أبوظبي ودبي في 2026", red: ["قطار الاتحاد"], summary: "الرحلة بين المدينتين حوالي 57 دقيقة.", source: "KHALEEJ TIMES", date: "2026-10-16" }],
  ["edu-law", "edu", { type: "law", headline: "Your landlord needs 12 months notice", red: ["12 months"], body: "Notice must go by notary or registered mail.", ref: "Law No. 26 of 2007", source: "DLD" }],
  ["carousel-cover", "post", { type: "cover", title: "Five things that moved Dubai property this week", date: "2026-10-16", hooks: ["Ejari goes digital", "Rail link dates", "Service fees index"], of: 7 }],
  ["carousel-content", "post", { ...news, slide: { n: 3, of: 7 } }],
];
const KWS = [["bay", "Bay"], ["tenant", "Tenant"], ["none", null]];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
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
const tiles = [];
for (const [name, kind, card] of LAY) for (const [kn, kw] of KWS) {
  const url = await page.evaluate(([k, c]) => window.renderCard(k, c, 0.92), [kind, kw ? { ...card, dm_keyword: kw } : card]);
  const fn = `${name}-${kn}.jpg`;
  fs.writeFileSync(path.join(outDir, fn), Buffer.from(url.split(",")[1], "base64"));
  tiles.push([fn, url]);
}
const poster = "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "assets", "end-poster.jpg")).toString("base64");
fs.copyFileSync(path.join(ROOT, "assets", "end-poster.jpg"), path.join(outDir, "carousel-end-poster.jpg"));
tiles.push(["carousel-end-poster.jpg", poster]);
// the reel: S5 with the badge (keyword) at 20.0 s, and without
const REEL = { kicker: "UAE PROPERTY NEWS", hook: "Ejari registration goes fully digital", hookGold: "fully digital", sub: "No more typing centres for tenancy contracts",
  statLabelShort: "contracts online", chart: null, statValue: 12000, statUnit: "contracts", statLabel: "registered online this quarter",
  detail: "Dubai Land Department moved tenancy registration to its app.", takeaway: "Ask your agent to register your Ejari online.",
  question: "Would you register your lease online?", icons: [], source: "GULF NEWS", date: "15 OCT 2026" };
const reelTiles = [];
for (const [kn, kw] of [["tenant", "Tenant"], ["none", null]]) {
  const p2 = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  p2.on("pageerror", (e) => console.error("reel page error:", e.message));
  await p2.addInitScript("window.DATA = " + JSON.stringify(kw ? { ...REEL, dm_keyword: kw } : REEL) + ";");
  await p2.goto(pathToFileURL(path.join(ROOT, "reel.html")).href + "?layout=instagram");
  await p2.waitForFunction("window.READY === true", null, { timeout: 30000 });
  await p2.evaluate(([tt]) => (window.SEEKF ? window.SEEKF(tt, Math.round(tt * 30)) : window.SEEK(tt)), [20.0]);
  const fn = `reel-s5-${kn}.jpg`;
  await p2.screenshot({ type: "jpeg", quality: 90, path: path.join(outDir, fn) });
  reelTiles.push([fn, "data:image/jpeg;base64," + fs.readFileSync(path.join(outDir, fn)).toString("base64")]);
  await p2.close();
}
// contact sheet: 3 columns (bay / tenant / none) per layout, then poster + reel frames
const sheet = await page.evaluate(async ([t, rt]) => {
  const TW = 360, TH = 450, LB = 30, cols = 3;
  const rows = Math.ceil(t.length / cols) + 1;
  const c = document.createElement("canvas"); c.width = cols * TW; c.height = rows * (TH + LB) + 640 + LB; const g = c.getContext("2d");
  g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
  const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); return im; };
  for (const [i, [n, u]] of t.entries()) {
    const x = (i % cols) * TW, y = Math.floor(i / cols) * (TH + LB);
    g.drawImage(await load(u), x, y + LB, TW, TH);
    g.fillStyle = "#fff"; g.font = "600 17px sans-serif"; g.fillText(n, x + 8, y + 21);
  }
  const y0 = Math.ceil(t.length / cols) * (TH + LB);
  for (const [i, [n, u]] of rt.entries()) {
    g.drawImage(await load(u), i * TW, y0 + LB, TW, 640);
    g.fillStyle = "#fff"; g.font = "600 17px sans-serif"; g.fillText(n, i * TW + 8, y0 + 21);
  }
  return c.toDataURL("image/jpeg", 0.85);
}, [tiles.map(([n, u]) => [n, u]), reelTiles]);
fs.writeFileSync(path.join(outDir, "00-contact-sheet.jpg"), Buffer.from(sheet.split(",")[1], "base64"));
await browser.close(); server.close();
console.log(`${tiles.length + reelTiles.length} samples + 00-contact-sheet.jpg → ${outDir}`);
