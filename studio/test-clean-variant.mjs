// PART 2 (2026-10-17): an item with dm_keyword also gets a CLEAN file (no «Comment X» pill) for Telegram / Facebook /
// Threads — Telegram has no comment→DM, so the promise must not be there. Runs render-job.mjs against a fake site.
//   node studio/test-clean-variant.mjs
// Checks: image post → position 22 variant clean, differs from the main file; carousel → clean last slide at 23
// (meta.slide = last index); edu card → 22 clean; items WITHOUT a keyword upload no clean file.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
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
      slides: [news, news], dm_keyword: "Weekly" } },
  { id: 4, format: "image", template: "edu-law", data: { kind: "law", headline: "Your landlord needs 12 months notice", red: ["12 months"], body: "Notice by notary.", ref: "Law No. 26 of 2007", source: "DLD", dm_keyword: "Notice" } },
] };
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cleanv-")), "payload.json");
fs.writeFileSync(pf, JSON.stringify(payload));
const child = spawn(process.execPath, [path.join(ROOT, "studio/render-job.mjs"), pf], { env: { ...process.env, IG_API_SECRET: "t" }, stdio: ["ignore", "inherit", "inherit"] });
const code = await new Promise((r) => child.on("exit", r));
server.close();

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const find = (item, pos) => got.find((g) => g.item === item && g.position === pos);
ok(code === 0, "render-job exit " + code);
ok(complete && complete.items.length === 4, "render-complete lists 4 items: " + JSON.stringify(complete));
const c1 = find(1, 22), m1 = find(1, 0);
ok(c1 && c1.meta.variant === "clean", "image post with keyword: no clean file at 22");
ok(c1 && m1 && !c1.bytes.equals(m1.bytes), "image post: clean file equals the pill file");
ok(!got.some((g) => g.item === 2 && g.meta.variant === "clean"), "image post WITHOUT keyword uploaded a clean file");
const slides = got.filter((g) => g.item === 3 && g.position < 20).length;
const c3 = find(3, 23);
ok(c3 && c3.meta.variant === "clean" && c3.meta.slide === slides - 1, `carousel: no clean last slide at 23 with meta.slide=${slides - 1}: ${JSON.stringify(c3 && c3.meta)}`);
ok(c3 && !c3.bytes.equals(find(3, slides - 1).bytes), "carousel: clean last slide equals the pill slide");
const c4 = find(4, 22);
ok(c4 && c4.meta.variant === "clean" && !c4.bytes.equals(find(4, 0).bytes), "edu card with keyword: no distinct clean file at 22");
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
