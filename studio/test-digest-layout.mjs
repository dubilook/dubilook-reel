// PDF digest layout (batch 2026-10-17 PART 5, owner approved 17 Oct). Pure HTML checks, no browser:
//   node studio/test-digest-layout.mjs
// 1 «The day in one figure» block is gone · 2 the lead card (cards[0].lead) is full width at the top of page 1, carries
// its lead_text, and is not repeated · 3 every Instagram button goes to that card's own instagram_url · 4 cover AND
// closing block carry «Share this file on WhatsApp» → wa.me/?text= … https://dubilook.com/today/{date}
import * as R from "./digest-renderer.mjs";
const { digestHtml } = R, paginateCards = R.paginateCards || R.paginate;

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  ✗ " + m); } };
const card = (n, extra = {}) => ({ story: "s" + n, lang: "en", tag: "News", headline: "Headline number " + n, summary: "Summary " + n + ".", source: "Gulf News, 16 Oct 2026",
  hero: null, hero_shape: "4:5", source_url: "https://dubilook.com/n/s" + n, instagram_url: "https://www.instagram.com/p/post" + n + "/", reel_url: null, lead: false, ...extra });
const lead = card(0, { lead: true, headline: "Aldar buys 9 Sharjah buildings", lead_text: "Aldar bought nine buildings in Sharjah. The deal is its first there. About 1,000 homes. More will follow." });
const cards = [lead, ...Array.from({ length: 9 }, (_, i) => card(i + 1))];
const data = { date: "2026-10-16", date_label: "Friday, 16 October 2026", short_date: "16 Oct 2026", year: 2026, keyword: "Marina",
  page_url: "https://dubilook.com/today/2026-10-16", figures: [{ value: "292.5", unit: "Billion Dirham", label: "budget" }], cards };
const html = digestHtml(data);
const sheets = html.split('<section class="sheet').slice(1);

ok(!/The day in (one|two|three) figure/.test(html) && !html.includes('class="ledger'), "the figures block must be gone");
ok(sheets[0].includes('class="card lead"'), "page 1 has the lead card");
ok((sheets[0].match(/<article class="card/g) || []).length === 1, "page 1 carries only the lead under the masthead");
ok((html.match(/Aldar buys 9 Sharjah buildings/g) || []).length === 1, "the lead is not repeated below");
ok(sheets[0].includes("Aldar bought nine buildings in Sharjah. The deal is its first there. About 1,000 homes. More will follow."), "the lead shows its longer text");
for (const c of cards) ok(html.includes(`href="${c.instagram_url}"`), `Instagram button of "${c.headline}" goes to its own post`);
ok(!html.includes('href="https://www.instagram.com/dubilook"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/>'), "no card falls back to the profile here");
const wa = [...html.matchAll(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/g)].map((m) => decodeURIComponent(m[1].replace(/&amp;/g, "&").slice("https://wa.me/?text=".length)));
ok(wa.length === 2, `cover + closing block each carry one WhatsApp share (found ${wa.length})`);
ok(wa.every((t) => t.includes("https://dubilook.com/today/2026-10-16")), "the share text carries the /today/{date} page: " + JSON.stringify(wa));
ok(sheets[0].includes("Share this file on WhatsApp") && sheets.at(-1).includes("Share this file on WhatsApp"), "button label on the cover and in the closing block");
// pagination: lead alone on page 1, then 4 cells a page (the closing block counts as a cell)
const pages = paginateCards(["L", "a", "b", "c", "d", "e", "end"]);
ok(JSON.stringify(pages) === JSON.stringify([["L"], ["a", "b", "c", "d"], ["e", "end"]]), "pages: " + JSON.stringify(pages));
// a card with no own link left (site sends the profile) still renders; a reel-only link shows «Watch the reel»
const h2 = digestHtml({ ...data, cards: [lead, card(1, { instagram_url: "https://www.instagram.com/dubilook/", reel_url: "https://www.instagram.com/reel/r1/" })] });
ok(h2.includes('href="https://www.instagram.com/reel/r1/"'), "reel button");
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
