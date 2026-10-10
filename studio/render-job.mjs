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
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
// The workflow's `npx playwright install` can fetch a NEWER Playwright than the locked playwright-core
// (2026-10-08: 1.64 vs 1.63 → no matching Chromium → every render died in 1 s). Install our own version's browser.
if (!process.env.CHROME_PATH && process.platform !== "win32") {
  const cli = path.join(ROOT, "studio/node_modules/playwright-core/cli.js");
  if (fs.existsSync(cli)) spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
}
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
// A crash before the first item used to end the run without calling render-complete, so the site never heard of it
// (2026-10-08). Now every item is reported as failed — the site marks them and alerts the owner at once.
async function reportCrash(e) {
  console.error("✗ engine crashed before rendering:", e);
  try {
    await fetch(completeUrl, { method: "POST", headers: { "X-IG-Secret": SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ brand: payload.brand, items: [], failed: payload.items.map((i) => ({ item: i.id, error: "engine crashed: " + String(e?.message || e).slice(0, 250) })) }) });
  } catch (err) { console.error("render-complete unreachable:", err.message); }
  process.exit(1);
}
let browser, page;
try {
  browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
  page = await browser.newPage();
  await page.goto(base + "/studio/host.html");
  await page.evaluate(() => window.ready);
} catch (e) { await reportCrash(e); }

// Image bank photos come as https://dubilook.com/media/… URLs. The canvas page is on 127.0.0.1, so a cross-origin
// image would taint the canvas: download it here and hand the page a data: URL instead (cached per URL).
const photoCache = new Map();
async function photoData(url) {
  if (!url || typeof url !== "string" || !/^https?:/.test(url)) return null;
  if (photoCache.has(url)) return photoCache.get(url);
  let out = null;
  for (let attempt = 0; attempt < 3 && !out; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) out = "data:image/jpeg;base64," + Buffer.from(await r.arrayBuffer()).toString("base64");
    } catch (e) { console.warn("! photo", url, e.message); }
    if (!out) await new Promise((res) => setTimeout(res, 5000));
  }
  photoCache.set(url, out);
  return out;
}
async function still(kind, card, file) {
  if (card.photo) {
    const data = await photoData(card.photo);
    if (data) { card = { ...card, photo: data }; await page.evaluate((u) => window.DUBILOOK_POSTS.photo(u), data); }
    else { const { photo, ...rest } = card; card = rest; console.warn("! photo unavailable — classic card"); }
  }
  const dataUrl = await page.evaluate(([k, c]) => window.renderCard(k, c, 0.92), [kind, card]);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
}
// Owner 2026-10-10 (sample C): the owner's logo motion (assets/logo-end-dark.mp4, 2.5× speed, 4.13 s) replaces the
// reel's built-in end card (scene 6 starts at 21.4 s in reel.html). 0.4 s cross-fade; the reel's own music keeps
// playing under the logo and fades out in the last second. Any ffmpeg problem keeps the original reel.
const REEL_END_CUT = 21.4, XFADE = 0.4;
function appendLogoEnd(file, d) {
  const logo = path.join(ROOT, "assets", d.logo_end === "light" ? "logo-end-light.mp4" : "logo-end-dark.mp4");
  if (d.logo_end === false || !fs.existsSync(logo)) return false;
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", logo], { encoding: "utf8" });
  const L = parseFloat(pr.stdout) || 4.134;
  const off = REEL_END_CUT - XFADE, total = (off + L).toFixed(3);
  const tmp = file.replace(/\.mp4$/, "-end.mp4");
  const p = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-i", logo, "-filter_complex",
    `[0:v]trim=0:${REEL_END_CUT},setpts=PTS-STARTPTS,fps=30,settb=1/30,format=yuv420p,setsar=1[a];` +
    `[1:v]setpts=PTS-STARTPTS,fps=30,settb=1/30,format=yuv420p,setsar=1[b];` +
    `[a][b]xfade=transition=fade:duration=${XFADE}:offset=${off}[v];` +
    `[0:a]apad,atrim=0:${total},afade=t=out:st=${(total - 1).toFixed(3)}:d=1[au]`,
    "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-b:a", "160k", "-movflags", "+faststart", tmp], { stdio: "inherit" });
  if (p.status || !fs.existsSync(tmp)) { console.warn("! logo end card failed — the reel keeps its own ending"); return false; }
  fs.renameSync(tmp, file);
  console.log(`  + logo end card (${L.toFixed(2)} s), reel now ${total} s`);
  return true;
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
const cardOf = (d) => ({ type: d.type || "news", category: d.category, headline: d.headline, red: d.red || [], summary: d.summary, angle: d.angle || "", source: d.source, date: d.date, label: d.label });
// image bank fields (site ImageBank): photo URL (or false = decided: no photo), credit line, layout panel|bar|overlay
const photoOf = (d) => (d.photo ? { photo: d.photo, photo_credit: d.photo_credit || "", layout: d.layout } : {});

const done = [], failed = [];
for (const it of payload.items) {
  try {
    const d = it.data || {};
    const f = (n) => path.join(work, `item${it.id}-${n}`);
    // light-theme education cards (edu-renderer.js): one 4:5 image, or a checklist carousel
    if (String(it.template || "").startsWith("edu-")) {
      if (d.kind === "checklist") {
        const steps = d.steps || [], of = steps.length + 2;
        await still("edu", { type: "list-cover", title: d.headline, red: d.red || [], subtitle: d.subtitle || "", of }, f("0.jpg"));
        await upload(it.id, 0, "image", f("0.jpg"));
        for (const [k, s] of steps.entries()) {
          await still("edu", { type: "list-item", n: k + 1, title: s.title, body: s.body, slide: { n: k + 2, of } }, f(`${k + 1}.jpg`));
          await upload(it.id, k + 1, "image", f(`${k + 1}.jpg`));
        }
        await still("edu", { type: "list-cta", text: d.cta || "", slide: { n: of, of } }, f(`${of - 1}.jpg`));
        await upload(it.id, of - 1, "image", f(`${of - 1}.jpg`));
      } else {
        await still("edu", { ...d, type: d.kind }, f("0.jpg"));
        await upload(it.id, 0, "image", f("0.jpg"));
      }
      done.push(it.id); console.log(`✓ item ${it.id} (${it.template})`);
      continue;
    }
    // Arabic news cards (ar-renderer.js, RTL): 9:16 story (+ the 4:5 card for Telegram) or 4:5 feed post
    if (d.lang === "ar") {
      const card = { ...cardOf(d), type: "news" };
      if (it.format === "story") {
        await still("ar-story", card, f("0.jpg")); await upload(it.id, 0, "image", f("0.jpg"));
        await still("ar", card, f("tg.jpg")); await upload(it.id, 20, "image", f("tg.jpg"), { variant: "telegram" });
      } else if (it.format === "image") {
        await still("ar", card, f("0.jpg")); await upload(it.id, 0, "image", f("0.jpg"));
      } else throw new Error("Arabic " + it.format + " is not built yet");
      done.push(it.id); console.log(`✓ item ${it.id} (${it.template})`);
      continue;
    }
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
        await still("post", { ...cardOf(d), ...photoOf(d) }, f("0.jpg"));
        await upload(it.id, 0, "image", f("0.jpg"));
        break;
      case "carousel": {
        const slides = d.slides || [];
        const of = slides.length + 2;
        await still("post", { type: "cover", title: d.cover_title, date: d.date, hooks: d.cover_hooks || [], of, ...photoOf(d) }, f("0.jpg"));
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
        appendLogoEnd(out, d);
        const audio = fs.existsSync(f("0.audio.json")) ? JSON.parse(fs.readFileSync(f("0.audio.json"), "utf8")) : {};
        await upload(it.id, 0, "video", out, { audio: audio.audio || null, trial: !!d.trial });
        // reel cover (grid + Reels tab): the hook over the bank photo — sent as variant "cover", used only as cover_url
        if (d.photo) {
          await still("post-story", { type: "reel-cover", title: d.hook || d.headline || "", label: d.kicker || "NEWS", ...photoOf(d) }, f("cover.jpg"));
          await upload(it.id, 21, "image", f("cover.jpg"), { variant: "cover" });
        }
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
