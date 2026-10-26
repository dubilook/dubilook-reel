// render-job.mjs against a fake site (batch R68, owner 2026-10-17 [stated]; fix pack 2026-10-20 #6 + #8):
//   · #8: every file with the badge also gets a BADGE-FREE copy, variant "clean" at 40 + its position (Telegram/Facebook)
//   · #6: a news carousel shows each slide's OWN keyword, the cover none (a one-word carousel from before: every slide)
//   · the last slide is the fixed end
//     poster assets/end-poster.jpg, byte for byte, for every carousel (with or without keyword); ≤ 10 slides in all
//   · digest: page-1 image at 31, PDF at 30 (PART 6 of fixes-1017, kept)
//   node studio/test-render-job.mjs
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const got = [];   // {item, position, kind, meta, size, bytes}
let complete = null;
const server = http.createServer((req, res) => {
  const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", async () => {
    const body = Buffer.concat(chunks);
    if (req.url.endsWith("/render-complete")) { complete = JSON.parse(body.toString()); res.end("{}"); return; }
    const fd = await new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body }).formData();
    const file = fd.get("file"), bytes = Buffer.from(await file.arrayBuffer());
    got.push({ item: +fd.get("item"), position: +fd.get("position"), kind: fd.get("kind"), meta: JSON.parse(fd.get("meta") || "{}"), bytes });
    res.end("{}");
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const cb = `http://127.0.0.1:${server.address().port}/ig/api/render-callback`;
const news = { type: "news", category: "property", headline: "Ejari registration goes fully digital across Dubai", red: ["fully digital"],
  summary: "Dubai Land Department says 12,000 tenancy contracts were registered online.", source: "GULF NEWS", date: "2026-10-16" };
const payload = { brand: "test", job: 1, callback: cb, day: "2026-10-16", items: [
  { id: 1, format: "image", template: "post-news", data: { ...news, dm_keyword: "Ejari" } },
  { id: 2, format: "image", template: "post-news", data: { ...news } },
  { id: 3, format: "carousel", template: "carousel-news", data: { cover_title: "This week", date: "2026-10-16", cover_hooks: ["a", "b", "c"], cta: "Send this to a colleague",
      slides: [{ ...news, dm_keyword: "Rent" }, { ...news, dm_keyword: "Stake" }] } },
  { id: 9, format: "carousel", template: "carousel-news", data: { cover_title: "Before the fix", date: "2026-10-16", cover_hooks: ["a", "b", "c"], cta: "Send this to a colleague",
      slides: [news, news], dm_keyword: "Weekly" } },
  { id: 6, format: "carousel", template: "carousel-news", data: { cover_title: "Nine stories", date: "2026-10-16", cover_hooks: ["a", "b", "c"], cta: "Send this to a colleague",
      slides: Array.from({ length: 9 }, () => news) } },
  { id: 5, format: "image", template: "post-digest", data: { dm_keyword: "Marina", digest: { date: "2026-10-16", date_label: "Friday, 16 October 2026", short_date: "16 Oct 2026", year: 2026,
      cards: [0, 1, 2, 3].map((k) => ({ lang: "en", tag: "News", headline: "Story " + k, summary: "S.", source: "Gulf News", hero: null, hero_shape: "4:5", source_url: null, instagram_url: "https://www.instagram.com/p/x" + k + "/", lead: k === 0, lead_text: "Lead." })) } } },
  // R69 (R68 high K1 + owner 2026-10-17 21:25 [stated]): a CHECKLIST carousel carries the keyword badge on cover and
  // every step, and ends on the same fixed end poster as news carousels (its own light end slide is gone); ≤ 10 slides
  { id: 7, format: "carousel", template: "edu-checklist", data: { kind: "checklist", headline: "Before you sign a lease", red: ["sign"], subtitle: "Nine checks",
      steps: Array.from({ length: 9 }, (_, k) => ({ title: "Check " + (k + 1), body: "Look at the Ejari record." })), cta: "Save this", dm_keyword: "Tenant" } },
  { id: 8, format: "carousel", template: "edu-checklist", data: { kind: "checklist", headline: "Two checks", red: [], subtitle: "",
      steps: [{ title: "One", body: "A." }, { title: "Two", body: "B." }], cta: "Save this" } },
  { id: 4, format: "image", template: "edu-law", data: { kind: "law", headline: "Your landlord needs 12 months notice", red: ["12 months"], body: "Notice by notary.", ref: "Law No. 26 of 2007", source: "DLD", dm_keyword: "Notice" } },
] };
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rjob-")), "payload.json");
fs.writeFileSync(pf, JSON.stringify(payload));
const child = spawn(process.execPath, [path.join(ROOT, "studio/render-job.mjs"), pf], { env: { ...process.env, IG_API_SECRET: "t" }, stdio: ["ignore", "inherit", "inherit"] });
const code = await new Promise((r) => child.on("exit", r));
server.close();

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const find = (item, pos) => got.find((g) => g.item === item && g.position === pos);
ok(code === 0, "render-job exit " + code);
ok(complete && complete.items.length === 9, "render-complete lists 9 items: " + JSON.stringify(complete));
const poster = fs.readFileSync(path.join(ROOT, "assets", "end-poster.jpg"));
// decode the uploaded JPEGs in a browser and look at the top-LEFT corner (gold = the badge; fix pack 1.5 #9 moved it there)
const exe = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const pg = await browser.newPage();
const corner = (g) => pg.evaluate(async (u) => { const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  return [...x.getImageData(60, 10, 1, 1).data].slice(0, 3); }, "data:image/jpeg;base64," + g.bytes.toString("base64"));
const gold = (p) => Math.abs(p[0] - 0xC9) < 30 && Math.abs(p[1] - 0xA2) < 30 && Math.abs(p[2] - 0x4A) < 30;
ok(!got.some((g) => g.item === 3 && g.position < 20 && g.meta.variant), "carousel 3: a main file carries a variant (the site would leave it out of the post)");
const c3 = got.filter((g) => g.item === 3 && g.position < 20).sort((a, b) => a.position - b.position);
ok(c3.length === 4, "carousel 3: expected cover + 2 slides + poster = 4 files, got " + c3.length);
ok(c3.length && !gold(await corner(c3[0])), "#6 carousel 3: the COVER carries a badge");
for (const g of c3.slice(1, -1)) ok(gold(await corner(g)), `#6 carousel 3 slide ${g.position}: no gold keyword badge of its own`);
ok(c3.length && c3[c3.length - 1].bytes.equals(poster), "carousel 3: last slide is not the fixed end poster");
// #8: the clean set of the carousel — every position, no badge anywhere, the poster last
const k3 = got.filter((g) => g.item === 3 && g.meta.variant === "clean").sort((a, b) => a.position - b.position);
ok(k3.length === 3 && k3.every((g, i) => g.position === 40 + i && g.meta.of === i), "#8 carousel 3: clean set 40..42 (cover + 2 slides), got " + k3.map((g) => g.position));
for (const g of k3) ok(!gold(await corner(g)), `#8 carousel 3 clean ${g.position}: has a badge`);
ok(!k3.some((g) => g.bytes.equals(poster)), "#8 carousel 3: the «comment it» end poster is in the clean set");
// a one-word carousel from before the change: the old look (badge on the cover and every slide)
const c9 = got.filter((g) => g.item === 9 && g.position < 20).sort((a, b) => a.position - b.position);
for (const g of c9.slice(0, -1)) ok(gold(await corner(g)), `old carousel 9 slide ${g.position}: no badge`);
const m1 = find(1, 0);
ok(m1 && gold(await corner(m1)), "image post with keyword: no corner badge");
ok(find(1, 40) && find(1, 40).meta.variant === "clean" && !gold(await corner(find(1, 40))), "#8 image post: no badge-free clean copy at 40");
ok(find(2, 0) && !gold(await corner(find(2, 0))), "image post WITHOUT keyword has a gold corner");
ok(!got.some((g) => g.item === 2 && g.meta.variant === "clean"), "#8 a post without keyword needs no clean copy");
ok(find(4, 0) && gold(await corner(find(4, 0))), "edu card with keyword: no corner badge");
ok(find(4, 40) && !gold(await corner(find(4, 40))), "#8 edu card: no badge-free clean copy at 40");
const c6 = got.filter((g) => g.item === 6 && g.position < 20).sort((a, b) => a.position - b.position);
ok(c6.length === 10 && c6.every((g, k) => g.position === k), "carousel of 9 stories: expected 10 files at 0..9, got " + c6.map((g) => g.position));
ok(c6.length && c6[c6.length - 1].bytes.equals(poster), "carousel without keyword: last slide is not the end poster");
ok(c6.length && !gold(await corner(c6[0])), "carousel without keyword: the cover has a badge");
// R69 PART 1: checklist carousels
const c7 = got.filter((g) => g.item === 7 && g.position < 20).sort((a, b) => a.position - b.position);
ok(c7.length === 10 && c7.every((g, k) => g.position === k), "checklist of 9 steps: expected 10 files at 0..9, got " + c7.map((g) => g.position));
for (const g of c7.slice(0, -1)) ok(gold(await corner(g)), `checklist with keyword, slide ${g.position}: no gold keyword badge`);
ok(c7.length && c7[c7.length - 1].bytes.equals(poster), "checklist with keyword: last slide is not the fixed end poster");
ok(!got.some((g) => g.item === 7 && g.position < 20 && g.meta.variant), "checklist: a main file carries a variant");
const k7 = got.filter((g) => g.item === 7 && g.meta.variant === "clean").sort((a, b) => a.position - b.position);
ok(k7.length === 9 && k7.every((g, i) => g.position === 40 + i), "#8 checklist: clean set 40..48 (no end poster), got " + k7.map((g) => g.position));
for (const g of k7) ok(!gold(await corner(g)), `#8 checklist clean ${g.position}: has a badge`);
ok(!got.some((g) => g.item === 8 && g.meta.variant === "clean"), "#8 checklist without keyword: no clean set");
const c8 = got.filter((g) => g.item === 8 && g.position < 20).sort((a, b) => a.position - b.position);
ok(c8.length === 4, "checklist of 2 steps: expected cover + 2 + poster = 4 files, got " + c8.length);
for (const g of c8.slice(0, -1)) ok(!gold(await corner(g)), `checklist WITHOUT keyword, slide ${g.position}: has a gold corner`);
ok(c8.length && c8[c8.length - 1].bytes.equals(poster), "checklist without keyword: last slide is not the fixed end poster");
await browser.close();
// PART 6: the digest also uploads an image of its first page (the /today/{date} preview), never part of the post
const p1 = find(5, 31);
ok(p1 && p1.kind === "image" && p1.meta.variant === "digest-page1" && p1.bytes.length > 5000, "digest: no page-1 image at 31: " + JSON.stringify(p1 && p1.meta));
ok(find(5, 30) && find(5, 30).kind === "pdf", "digest PDF still at 30");
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
