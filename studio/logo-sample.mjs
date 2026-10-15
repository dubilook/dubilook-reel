// Sample sheet of EVERY template with the OFFICIAL logo (IG-COMMENT-DM prompt 2026-10-15 §3B) — placeholder content,
// rendered through studio/host.html exactly as render-job.mjs does, plus the reel's first frame and end card.
//   node studio/logo-sample.mjs [outDir]      (default: ../out/logo-<today>)
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const day = new Date().toISOString().slice(0, 10);
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "logo-" + day);
const D = "2026-10-15";
const news = { type: "news", category: "property", headline: "Ejari registration goes fully digital across Dubai", red: ["fully digital"],
  summary: "Dubai Land Department says 12,000 tenancy contracts were registered online this quarter.",
  angle: "Agents can register leases without visiting a typing centre.", source: "GULF NEWS", date: D };
const fact = { type: "fact", category: "property", headline: "A landlord needs 12 months' notice to evict you to sell", red: ["12 months'"],
  summary: "The notice must be sent by notary public or registered mail before the eviction date.", source: "DUBAI LAND DEPARTMENT", date: D };
const ar = { type: "news", category: "property", headline: "تسجيل عقود الإيجار أصبح رقمياً بالكامل في دبي", red: ["رقمياً بالكامل"],
  summary: "سجلت دائرة الأراضي والأملاك 12,000 عقد إيجار عبر الإنترنت هذا الربع، دون زيارة مراكز الطباعة.", source: "GULF NEWS", date: D };
const SRC = "Dubai Land Department";
const samples = [
  ["01-post-news-dark", "post", news],
  ["02-post-fact-dark", "post", fact],
  ["03-carousel-cover", "post", { type: "cover", title: "5 things that changed for Dubai tenants this week", red: ["5 things"],
    hooks: ["Ejari goes digital", "Rent index refreshed", "New eviction notice rules"], of: 5, date: D }],
  ["04-carousel-slide", "post", { ...news, slide: { n: 2, of: 5 } }],
  ["05-carousel-cta", "post", { type: "cta", text: "Send this to a colleague who needs it", slide: { n: 5, of: 5 } }],
  ["06-story-cover", "post-story", { type: "story-cover", title: "Ejari registration goes fully digital", hooks: [], stat: "12,000",
    statLabel: "CONTRACTS ONLINE", sub: "this quarter", label: "NEW POST", date: D }],
  ["07-story-news", "story", news],
  ["08-story-divider-light", "story", { type: "divider", date: D }],
  ["09-edu-law-light", "edu", { type: "law", headline: "Your landlord needs 12 months' notice to evict you to sell", red: ["12 months'"],
    body: "If the owner wants the property back to sell it or live in it, the notice must be sent by notary public or registered mail, at least 12 months before the eviction date.",
    ref: "Law No. 26 of 2007, Article 25(2) — as amended by Law No. 33 of 2008", source: SRC }],
  ["10-edu-term-light", "edu", { type: "term", term: "Oqood", full: "Off-plan sale registration",
    definition: "The interim register where the Dubai Land Department records the sale of an off-plan unit, before the building is finished and a title deed exists.",
    example: "You buy an apartment from a developer; until handover your proof of ownership is the Oqood certificate.", source: SRC }],
  ["11-edu-myth-light", "edu", { type: "myth", myth: "My landlord can raise the rent whenever they want.",
    fact: "Rent can only change at renewal, within the limits of the RERA rental index, and the landlord must give you 90 days' notice before the contract ends.",
    ref: "Law No. 33 of 2008, Article 14 · Decree No. 43 of 2013", source: "RERA" }],
  ["12-edu-number-light", "edu", { type: "number", number: "4%", unit: "of the property price", label: "DLD transfer fee", red: ["DLD"],
    body: "Paid to the Dubai Land Department when a property changes hands. The fee is usually paid by the buyer.", source: SRC }],
  ["13-edu-list-cover", "edu", { type: "list-cover", title: "5 checks before you sign a tenancy contract", red: ["5 checks"], subtitle: "Save this before your next viewing", of: 7 }],
  ["14-edu-list-item", "edu", { type: "list-item", n: 1, title: "Check who owns the flat", red: ["owns"],
    body: "Ask for the title deed and the owner's Emirates ID or passport. If an agent signs, ask for the power of attorney.", slide: { n: 2, of: 7 } }],
  ["15-edu-list-cta", "edu", { type: "list-cta", text: "Send this to someone renting in Dubai", red: ["Send"], slide: { n: 7, of: 7 } }],
  ["16-ar-post-dark", "ar", ar],
  ["17-ar-story-dark", "ar-story", ar],
  ["18-ar-law-light", "ar", { type: "law", headline: "يحتاج المالك إلى إشعار قبل 12 شهراً لإخلائك بغرض البيع", red: ["12 شهراً"],
    body: "إذا أراد المالك استرداد العقار لبيعه أو للسكن فيه، يجب إرسال الإشعار عبر الكاتب العدل أو البريد المسجل قبل 12 شهراً على الأقل من تاريخ الإخلاء.",
    ref: "القانون رقم 26 لسنة 2007، المادة 25، البند 2", source: SRC }],
];
const REEL = { kicker: "UAE PROPERTY NEWS", hook: "Ejari registration goes fully digital", hookGold: "fully digital", sub: "No more typing centres for tenancy contracts",
  statLabelShort: "contracts online", chart: null, statValue: 12000, statUnit: "contracts", statLabel: "registered online this quarter",
  detail: "Dubai Land Department moved tenancy registration to its app; agents and landlords register a lease in minutes.",
  takeaway: "Ask your agent to register your Ejari online — it is free and instant.", question: null, icons: [], source: "GULF NEWS", date: "15 OCT 2026" };

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
// the reel: first frame (logo top-left) and the end card
try {
  const p2 = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  p2.on("pageerror", (e) => console.error("reel page error:", e.message));
  await p2.addInitScript("window.DATA = " + JSON.stringify(REEL) + ";");
  await p2.goto(pathToFileURL(path.join(ROOT, "reel.html")).href + "?layout=instagram");
  await p2.waitForFunction("window.READY === true", null, { timeout: 30000 });
  for (const [t, name] of [[1.6, "19-reel-first-frame"], [23.2, "20-reel-end-card"]]) {
    await p2.evaluate(([tt]) => (window.SEEKF ? window.SEEKF(tt, Math.round(tt * 30)) : window.SEEK(tt)), [t]);
    await p2.screenshot({ type: "jpeg", quality: 92, path: path.join(outDir, name + ".jpg") });
    console.log("  " + name + ".jpg");
  }
} catch (e) { console.error("reel frames skipped:", e.message); }
await browser.close(); server.close();
console.log("→ " + outDir);
