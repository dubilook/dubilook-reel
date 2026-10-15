// Keyword CTA ON the image — design samples for the owner (batch 2026-10-16 PART Q1, owner ~02:14 [stated]).
// Affected templates with short + long keywords and the Arabic version. STOP: nothing is pushed until he approves.
//   node studio/cta-sample.mjs [outDir]      (default: ../out/keyword-cta-1016)
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "keyword-cta-1016");
const D = "2026-10-16";
const news = { type: "news", category: "property", headline: "Ejari registration goes fully digital across Dubai", red: ["fully digital"],
  summary: "Dubai Land Department says 12,000 tenancy contracts were registered online this quarter.",
  angle: "Agents can register leases without visiting a typing centre.", source: "GULF NEWS", date: D };
const ar = { type: "news", category: "property", headline: "تسجيل عقود الإيجار أصبح رقمياً بالكامل في دبي", red: ["رقمياً بالكامل"],
  summary: "سجلت دائرة الأراضي والأملاك 12,000 عقد إيجار عبر الإنترنت هذا الربع، دون زيارة مراكز الطباعة.", source: "GULF NEWS", date: D };
const SRC = "Dubai Land Department";
const samples = [
  ["01-post-news-short-kw", "post", { ...news, dm_keyword: "Ejari" }],
  ["02-post-news-long-kw", "post", { ...news, dm_keyword: "Registrations" }],   // 13 letters — near the 14 max
  ["03-carousel-cta-slide", "post", { type: "cta", text: "Send this to a colleague who needs it", slide: { n: 5, of: 5 }, dm_keyword: "Ejari" }],
  ["04-edu-law-url", "edu", { type: "law", headline: "Your landlord needs 12 months' notice to evict you to sell", red: ["12 months'"],
    body: "If the owner wants the property back to sell it or live in it, the notice must be sent by notary public or registered mail, at least 12 months before the eviction date.",
    ref: "Law No. 26 of 2007, Article 25(2) — as amended by Law No. 33 of 2008", source: SRC, dm_keyword: "Notice" }],
  ["05-edu-number-long-kw", "edu", { type: "number", number: "4%", unit: "of the property price", label: "DLD transfer fee", red: ["DLD"],
    body: "Paid to the Dubai Land Department when a property changes hands.", source: SRC, dm_keyword: "Registrations" }],
  ["06-ar-post-kw", "ar", { ...ar, dm_keyword: "Ejari" }],
  ["07-post-news-no-kw-unchanged", "post", news],   // control: no keyword → exactly as today
];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/studio/host.html`);
console.log(JSON.stringify(await page.evaluate(() => window.ready)));
fs.mkdirSync(outDir, { recursive: true });
for (const [name, kind, card] of samples) {
  const url = await page.evaluate(([k, c]) => window.renderCard(k, c, 0.92), [kind, card]);
  fs.writeFileSync(path.join(outDir, name + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  console.log("  " + name + ".jpg");
}
// contact sheet
const sheet = await page.evaluate(async (names) => {
  const c = document.createElement("canvas"); c.width = 360 * 4; c.height = 450 * 2;
  const g = c.getContext("2d"); g.fillStyle = "#ddd"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < names.length; i++) {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = names[i]; });
    g.drawImage(img, (i % 4) * 360, Math.floor(i / 4) * 450, 360, 450);
  }
  return c.toDataURL("image/jpeg", 0.85);
}, samples.map(([n]) => {
  const b = fs.readFileSync(path.join(outDir, n + ".jpg"));
  return "data:image/jpeg;base64," + b.toString("base64");
}));
fs.writeFileSync(path.join(outDir, "00-contact-sheet.jpg"), Buffer.from(sheet.split(",")[1], "base64"));
console.log("  00-contact-sheet.jpg");
await browser.close(); server.close();
console.log("→ " + outDir);
