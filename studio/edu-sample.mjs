// Render the light-theme education samples (placeholder content) for review.
//   node studio/edu-sample.mjs [outDir]
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "edu-sample");
const SRC = "Dubai Land Department";
const cards = {
  "edu-1-law": { type: "law", headline: "Your landlord needs 12 months' notice to evict you to sell", red: ["12 months'"],
    body: "If the owner wants the property back to sell it or live in it, the notice must be sent by notary public or registered mail, at least 12 months before the eviction date.",
    ref: "Law No. 26 of 2007, Article 25(2) — as amended by Law No. 33 of 2008", source: SRC },
  "edu-2-term": { type: "term", term: "Oqood", full: "Off-plan sale registration",
    definition: "The interim register where the Dubai Land Department records the sale of an off-plan unit, before the building is finished and a title deed exists.",
    example: "You buy an apartment from a developer in 2026; handover is in 2028. Until then, your proof of ownership is the Oqood certificate.", source: SRC },
  "edu-3-myth": { type: "myth", myth: "My landlord can raise the rent whenever they want.",
    fact: "Rent can only change at renewal, within the limits of the RERA rental index, and the landlord must give you 90 days' notice before the contract ends.",
    ref: "Law No. 33 of 2008, Article 14 · Decree No. 43 of 2013", source: "RERA" },
  "edu-4-number": { type: "number", number: "4%", unit: "of the property price", label: "DLD transfer fee", red: ["DLD"],
    body: "Paid to the Dubai Land Department when a property changes hands. The fee is usually paid by the buyer — on a AED 1.5M apartment that is AED 60,000.", source: SRC },
  "edu-5a-list-cover": { type: "list-cover", title: "5 checks before you sign a tenancy contract", red: ["5 checks"],
    subtitle: "Save this before your next viewing", of: 7 },
  "edu-5b-list-item": { type: "list-item", n: 1, title: "Check who owns the flat", red: ["owns"],
    body: "Ask for the title deed and the owner's Emirates ID or passport. If an agent signs, ask for the power of attorney.", slide: { n: 2, of: 7 } },
  "edu-5c-list-cta": { type: "list-cta", text: "Send this to someone renting in Dubai", red: ["Send"], slide: { n: 7, of: 7 } },
};

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2" };
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
for (const [name, card] of Object.entries(cards)) {
  const url = await page.evaluate(([c]) => window.renderCard("edu", c, 0.92), [card]);
  fs.writeFileSync(path.join(outDir, name + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  console.log("  " + name + ".jpg");
}
await browser.close(); server.close();
