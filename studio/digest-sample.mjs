// Sample of the daily PDF digest + the 20:00 post, for the owner's look (not used in production).
//   node studio/digest-sample.mjs <out-dir>
// Texts = the approved template's sample day (15 Oct); heroes = real engine renders from out/logo-2026-10-16-v2.
// Writes digest.pdf, sheet-N.png (each PDF page, print CSS), post-2000.jpg.
import { chromium } from "playwright-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digestHtml, postHtml, dateLabelOf } from "./digest-renderer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "out", "digest-sample"));
fs.mkdirSync(OUT, { recursive: true });
const IMG = path.join(ROOT, "..", "out", "logo-2026-10-16-v2");
const img = (f) => (fs.existsSync(path.join(IMG, f)) ? "data:image/jpeg;base64," + fs.readFileSync(path.join(IMG, f)).toString("base64") : null);
const ig = "https://www.instagram.com/dubilook";
const cards = [
  { story: "budget", lang: "en", tag: "News", headline: "UAE Approves 292.5 Billion Dirham Budget For 2027-2029", summary: "Spending rises 28.3% over the previous three years, with education, healthcare and housing named top priorities.", source: "Gulf News, 13 Oct 2026", hero: img("01-post-news-dark.jpg"), hero_shape: "4:5", source_url: "https://dubilook.com/n/sample1", instagram_url: ig, reel_url: ig },
  { story: "budget", lang: "en", tag: "Carousel", headline: "UAE Budget: Where The 292.5 Billion Goes (carousel slide)", summary: "21 of the 38 new brands have already opened, including cinema's return via Roxy Cinemas, with 17 more due by end 2027.", source: "Gulf News, 12 Oct 2026", hero: img("04-carousel-slide.jpg"), hero_shape: "4:5", source_url: "https://dubilook.com/n/sample2", instagram_url: ig },
  { story: "coldcall", lang: "en", tag: "Fact", headline: "Cold-Calling A Dubai Owner Can Cost 50,000 Dirham", summary: "A new DLD circular bans brokers from cold-calling property owners, with fines up to 50,000 Dirham or a 3-month suspension.", source: "Dubai Land Department", hero: img("02-post-fact-dark.jpg"), hero_shape: "4:5", source_url: "https://dubilook.com/n/sample3", instagram_url: ig },
  { story: "defects", lang: "en", tag: "Law", headline: "Dubai Landlords, Not Tenants, Must Fix Defects By Default", summary: "Unless the lease says otherwise, the landlord is responsible for maintenance and for repairing any defect affecting the tenant's use.", source: "Dubai Legal Portal", hero: img("09-edu-law-light.jpg"), hero_shape: "4:5", source_url: "https://dubilook.com/n/sample4", instagram_url: ig },
  { story: "kasumigaseki", lang: "en", tag: "Story", headline: "Japanese Developer Kasumigaseki Enters UAE Property Market", summary: "The Tokyo-listed developer has announced its first projects in the UAE.", source: "Arabian Business, 12 Oct 2026", hero: img("07-story-news.jpg"), hero_shape: "9:16", source_url: "https://dubilook.com/n/sample5", instagram_url: ig },
  { story: "wealth", lang: "en", tag: "Reel", headline: "UAE Net Wealth Climbs To 3.6 Trillion Dollar", summary: "The country's total net wealth keeps rising, putting the UAE among the world's fastest-growing wealth hubs.", source: "Gulf News, 12 Oct 2026", hero: null, hero_shape: "9:16", source_url: null, instagram_url: ig, reel_url: ig },
  { story: "budget", lang: "ar", tag: "Arabic news", headline: "دبي: مول ابن بطوطة يضيف 38 علامة تجارية وعودة السينما", summary: "افتتح مول ابن بطوطة في دبي 21 من أصل 38 علامة تجارية جديدة حتى الآن، مع توقع افتتاح 17 أخرى بحلول نهاية 2027.", source: "Gulf News, 12 Oct 2026", hero: img("16-ar-post-dark.jpg"), hero_shape: "4:5", source_url: "https://dubilook.com/n/sample7", instagram_url: ig },
];
const data = { date: "2026-10-15", date_label: dateLabelOf("2026-10-15"), short_date: "15 Oct 2026", year: 2026, keyword: "Marina", prepared_for: null,
  figures: [{ value: "292.5", unit: "Billion Dirham", label: "UAE federal budget 2027 to 2029" }, { value: "38", unit: "brands", label: "added at Ibn Battuta Mall" }, { value: "50,000", unit: "Dirham", label: "top fine for cold-calling owners" }], cards };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": p.endsWith(".woff2") ? "font/woff2" : p.endsWith(".html") ? "text/html" : "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(base + "/assets/digest/blank.html");
await page.setContent(digestHtml(data), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(OUT, "digest.pdf"), preferCSSPageSize: true, printBackground: true });
await page.emulateMedia({ media: "print" });
const sheets = await page.$$(".sheet");
for (const [k, s] of sheets.entries()) await s.screenshot({ path: path.join(OUT, `sheet-${k + 1}.png`) });
await page.setViewportSize({ width: 1080, height: 1350 });
const post = await browser.newPage();
await post.goto(base + "/assets/digest/blank.html");
await post.setViewportSize({ width: 1080, height: 1350 });
await post.setContent(postHtml(data), { waitUntil: "load" });
await post.evaluate(() => document.fonts.ready);
await post.screenshot({ path: path.join(OUT, "post-2000.jpg"), type: "jpeg", quality: 92 });
await browser.close(); server.close();
console.log(`✓ ${sheets.length} pages + post → ${OUT}`);
