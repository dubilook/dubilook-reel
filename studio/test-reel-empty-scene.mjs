// Log fix 18 Nov 2026 (OI-149): the 13 Nov reel went live with an empty «WHAT CHANGED» scene (the site sent no
// `detail`). The site now refuses such a reel; this is the safety net in the template: a text scene whose text is
// empty is skipped, the scenes after it move up and the reel is that much shorter. With all three texts present the
// reel is exactly as before (24.8 s, same scene times). Opens reel.html the way build-reel.mjs does.
//   node studio/test-reel-empty-scene.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = { kicker: "MARKET", hook: "Ras Al Khaimah Property Hits Around 2.89 Billion Dirham", hookGold: "2.89 Billion Dirham",
  sub: "Deals in the emirate rose again this month.", statLabelShort: "MARKET", statValue: 2.89, statUnit: "Billion Dirham", statLabel: "MARKET",
  detail: "Sales and mortgages both grew compared with the same month last year.",
  takeaway: "Buyers looking north of Dubai now have more projects to compare.", question: "Would you buy in Ras Al Khaimah?",
  icons: { stat: "building-office", detail: "document-certificate", takeaway: "information-circle" }, dm_keyword: "Rakdeal",
  source: "WAM", date: "13 NOV 2026" };

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, args: ["--allow-file-access-from-files"] });
const scene = pathToFileURL(path.join(ROOT, "reel.html")).href + "?layout=instagram";

// what is on screen at every half second: the scenes with opacity > .5, and whether a visible text scene has no text
async function probe(DATA) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.route(/\/data\.js(\?.*)?$/, (route) => route.fulfill({ contentType: "text/javascript", body: "window.DATA = " + JSON.stringify(DATA) + ";" }));
  await p.goto(scene);
  await p.waitForFunction("window.READY === true", null, { timeout: 30000 });
  const dur = await p.evaluate("window.DUR");
  const skipped = await p.evaluate("window.SKIPPED");
  const frames = [];
  for (let t = 0.5; t < dur; t += 0.5) {
    await p.evaluate((x) => window.SEEK(x), t);
    frames.push(await p.evaluate((x) => {
      const vis = (el) => el && getComputedStyle(el).display !== "none" && +getComputedStyle(el).opacity > 0.5;
      const on = ["s1", "s2", "s3", "s4", "s5", "s6"].filter((id) => vis(document.getElementById(id)));
      const emptyText = ["s3", "s4", "s5"].filter((id) => on.includes(id) && !document.getElementById(id + "txt").textContent.trim());
      return { t: x, on, emptyText, dim: +getComputedStyle(document.getElementById("dim")).opacity };
    }, t));
  }
  await p.close();
  const first = (id) => frames.find((f) => f.on.includes(id))?.t ?? null;
  return { dur, skipped, frames, errors, first, seen: [...new Set(frames.flatMap((f) => f.on))] };
}

// 1. all texts present: nothing changes
const full = await probe(base);
ok(full.errors.length === 0, "no page error: " + full.errors.join(" | "));
ok(Math.abs(full.dur - 24.8) < 1e-9, `a full reel is 24.8 s (got ${full.dur})`);
ok(full.skipped.length === 0, "nothing skipped");
ok(full.seen.join() === "s1,s2,s3,s4,s5,s6", `all six scenes are shown (${full.seen.join()})`);
ok(full.first("s3") === 10.5 && full.first("s4") === 14.5 && full.first("s5") === 18.5 && full.first("s6") === 21.5, "the scenes start where they always did");
ok(full.frames.every((f) => f.emptyText.length === 0), "no empty text scene");

// 2. the 13 Nov case: no detail (missing, empty or only spaces) -> «WHAT CHANGED» is not shown
for (const [name, detail] of [["missing", undefined], ["empty", ""], ["spaces", "   "], ["null", null]]) {
  const r = await probe({ ...base, detail });
  ok(r.errors.length === 0, `${name}: no page error: ` + r.errors.join(" | "));
  ok(r.skipped.join() === "s3", `${name}: s3 is skipped (${r.skipped.join()})`);
  ok(!r.seen.includes("s3"), `${name}: the detail scene never appears`);
  ok(Math.abs(r.dur - 20.8) < 1e-9, `${name}: the reel is 4 s shorter (got ${r.dur})`);
  ok(r.first("s4") === 10.5 && r.first("s5") === 14.5 && r.first("s6") === 17.5, `${name}: the later scenes move up (s4 ${r.first("s4")}, s5 ${r.first("s5")}, s6 ${r.first("s6")})`);
  ok(r.frames.every((f) => f.emptyText.length === 0), `${name}: no empty text scene on any frame`);
  ok(r.frames.every((f) => f.on.length <= 1 || f.on.length === 2), `${name}: never more than a cross-fade on screen`);
  ok(r.frames.filter((f) => f.t > 3 && f.t < r.dur - 1).every((f) => f.on.length >= 1), `${name}: no blank gap between scenes`);
}

// 3. the rebuilt reel of 13 Nov as the site sent it: no detail, no takeaway, no question
const bare = await probe({ ...base, detail: undefined, takeaway: undefined, question: undefined });
ok(bare.errors.length === 0, "bare: no page error: " + bare.errors.join(" | "));
ok(bare.skipped.join() === "s3,s4,s5", `bare: the three text scenes are skipped (${bare.skipped.join()})`);
ok(bare.seen.join() === "s1,s2,s6", `bare: hook, number, end card (${bare.seen.join()})`);
ok(Math.abs(bare.dur - 13.6) < 1e-9, `bare: 13.6 s (got ${bare.dur})`);
ok(bare.first("s6") === 10.5, `bare: the end card follows the number (${bare.first("s6")})`);
ok(bare.frames.every((f) => f.dim < 0.01), "bare: the background is never dimmed for a text scene that is not there");

// 4. only the takeaway is missing
const noTake = await probe({ ...base, takeaway: "" });
ok(noTake.skipped.join() === "s4" && !noTake.seen.includes("s4"), "takeaway empty: s4 skipped");
ok(noTake.first("s3") === 10.5 && noTake.first("s5") === 14.5 && noTake.first("s6") === 17.5, "takeaway empty: s3 stays, s5 and s6 move up");
ok(noTake.frames.find((f) => f.t === 12)?.dim > 0.5 && noTake.frames.find((f) => f.t === 20)?.dim < 0.05, "takeaway empty: dim on for the text scenes, off for the end card");

await browser.close();
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
