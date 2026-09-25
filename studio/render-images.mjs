// Render every still image for one Routine A delivery (schema 2.0).
//   node studio/render-images.mjs <delivery.json> <outDir> [--accepted report.json]
// Output: JPEGs + manifest.json listing each file with its role and dimensions.
// Uses the system Chrome (CHROME_PATH) or Playwright's bundled Chromium.
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [, , deliveryPath, outDir, ...rest] = process.argv;
if (!deliveryPath || !outDir) { console.error("usage: render-images.mjs <delivery.json> <outDir> [--accepted report.json]"); process.exit(2); }
const delivery = JSON.parse(fs.readFileSync(deliveryPath, "utf8"));
const accIdx = rest.indexOf("--accepted");
const report = accIdx >= 0 ? JSON.parse(fs.readFileSync(rest[accIdx + 1], "utf8")) : null;

const SOURCE_NAMES = {
  "wam.ae": "WAM", "mediaoffice.ae": "DUBAI MEDIA OFFICE", "mediaoffice.abudhabi": "ABU DHABI MEDIA OFFICE",
  "dubailand.gov.ae": "DUBAI LAND DEPARTMENT", "rera.gov.ae": "RERA", "uaelegislation.gov.ae": "UAE LEGISLATION",
  "gulfnews.com": "GULF NEWS", "thenationalnews.com": "THE NATIONAL", "khaleejtimes.com": "KHALEEJ TIMES",
  "arabianbusiness.com": "ARABIAN BUSINESS", "businesstoday.me": "BUSINESS TODAY ME", "economymiddleeast.com": "ECONOMY MIDDLE EAST",
  "gulfbusiness.com": "GULF BUSINESS", "gulftoday.ae": "GULF TODAY", "emirates247.com": "EMIRATES 24|7",
  "propertynews.ae": "PROPERTY NEWS", "timeoutdubai.com": "TIME OUT DUBAI", "emaar.com": "EMAAR", "nakheel.com": "NAKHEEL",
  "aldar.com": "ALDAR", "dfm.ae": "DUBAI FINANCIAL MARKET", "adx.ae": "ABU DHABI SECURITIES EXCHANGE",
};
const sourceName = (dom) => SOURCE_NAMES[dom] || dom.replace(/\.(com|ae|me|gov\.ae)$/, "").toUpperCase().slice(0, 24);

const okNews = report ? new Set(report.accepted.news) : new Set(delivery.news.map((_, i) => i));
const okFacts = report ? new Set(report.accepted.facts) : new Set(delivery.facts.map((_, i) => i));
const card = (it) => ({ type: it.type, category: it.category, headline: it.headline, red: it.red,
  summary: it.summary, angle: it.angle || "", source: sourceName(it.source_domain), date: it.date });

// ── static server (canvas needs same-origin images) ──
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
await page.goto(base + "/studio/host.html");
const ok = await page.evaluate(() => window.ready);
if (!ok.stories.lens || !ok.stories.logo || !ok.stories.pjs || !ok.stories.anton) throw new Error("assets failed to load: " + JSON.stringify(ok));

fs.mkdirSync(outDir, { recursive: true });
const manifest = { run_date: delivery.run_date, files: [] };
async function out(name, kind, c, role, extra = {}) {
  const dataUrl = await page.evaluate(([k, cd]) => window.renderCard(k, cd, 0.92), [kind, c]);
  const file = path.join(outDir, name + ".jpg");
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  manifest.files.push({ file: name + ".jpg", role, width: 1080, height: kind === "post" ? 1350 : 1920, ...extra });
  console.log("  " + name + ".jpg");
}

// 1) stories: every accepted news item, then facts
let n = 0;
for (const [i, it] of delivery.news.entries()) if (okNews.has(i)) await out(`story-${String(++n).padStart(2, "0")}-news`, "story", card(it), "story", { news_index: i, alt_text: it.alt_text });
for (const [i, it] of delivery.facts.entries()) if (okFacts.has(i)) await out(`story-${String(++n).padStart(2, "0")}-fact`, "story", card(it), "story", { fact_index: i, alt_text: it.alt_text });

// 2) fact post (fact #2 if present, else #1) — 4:5 feed image
const factIdx = [...okFacts].includes(1) ? 1 : [...okFacts][0];
if (factIdx !== undefined) {
  await out("post-fact", "post", card(delivery.facts[factIdx]), "fact_post", { fact_index: factIdx, alt_text: delivery.facts[factIdx].alt_text });
  await out("post-fact-story", "story", card(delivery.facts[factIdx]), "fact_post_story", { fact_index: factIdx });
}

// 3) carousel: cover + items + CTA (4:5), and a story that announces it
const cr = delivery.carousel;
const items = cr ? cr.items.filter((i) => okNews.has(i)) : [];
if (cr && items.length >= 3) {
  const of = items.length + 2;
  await out("carousel-01-cover", "post", { type: "cover", title: cr.cover_title, date: delivery.run_date, hooks: cr.cover_hooks, of }, "carousel", { slide: 1 });
  for (const [k, i] of items.entries())
    await out(`carousel-${String(k + 2).padStart(2, "0")}`, "post", { ...card(delivery.news[i]), slide: { n: k + 2, of } }, "carousel", { slide: k + 2, news_index: i, alt_text: delivery.news[i].alt_text });
  await out(`carousel-${String(of).padStart(2, "0")}-cta`, "post", { type: "cta", text: cr.cta, slide: { n: of, of } }, "carousel", { slide: of });
  await out("carousel-story", "post-story", { type: "story-cover", title: cr.cover_title, hooks: cr.cover_hooks, label: "NEW POST" }, "carousel_story");
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
server.close();
console.log(`done: ${manifest.files.length} images → ${outDir}`);
