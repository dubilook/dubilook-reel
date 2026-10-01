// Build one Reel MP4 with a royalty-free music bed from a Routine A delivery.
//   node studio/build-reel.mjs <delivery.json> <reel|trial_reel> <out.mp4>
//        [--layout instagram|full] [--workers N] [--music <file|dir|none>] [--sfx]
// Music: a file, or a folder of tracks (default assets/music/). The track is picked
// deterministically from the date + which reel, so the reel and the trial reel differ
// and the same track is not reused on consecutive days when the folder has several.
// --sfx uses the old synthesised sound design instead (owner rejected it as default).
// Cross-platform (Windows / Linux runner). Uses reel.html unchanged; the day's data is
// injected by intercepting data.js, so several reels can render at once.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const [deliveryPath, which, outFile] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LAYOUT = opt("--layout", "instagram");
const WORKERS = Number(opt("--workers", Math.max(2, Math.min(6, os.cpus().length - 1))));
const MUSIC = opt("--music", path.join(ROOT, "assets", "music"));
const USE_SFX = args.includes("--sfx");
const FPS = 30;
if (!deliveryPath || !["reel", "trial_reel"].includes(which) || !outFile) {
  console.error("usage: build-reel.mjs <delivery.json> <reel|trial_reel> <out.mp4> [--layout instagram|full] [--workers N] [--silent]");
  process.exit(2);
}

const SOURCE_NAMES = {
  "wam.ae": "WAM", "mediaoffice.ae": "DUBAI MEDIA OFFICE", "dubailand.gov.ae": "DUBAI LAND DEPARTMENT", "rera.gov.ae": "RERA",
  "gulfnews.com": "GULF NEWS", "thenationalnews.com": "THE NATIONAL", "khaleejtimes.com": "KHALEEJ TIMES",
  "arabianbusiness.com": "ARABIAN BUSINESS", "businesstoday.me": "BUSINESS TODAY ME", "economymiddleeast.com": "ECONOMY MIDDLE EAST",
  "gulfbusiness.com": "GULF BUSINESS", "gulftoday.ae": "GULF TODAY", "emirates247.com": "EMIRATES 24|7",
  "propertynews.ae": "PROPERTY NEWS", "emaar.com": "EMAAR", "nakheel.com": "NAKHEEL", "aldar.com": "ALDAR",
};
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const delivery = JSON.parse(fs.readFileSync(deliveryPath, "utf8"));
const r = delivery[which];
if (!r) { console.error(`no ${which} in delivery`); process.exit(1); }
const src = delivery.news[r.news_index];
const [y, m, d] = src.date.split("-").map(Number);
const DATA = {
  kicker: r.kicker, hook: r.hook, hookGold: r.hookGold, sub: r.sub, statLabelShort: r.statLabelShort,
  chart: r.chart ?? null, statValue: r.statValue, statUnit: r.statUnit, statLabel: r.statLabel,
  detail: r.detail, takeaway: r.takeaway, question: r.question, icons: r.icons,
  source: (src.source_name ? String(src.source_name).toUpperCase() : null) || SOURCE_NAMES[src.source_domain] || src.source_domain.split(".")[0].toUpperCase(),
  date: `${d} ${MON[m - 1]} ${y}`,
};

const ff = (a) => { const p = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" }); if (p.status) throw new Error("ffmpeg failed"); };

// 1) background plate (cached in bg/, same recipe as build.sh)
const bgDir = path.join(ROOT, "bg");
if (fs.existsSync(path.join(ROOT, "assets/bg-source.mp4")) && !fs.existsSync(path.join(bgDir, "f00000.jpg"))) {
  console.log("· building background plate");
  fs.mkdirSync(bgDir, { recursive: true });
  const pp = path.join(bgDir, "_pp.mp4");
  ff(["-i", path.join(ROOT, "assets/bg-source.mp4"), "-filter_complex",
    `[0:v]scale=1080:1920:flags=lanczos,fps=${FPS},setpts=PTS-STARTPTS,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]`,
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", pp]);
  ff(["-stream_loop", "3", "-i", pp, "-t", "25", "-q:v", "4", "-start_number", "0", path.join(bgDir, "f%05d.jpg")]);
  fs.rmSync(pp);
}

// 2) audio: music bed (default) or the synthesised sound design (--sfx)
const sfx = path.join(ROOT, "sfx.wav");
// Licence gate: a folder with LICENSE.json whose "active" is false yields no track.
function licenceFor(dir) {
  const f = path.join(dir, "LICENSE.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
let licence = null;
let trackStart = 0;
function pickTrack() {
  if (MUSIC === "none") return null;
  const dir = fs.existsSync(MUSIC) && fs.statSync(MUSIC).isFile() ? path.dirname(MUSIC) : MUSIC;
  licence = fs.existsSync(dir) ? licenceFor(dir) : null;
  if (licence && licence.active === false) { console.warn(`! ${licence.provider} licence marked inactive — no music used`); return null; }
  if (fs.existsSync(MUSIC) && fs.statSync(MUSIC).isFile()) return MUSIC;
  if (!fs.existsSync(MUSIC)) return null;
  // Prefer the registered list (enabled tracks + their start points); fall back to a folder scan.
  const reg = (licence?.tracks || []).filter((t) => t.enabled !== false && fs.existsSync(path.join(MUSIC, t.file)));
  const tracks = reg.length ? reg.map((t) => t.file).sort()
    : fs.readdirSync(MUSIC).filter((f) => /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f)).sort();
  if (!tracks.length) return null;
  const day = Math.floor(Date.parse(delivery.run_date + "T00:00:00Z") / 864e5);
  const file = tracks[(day * 2 + (which === "trial_reel" ? 1 : 0)) % tracks.length];
  trackStart = reg.find((t) => t.file === file)?.start_sec || 0;
  return path.join(MUSIC, file);
}
const track = USE_SFX ? null : pickTrack();
if (!USE_SFX && !track) console.warn("! no music found (" + MUSIC + ") — building WITHOUT audio. Instagram shows muted reels less.");
if (USE_SFX && !fs.existsSync(sfx)) {
  console.log("· synthesising sound design");
  const py = spawnSync(process.platform === "win32" ? "python" : "python3", ["sound.py"], { cwd: ROOT, stdio: "ignore" });
  if (py.status) throw new Error("sound.py failed (needs numpy)");
}

// 3) frames, sharded across workers
const frames = fs.mkdtempSync(path.join(os.tmpdir(), "reel-frames-"));
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const scene = pathToFileURL(path.join(ROOT, "reel.html")).href + `?layout=${LAYOUT}`;
const dataJs = "window.DATA = " + JSON.stringify(DATA) + ";";
const t0 = Date.now();
console.log(`· rendering ${which} (${LAYOUT}) with ${WORKERS} workers`);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, args: ["--force-color-profile=srgb", "--allow-file-access-from-files"] });
const hasBg = fs.existsSync(path.join(bgDir, "f00000.jpg"));
const counts = await Promise.all([...Array(WORKERS).keys()].map(async (shard) => {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.route(/\/data\.js(\?.*)?$/, (route) => route.fulfill({ contentType: "text/javascript", body: dataJs }));
  await p.goto(scene);
  await p.waitForFunction("window.READY === true", null, { timeout: 30000 });
  if (hasBg) await p.evaluate("window.HASBG = true");
  const total = Math.round((await p.evaluate("window.DUR")) * FPS);
  let n = 0;
  for (let i = shard; i < total; i += WORKERS) {
    await p.evaluate(([t, i]) => (window.SEEKF ? window.SEEKF(t, i) : window.SEEK(t)), [i / FPS, i]);
    await p.screenshot({ type: "jpeg", quality: 96, path: path.join(frames, "f" + String(i).padStart(5, "0") + ".jpg") });
    n++;
  }
  await p.close();
  return n;
}));
await browser.close();
const nFrames = counts.reduce((a, b) => a + b, 0);
console.log(`  ${nFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// 4) encode (+ sound)
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
const DUR = nFrames / FPS;
const audio = USE_SFX
  ? ["-i", sfx, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest"]
  : track
    // loop if short, trim to the reel, 0.4 s fade-in, 1.8 s fade-out, level to about -14 LUFS (Instagram's own target)
    ? ["-ss", String(trackStart), "-stream_loop", "-1", "-i", track, "-map", "0:v", "-map", "1:a",
       "-af", `atrim=0:${DUR},asetpts=N/SR/TB,afade=t=in:d=0.4,afade=t=out:st=${(DUR - 1.8).toFixed(2)}:d=1.8,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000`,
       "-ac", "2", "-c:a", "aac", "-b:a", "192k", "-t", String(DUR)]
    : ["-an"];
ff(["-framerate", String(FPS), "-i", path.join(frames, "f%05d.jpg"), ...audio,
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile]);
fs.rmSync(frames, { recursive: true, force: true });
const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
// Sidecar record: which track (and under which licence) this reel was built with — proof if a claim ever comes.
fs.writeFileSync(outFile.replace(/\.mp4$/i, "") + ".audio.json", JSON.stringify({
  reel: which, run_date: delivery.run_date, built_at: new Date().toISOString(),
  audio: track ? { type: "music", file: path.basename(track), start_sec: trackStart, provider: licence?.provider ?? "unknown", plan: licence?.plan ?? null,
                   licence_account: licence?.account ?? null, licence_active_at_build: licence?.active ?? null }
       : USE_SFX ? { type: "sfx", file: "sfx.wav", provider: "synthesised in-house (sound.py)" } : { type: "none" },
}, null, 2));
console.log(`done: ${outFile} (${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s total)` + (track ? ` · music: ${path.basename(track)} from ${trackStart}s` : USE_SFX ? " · sfx" : " · NO AUDIO"));
