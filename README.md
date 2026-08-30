# DubiLook — daily news reel template

Renders a 1080×1920 / 30 fps Instagram Reel from a single data file.
No design work happens at build time: the layout is fixed and tested, only the
content changes. That is what makes it safe to run unattended.

## Build

```bash
# write data.js first (see data.example.js), then:
bash build.sh                     # → reel-instagram.mp4 + reel-full.mp4 (silent)
WITH_SFX=1 bash build.sh          # → same, with the synthesised sound design
LAYOUTS=instagram bash build.sh   # → just one
```

Two layouts come out of one template:

| layout | for | difference |
|---|---|---|
| `instagram` | Reels | content held inside the IG safe area — clear of the top bar, the caption block and the right-hand action rail |
| `full` | WhatsApp, Telegram, YouTube Shorts | uses the whole frame, nothing is overlaid by the platform |

Roughly **4 minutes per layout** on 2 cores.

Requirements are already present in the Cowork cloud image: **chromium**
(under `/opt/pw-browsers/`) and **ffmpeg**. `build.sh` installs the Playwright
driver on first run; everything else — fonts, GSAP, icons, logo, photo — ships
in this repo, so the build needs no other network access.

Environment overrides: `FPS` (default 30), `WORKERS` (default 2).

Render time is roughly **2.5 minutes** for a 25 s reel on 2 cores.

## data.js

```js
window.DATA = {
  kicker:  "REGULATION",              // pill above the headline
  hook:    "Shared housing fines just doubled",
  hookGold:"just doubled",            // trailing words shown in gold
  sub:     "One line of context under the headline.",

  statLabelShort: "MAXIMUM PENALTY",  // card header

  // EITHER a chart …
  chart: {bars: [
    {label: "First\nviolation",  value: 500000,  color: "blue"},
    {label: "Repeat\nviolation", value: 1000000, color: "gold", badge: "×2 the penalty"}
  ]},

  // … OR chart:null plus these, for a single big number
  statValue: 1000000,
  statUnit:  "Dirham",
  statLabel: "Maximum fine for repeat violations",

  detail:   "The key fact, one sentence.",
  takeaway: "What it means for buyers or landlords, one sentence.",
  question: "A question that invites a comment.",

  icons: {stat:"justice-hammer", detail:"document-certificate", takeaway:"warning-diamond"},

  source: "GULF NEWS",
  date:   "26 AUG 2026"
};
```

**Length limits** — these keep the layout intact. Text is auto-shrunk as a
safety net, but staying inside these looks best:

| field    | max chars |
|----------|-----------|
| hook     | 60  |
| sub      | 90  |
| detail   | 130 |
| takeaway | 120 |
| question | 70  |

`chart.bars` takes 2 bars. `color` is `blue` or `gold` — put the emphasis on gold.

Available icon names are the `.svg` files in `assets/`.

## Scenes

| # | beat      | seconds |
|---|-----------|---------|
| 1 | hook      | 0.2 – 4.2 |
| 2 | stat/chart| 4.2 – 10.2 |
| 3 | detail    | 10.2 – 14.2 |
| 4 | takeaway  | 14.2 – 18.2 |
| 5 | question  | 18.2 – 21.4 |
| 6 | end card  | 21.4 – 24.8 |

## Files

```
reel.html      layout + master GSAP timeline (the design; edit here)
data.js        the day's content (generated per run, not committed)
render.js      sharded frame renderer (headless chromium)
build.sh       render + encode
assets/        fonts, logo, icons, bg-source.mp4 (the Veo plate)
vendor/        gsap
sound.py       synthesises sfx.wav from scratch — no samples, nothing to license
bg/            generated background frames (gitignored, rebuilt on first run)
```

## Daily email

Each run emails **saeedtabirzadeh@gmail.com** with both renders attached and a
ready-to-paste Instagram caption. Plain text, so it can be selected and copied
on a phone without picking up formatting.

```
Subject: DubiLook reel — {DATE} — {HOOK}

Two videos attached:
  reel-instagram.mp4   Instagram Reels (content clears the IG overlay)
  reel-full.mp4        WhatsApp / Telegram / YouTube Shorts

──────────── CAPTION — copy from here ────────────

{CAPTION}

{#TAG1} {#TAG2} {#TAG3} {#TAG4} #dubilook

──────────── copy to here ────────────

Source:    {SOURCE_NAME}
Link:      {SOURCE_URL}
Published: {DATE}
```

Caption rules: ≤220 characters, plain sentences, no emoji, ends on a question
that invites a comment, never repeats the on-screen `detail` text verbatim.

Hashtags: exactly 4 in the data, `#dubilook` is appended automatically = 5 total.
Instagram suppresses reach above 5. Prefer specific over broad — the place, the
developer or the segment the story is actually about (`dubaimarina`, `emaar`,
`offplan`, `servicecharges`) beats filler like `realestate`. At most one broad tag.

## Sound

`sound.py` generates every cue numerically — whooshes, impacts, risers, pops,
ticks, shimmer, plus a very low room tone so the cues do not sit on dead silence.
Nothing is downloaded, so there is no attribution or licence to track. Cue times
mirror the GSAP timeline; edit the cue sheet at the bottom of the file.

Off by default. Instagram's own audio library is usually the better choice for
Reels — using a trending track surfaces the post in that track's feed, which
baked-in audio cannot do. Use `WITH_SFX=1` for the WhatsApp and Telegram cuts,
where there is no such library.

## Layout guides

Append `?guide=1` to the scene URL to overlay the Instagram safe-area zones
(red = covered by IG chrome, orange = action rail, green dashed = usable).
