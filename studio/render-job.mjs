// Render every item of a site payload and upload the files to the site.
//   node studio/render-job.mjs payload.json            (GitHub Actions or the owner's PC)
// payload = { brand, job, callback, items:[{id, format, template, data, image_mode}], delivery?, report?, day? }
// Each item → one or more files → POST callback (multipart: item, position, kind, file, meta)
// then POST <callback-base>/render-complete {brand, items:[ids], failed:[{item,error}]}.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const SECRET = process.env.IG_API_SECRET;
if (!SECRET) { console.error("IG_API_SECRET missing"); process.exit(2); }
const callback = payload.callback;
const completeUrl = callback.replace(/render-callback$/, "render-complete");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "ig-render-"));

// ── static server for the canvas host page ──
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
await page.goto(base + "/studio/host.html");
await page.evaluate(() => window.ready);

async function still(kind, card, file) {
  const dataUrl = await page.evaluate(([k, c]) => window.renderCard(k, c, 0.92), [kind, card]);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
}
async function upload(itemId, position, kind, file, meta = {}) {
  const fd = new FormData();
  fd.append("item", String(itemId)); fd.append("position", String(position)); fd.append("kind", kind); fd.append("meta", JSON.stringify(meta));
  fd.append("file", new Blob([fs.readFileSync(file)], { type: kind === "video" ? "video/mp4" : "image/jpeg" }), path.basename(file));
  // The site is sometimes slow; a network error or 5xx gets 4 more tries (10 s, 30 s, 60 s, 120 s apart).
  for (let attempt = 0; ; attempt++) {
    let r, err;
    try { r = await fetch(callback, { method: "POST", headers: { "X-IG-Secret": SECRET }, body: fd }); } catch (e) { err = e; }
    if (r) {
      if (r.ok) return;
      err = new Error(`upload ${path.basename(file)} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      if (r.status < 500) throw err;
    }
    if (attempt >= 4) throw err;
    const wait = [10, 30, 60, 120][attempt];
    console.warn(`! ${err.message} — retry in ${wait}s`);
    await new Promise((res) => setTimeout(res, wait * 1000));
  }
}
const cardOf = (d) => ({ type: d.type || "news", category: d.category, headline: d.headline, red: d.red || [], summary: d.summary, angle: d.angle || "", source: d.source, date: d.date });

const done = [], failed = [];
for (const it of payload.items) {
  try {
    const d = it.data || {};
    const f = (n) => path.join(work, `item${it.id}-${n}`);
    switch (it.format) {
      case "story":
        if (it.template === "story-cover") { await still("post-story", { type: "story-cover", title: d.title, hooks: d.hooks || [], label: d.label || "NEW POST" }, f("0.jpg")); }
        else {
          await still("story", cardOf(d), f("0.jpg"));
          // a 9:16 story card is tiny in a Telegram feed — give the channel the 4:5 post card of the same news
          await still("post", cardOf(d), f("tg.jpg"));
        }
        await upload(it.id, 0, "image", f("0.jpg"));
        if (fs.existsSync(f("tg.jpg"))) await upload(it.id, 20, "image", f("tg.jpg"), { variant: "telegram" });
        break;
      case "image":
        await still("post", cardOf(d), f("0.jpg"));
        await upload(it.id, 0, "image", f("0.jpg"));
        break;
      case "carousel": {
        const slides = d.slides || [];
        const of = slides.length + 2;
        await still("post", { type: "cover", title: d.cover_title, date: d.date, hooks: d.cover_hooks || [], of }, f("0.jpg"));
        await upload(it.id, 0, "image", f("0.jpg"));
        for (const [k, s] of slides.entries()) { await still("post", { ...cardOf(s), slide: { n: k + 2, of } }, f(`${k + 1}.jpg`)); await upload(it.id, k + 1, "image", f(`${k + 1}.jpg`)); }
        await still("post", { type: "cta", text: d.cta, slide: { n: of, of } }, f(`${of - 1}.jpg`));
        await upload(it.id, of - 1, "image", f(`${of - 1}.jpg`));
        break;
      }
      case "reel": {
        // build-reel.mjs reads a delivery; wrap this item's data in a minimal one
        const mini = { run_date: payload.day || new Date().toISOString().slice(0, 10), news: [{ source_domain: d.source_domain || "dubilook.com", source_name: d.source, date: d.date || payload.day, evidence: [] }],
                       reel: { ...d, news_index: 0 } };
        const miniFile = f("delivery.json"); fs.writeFileSync(miniFile, JSON.stringify(mini));
        const out = f("0.mp4");
        const r = spawnSync("node", [path.join(ROOT, "studio/build-reel.mjs"), miniFile, "reel", out, "--workers", "2"], { stdio: "inherit" });
        if (r.status) throw new Error("build-reel failed");
        const audio = fs.existsSync(f("0.audio.json")) ? JSON.parse(fs.readFileSync(f("0.audio.json"), "utf8")) : {};
        await upload(it.id, 0, "video", out, { audio: audio.audio || null, trial: !!d.trial });
        break;
      }
      default: throw new Error("unknown format " + it.format);
    }
    done.push(it.id); console.log(`✓ item ${it.id} (${it.format})`);
  } catch (e) {
    failed.push({ item: it.id, error: String(e.message || e).slice(0, 300) }); console.error(`✗ item ${it.id}: ${e.message}`);
  }
}
await browser.close(); server.close();
const r = await fetch(completeUrl, { method: "POST", headers: { "X-IG-Secret": SECRET, "Content-Type": "application/json" }, body: JSON.stringify({ brand: payload.brand, items: done, failed }) });
console.log(`render-complete → HTTP ${r.status} · done ${done.length} · failed ${failed.length}`);
fs.rmSync(work, { recursive: true, force: true });
process.exit(failed.length && !done.length ? 1 : 0);
