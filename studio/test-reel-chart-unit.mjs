// Fix pack 1.5 #5 (owner 2026-10-26): the 26 Oct reel's chart showed «30» and «3» with no unit. When the site sends
// chart.unit («Billion Dirham») every bar carries it under its value, in the bar's colour, inside its column; without
// chart.unit the chart is exactly as before. Opens reel.html the way build-reel.mjs does (data.js intercepted).
//   node studio/test-reel-chart-unit.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = { kicker: "INFRASTRUCTURE", hook: "Dubai's New Drainage Plan Costs 3 Billion Dirham", hookGold: "3 Billion Dirham",
  sub: "Phase three of the Tasreef programme targets a 700% capacity boost by 2033.", statLabelShort: "TASREEF PHASE 3",
  chart: { bars: [{ label: "TOTAL TASREEF PLAN", value: 30, color: "blue" }, { label: "PHASE 3 AWARDED", value: 3, color: "gold", badge: "NEW" }] },
  statValue: null, statUnit: null, statLabel: null, detail: "The 100km drainage upgrade covers 100 square kilometres.",
  takeaway: "Better flood protection can support property values.", question: "Would better drainage change how you value a Dubai home?",
  icons: { stat: "building-office", detail: "document-certificate", takeaway: "real-estate-deal-shake-building" }, dm_keyword: "Drain",
  source: "THE NATIONAL", date: "25 OCT 2026" };

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined, args: ["--allow-file-access-from-files"] });
const scene = pathToFileURL(path.join(ROOT, "reel.html")).href + "?layout=instagram";

async function render(DATA) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.route(/\/data\.js(\?.*)?$/, (route) => route.fulfill({ contentType: "text/javascript", body: "window.DATA = " + JSON.stringify(DATA) + ";" }));
  await p.goto(scene);
  await p.waitForFunction("window.READY === true", null, { timeout: 30000 });
  await p.evaluate("window.SEEKF ? window.SEEKF(8.5, 255) : window.SEEK(8.5)");   // the chart scene, values counted up
  const r = await p.evaluate(() => {
    const units = [...document.querySelectorAll(".unit")].map((u) => {
      const col = u.closest(".col"), cr = col.getBoundingClientRect(), ur = u.getBoundingClientRect(), bar = col.querySelector(".bar").getBoundingClientRect(), val = col.querySelector(".val").getBoundingClientRect();
      return { text: u.textContent, color: getComputedStyle(u).color, valColor: getComputedStyle(col.querySelector(".val")).color, opacity: +getComputedStyle(u).opacity,
        inside: ur.left >= cr.left - 1 && ur.right <= cr.right + 1, overflow: u.scrollWidth > u.clientWidth + 1,
        belowValue: ur.top >= val.bottom - 12, aboveBar: ur.bottom <= bar.top + 1 };
    });
    return { units, vals: [...document.querySelectorAll(".val")].map((v) => v.textContent) };
  });
  await p.close();
  return r;
}

const withUnit = await render({ ...base, chart: { ...base.chart, unit: "Billion Dirham" } });
ok(withUnit.units.length === 2, `two unit lines, one per bar (found ${withUnit.units.length})`);
for (const [i, u] of withUnit.units.entries()) {
  ok(u.text === "BILLION DIRHAM", `bar ${i}: unit text «${u.text}»`);
  ok(u.color === u.valColor, `bar ${i}: unit in the bar's colour (${u.color} vs value ${u.valColor})`);
  ok(u.opacity > 0.5, `bar ${i}: unit visible on the chart frame (opacity ${u.opacity})`);
  ok(u.inside && !u.overflow, `bar ${i}: unit fits inside its column`);
  ok(u.belowValue && u.aboveBar, `bar ${i}: unit sits between the value and the bar`);
}
ok(withUnit.vals.join("|") === "30|3", `the values stay plain numbers: ${withUnit.vals.join("|")}`);
const plain = await render(base);
ok(plain.units.length === 0, `without chart.unit there is no unit line (found ${plain.units.length})`);
ok(plain.vals.join("|") === "30|3", "and the values are as before");
await browser.close();
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
