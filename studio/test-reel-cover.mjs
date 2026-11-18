// Bundle 2a (OI-103, owner 18 Nov 2026): a reel always gets a cover image. Without a photo (none found, or it cannot
// be fetched) the engine draws a TEMPLATE cover from the reel's own data, so the site no longer holds the reel as
// failed («reel has no cover image», log fix 11 Nov A6). A photo cover is exactly as before.
//   node studio/test-reel-cover.mjs            (writes the samples to the temp folder, or to REEL_COVER_OUT)
import { chromium } from "playwright-core";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reelCoverCard } from "./reel-cover.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };

// 1) the card the job sends
const reel = { kicker: "BUYOUT", hook: "15 Dirham A Share: Emaar's Buyout Offer", statValue: 11.9, statUnit: "Billion Dirham", statLabelShort: "EMAAR BUYOUT OFFER", statLabel: "Cost to buy remaining shares" };
const chart = { kicker: "OFFICE MARKET", hook: "Dubai Office Vacancy Falls To Just 5.9%", statValue: null, statUnit: null, statLabelShort: "OFFICE VACANCY Q3 26", chart: { unit: "%", bars: [] } };
const c1 = reelCoverCard(reel), c2 = reelCoverCard(chart), c3 = reelCoverCard(reel, { photo: "https://x/p.jpg", photo_credit: "Photo: X" });
ok(c1.type === "reel-cover" && c1.title === reel.hook && c1.label === "BUYOUT", "the card keeps the hook and the kicker");
ok(c1.stat === "11.9" && c1.stat_unit === "Billion Dirham" && c1.stat_label === "EMAAR BUYOUT OFFER", "the figure of the reel is on the card: " + JSON.stringify(c1));
ok(c2.stat === "" && c2.stat_unit === "" && c2.stat_label === "", "a chart reel has no single figure: none is invented");
ok(c3.photo === "https://x/p.jpg" && c3.photo_credit === "Photo: X", "a photo cover carries its photo");
ok(reelCoverCard({ headline: "Only a headline" }).title === "Only a headline" && reelCoverCard({}).label === "NEWS", "fallbacks: headline, NEWS");
ok(reelCoverCard({ hook: "x", statValue: 1250000 }).stat === "1,250,000", "a big figure is grouped");

// 2) the job itself: the cover is no longer inside `if (d.photo)`
const job = fs.readFileSync(path.join(ROOT, "studio/render-job.mjs"), "utf8");
ok(/await still\("post-story", reelCoverCard\(d, photoOf\(d\)\), f\("cover\.jpg"\)\);\s*await upload\(it\.id, 21, "image", f\("cover\.jpg"\), \{ variant: "cover", template: !d\.photo \}\);/.test(job), "render-job always renders and uploads the cover");
ok(!/if \(d\.photo\) \{\s*await still\("post-story", \{ type: "reel-cover"/.test(job), "the old photo-only branch is gone");

// 3) the picture: rendered the way render-job does (host.html over a local server)
const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream"); res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/studio/host.html`);
await page.evaluate(() => window.ready);
const out = process.env.REEL_COVER_OUT || path.join(os.tmpdir(), "dubilook-reel-cover"); fs.mkdirSync(out, { recursive: true });
// how much of a band is lit, and how much of it is brand red
const band = (dataUrl, y0, y1) => page.evaluate(async ([u, a, b]) => { const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, a, im.width, b - a).data; let lit = 0, red = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i] > 180 && d[i + 1] > 180 && d[i + 2] > 180) lit++; if (d[i] > 180 && d[i + 1] < 70 && d[i + 2] < 70) red++; }
  return { w: im.width, h: im.height, lit, red }; }, [dataUrl, y0, y1]);
const shot = async (name, card) => { const u = await page.evaluate(([c]) => window.renderCard("post-story", c, 0.92), [card]);
  fs.writeFileSync(path.join(out, name), Buffer.from(u.split(",")[1], "base64")); return u; };

const a = await shot("template-with-figure.jpg", c1);
const head = await band(a, 560, 1130), fig = await band(a, 1180, 1300), unit = await band(a, 1310, 1410);
ok(head.w === 1080 && head.h === 1920, "the cover is 1080 x 1920, got " + head.w + " x " + head.h);
ok(head.lit > 20000, "the hook is drawn (white pixels in the headline band: " + head.lit + ")");
ok(fig.red > 8000, "the figure is drawn in brand red (red pixels: " + fig.red + ")");
ok(unit.lit > 1500, "the unit is drawn under it (white pixels: " + unit.lit + ")");

const b = await shot("template-no-figure.jpg", c2);
const head2 = await band(b, 560, 1380), fig2 = await band(b, 1180, 1300);
ok(head2.lit > 20000, "a chart reel: the hook fills the cover (" + head2.lit + ")");
ok(fig2.red < 2000 || head2.lit > 20000, "a chart reel: no figure block is invented");

// a photo that cannot be fetched: render-job drops the photo and the same template cover comes out
const { photo, ...noPhoto } = c3;
const c = await shot("template-photo-unavailable.jpg", noPhoto);
ok((await band(c, 1180, 1300)).red > 8000, "photo unavailable: the template cover with the figure");

await browser.close(); server.close();
console.log(fails ? `✗ ${fails} of ${checks} checks failed` : `✓ reel cover: ${checks} checks passed · samples in ${out}`);
process.exit(fails ? 1 : 0);
