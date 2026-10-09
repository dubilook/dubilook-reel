// Render sample cards for owner review: node studio/sample-cards.mjs <outDir> <jobs.json>  (jobs: [{name, kind, card}])
import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(r); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/studio/host.html`);
await page.evaluate(() => window.ready);
const jobs = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const j of jobs) {
  const url = await page.evaluate(async ([j]) => { if (j.card.photo) await window.DUBILOOK_POSTS.photo(j.card.photo); return window.renderCard(j.kind, j.card, 0.9); }, [j]);
  fs.writeFileSync(path.join(OUT, j.name + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
}
await browser.close(); server.close();
