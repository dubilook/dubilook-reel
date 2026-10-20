// Fix pack 2026-10-20 #6 + #8: render one news carousel with a keyword per slide and save every uploaded file
// (Instagram set + the badge-free «clean» set) to out/slide-keywords-1020/, plus a contact sheet to look at.
//   node studio/slide-keyword-sample.mjs
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, "..", "out", "slide-keywords-1020");
fs.mkdirSync(OUT, { recursive: true });
const got = [];
const server = http.createServer((req, res) => {
  const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", async () => {
    const body = Buffer.concat(chunks);
    if (req.url.endsWith("/render-complete")) { res.end("{}"); return; }
    const fd = await new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body }).formData();
    const bytes = Buffer.from(await fd.get("file").arrayBuffer()), pos = +fd.get("position");
    fs.writeFileSync(path.join(OUT, `pos${String(pos).padStart(2, "0")}.jpg`), bytes);
    got.push(pos); res.end("{}");
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const news = (h, kw) => ({ type: "news", category: "property", headline: h, red: [], summary: "Sample text for the layout check.", source: "GULF NEWS", date: "2026-10-19", dm_keyword: kw });
const payload = { brand: "test", job: 1, callback: `http://127.0.0.1:${server.address().port}/ig/api/render-callback`, day: "2026-10-19", items: [
  { id: 1, format: "carousel", template: "carousel-news", data: { cover_title: "Dubai Property Today", date: "2026-10-19", cover_hooks: ["107 City Projects Done", "1M+ Rental Contracts", "DIP Holding IPO Opens"],
    slides: [news("Dubai Completes Over 107 Projects", "Beach"), news("Dubai Rental Contracts Pass 1 Million", "Rent"), news("Dubai Investments Sells 20% Stake", "Stake")] } }] };
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "slkw-")), "payload.json");
fs.writeFileSync(pf, JSON.stringify(payload));
const child = spawn(process.execPath, [path.join(ROOT, "studio/render-job.mjs"), pf], { env: { ...process.env, IG_API_SECRET: "t" }, stdio: ["ignore", "inherit", "inherit"] });
await new Promise((r) => child.on("exit", r));
server.close();
// contact sheet: top row = Instagram set, bottom row = clean set
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const pg = await browser.newPage();
const files = got.sort((a, b) => a - b).map((p) => ({ p, url: "data:image/jpeg;base64," + fs.readFileSync(path.join(OUT, `pos${String(p).padStart(2, "0")}.jpg`)).toString("base64") }));
const sheet = await pg.evaluate(async (files) => {
  const W = 270, H = 338, top = files.filter((f) => f.p < 20), bot = files.filter((f) => f.p >= 40);
  const c = document.createElement("canvas"); c.width = W * Math.max(top.length, bot.length); c.height = H * 2 + 40; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#000"; x.font = "16px sans-serif";
  for (const [row, set] of [[0, top], [1, bot]]) for (const [i, f] of set.entries()) {
    const im = new Image(); im.src = f.url; await im.decode(); x.drawImage(im, i * W, row * (H + 20) + 20, W - 4, H - 4); x.fillText((row ? "clean " : "IG ") + f.p, i * W + 4, row * (H + 20) + 16);
  }
  return c.toDataURL("image/jpeg", 0.85);
}, files);
fs.writeFileSync(path.join(OUT, "00-contact-sheet.jpg"), Buffer.from(sheet.split(",")[1], "base64"));
await browser.close();
console.log("saved", got.length, "files + contact sheet to", OUT);
