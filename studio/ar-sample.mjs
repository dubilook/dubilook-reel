// Render the Arabic (RTL) design samples (placeholder content) for review.
//   node studio/ar-sample.mjs [outDir]
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "ar-sample");
const news = { type: "news", category: "property",
  headline: "دبي تسجّل 5.2 مليار درهم في صفقات عقارية خلال أسبوع", red: ["5.2 مليار درهم"],
  summary: "سجّلت دائرة الأراضي والأملاك 4,100 صفقة بيع، وكانت الشقق على الخارطة الأكثر طلباً.",
  source: "Khaleej Times", date: "2026-10-03" };
const cards = [
  ["ar-1-story", "ar-story", news],
  ["ar-3-post", "ar", { type: "fact", headline: "لا يحق للمالك زيادة الإيجار إلا عند التجديد", red: ["عند التجديد"],
    summary: "ويجب أن يُبلغ المستأجر قبل 90 يوماً من انتهاء العقد، وفق مؤشر الإيجارات.",
    source: "دائرة الأراضي والأملاك", date: "2026-10-03" }],
  ["ar-4-edu-law", "ar", { type: "law", headline: "يحتاج المالك إلى إشعار مدته 12 شهراً لإخلائك بغرض البيع", red: ["12 شهراً"],
    body: "إذا أراد المالك استعادة العقار لبيعه أو للسكن فيه، يجب إرسال الإشعار عن طريق كاتب العدل أو البريد المسجل قبل 12 شهراً على الأقل من تاريخ الإخلاء.",
    ref: "القانون رقم 26 لسنة 2007، المادة 25(2) — المعدّل بالقانون رقم 33 لسنة 2008", source: "دائرة الأراضي والأملاك" }],
];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2", ".ttf": "font/ttf" };
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
console.log(await page.evaluate(() => window.ready));
fs.mkdirSync(outDir, { recursive: true });
for (const [name, kind, card] of cards) {
  const url = await page.evaluate(([k, c]) => window.renderCard(k, c, 0.92), [kind, card]);
  fs.writeFileSync(path.join(outDir, name + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  console.log("  " + name + ".jpg");
}
await browser.close(); server.close();
