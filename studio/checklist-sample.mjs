// R69 samples: edu CHECKLIST carousels through the PRODUCTION render-job.mjs (a fake site keeps the uploads) —
// one with keyword «Tenant», one without — cover / steps / end poster, plus 00-contact-sheet.jpg.
//   node studio/checklist-sample.mjs [outDir]
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || path.join(ROOT, "..", "out", "r69");
fs.mkdirSync(outDir, { recursive: true });
const got = [];
const server = http.createServer((req, res) => {
  const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", async () => {
    const body = Buffer.concat(chunks);
    if (req.url.endsWith("/render-complete")) { res.end("{}"); return; }
    const fd = await new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body }).formData();
    got.push({ item: +fd.get("item"), position: +fd.get("position"), bytes: Buffer.from(await fd.get("file").arrayBuffer()) });
    res.end("{}");
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const steps = ["Check the Ejari record", "Read the service fees", "Ask for the title deed", "Confirm the deposit terms"]
  .map((t) => ({ title: t, body: "Ask the landlord or the agent for the document before you sign." }));
const checklist = { kind: "checklist", headline: "Before you sign a lease in Dubai", red: ["sign a lease"], subtitle: "Four checks that save you money", steps, cta: "Save this" };
const payload = { brand: "sample", job: 1, callback: `http://127.0.0.1:${server.address().port}/ig/api/render-callback`, day: "2026-10-17", items: [
  { id: 1, format: "carousel", template: "edu-checklist", data: { ...checklist, dm_keyword: "Tenant" } },
  { id: 2, format: "carousel", template: "edu-checklist", data: { ...checklist } },
] };
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "r69-")), "payload.json");
fs.writeFileSync(pf, JSON.stringify(payload));
const child = spawn(process.execPath, [path.join(ROOT, "studio/render-job.mjs"), pf], { env: { ...process.env, IG_API_SECRET: "t" }, stdio: "inherit" });
await new Promise((r) => child.on("exit", r));
server.close();

const tiles = [];
for (const g of got.sort((a, b) => a.item - b.item || a.position - b.position)) {
  const n = `checklist-${g.item === 1 ? "tenant" : "none"}-${g.position}`;
  fs.writeFileSync(path.join(outDir, n + ".jpg"), g.bytes);
  tiles.push([n, "data:image/jpeg;base64," + g.bytes.toString("base64")]);
}
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
const sheet = await page.evaluate(async (t) => {
  const TW = 360, TH = 450, LB = 30, cols = 6, rows = Math.ceil(t.length / cols);
  const c = document.createElement("canvas"); c.width = cols * TW; c.height = rows * (TH + LB); const g = c.getContext("2d");
  g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
  for (const [i, [n, u]] of t.entries()) {
    const im = new Image(); im.src = u; await im.decode();
    const x = (i % cols) * TW, y = Math.floor(i / cols) * (TH + LB);
    g.drawImage(im, x, y + LB, TW, TH);
    g.fillStyle = "#fff"; g.font = "600 17px sans-serif"; g.fillText(n, x + 8, y + 21);
  }
  return c.toDataURL("image/jpeg", 0.85);
}, tiles);
fs.writeFileSync(path.join(outDir, "00-contact-sheet.jpg"), Buffer.from(sheet.split(",")[1], "base64"));
await browser.close();
console.log(`${tiles.length} samples + 00-contact-sheet.jpg → ${outDir}`);
