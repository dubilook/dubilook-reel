#!/usr/bin/env bash
# DubiLook daily reel — builds both deliverables from one data file.
#
#   bash build.sh                 → reel-instagram.mp4 + reel-full.mp4, silent
#   WITH_SFX=1 bash build.sh      → also lays the synthesised sound design under both
#   LAYOUTS=instagram bash build.sh → build only one
#
# Expects data.js in this directory (written by the daily task before calling).
set -euo pipefail
cd "$(dirname "$0")"

FPS="${FPS:-30}"
WORKERS="${WORKERS:-2}"
LAYOUTS="${LAYOUTS:-instagram full}"
WITH_SFX="${WITH_SFX:-0}"

[ -f data.js ] || { echo "ERROR: data.js is missing — write it before building."; exit 1; }

# ── dependencies ───────────────────────────────────────────────────────────
# chromium and ffmpeg ship with the Cowork cloud image; only the driver is fetched.
if [ ! -d node_modules/playwright ]; then
  echo "· installing playwright driver"
  npm install playwright --silent --no-audit --no-fund >/dev/null 2>&1
fi
CHROME="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)"
[ -n "$CHROME" ] || { echo "ERROR: no preinstalled chromium under /opt/pw-browsers"; exit 1; }
export CHROME_PATH="$CHROME"

# ── background plate ───────────────────────────────────────────────────────
# Ping-pong the source clip so the loop has no visible seam, then cut to frames
# so the browser has a real backdrop for the card's backdrop-filter to blur.
if [ -f assets/bg-source.mp4 ] && [ ! -f bg/f00000.jpg ]; then
  echo "· building background plate"
  mkdir -p bg
  ffmpeg -y -loglevel error -i assets/bg-source.mp4 -filter_complex \
    "[0:v]scale=1080:1920:flags=lanczos,fps=$FPS,setpts=PTS-STARTPTS,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" \
    -map "[v]" -an -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p bg/_pp.mp4
  ffmpeg -y -loglevel error -stream_loop 3 -i bg/_pp.mp4 -t 25 -q:v 4 -start_number 0 bg/f%05d.jpg
  rm -f bg/_pp.mp4
  echo "  $(ls bg | wc -l) background frames"
fi

# ── optional sound design ──────────────────────────────────────────────────
AUDIO_ARGS=()
if [ "$WITH_SFX" = "1" ]; then
  if [ ! -f sfx.wav ]; then
    echo "· synthesising sound design"
    python3 sound.py >/dev/null
  fi
  AUDIO_ARGS=(-i sfx.wav -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 192k -shortest)
else
  AUDIO_ARGS=(-an)
fi

# ── render each layout ─────────────────────────────────────────────────────
for LAYOUT in $LAYOUTS; do
  OUT="reel-${LAYOUT}.mp4"
  echo "· [$LAYOUT] rendering frames with $WORKERS workers"
  rm -rf frames && mkdir -p frames
  for s in $(seq 0 $((WORKERS-1))); do
    NSHARDS=$WORKERS SHARD=$s FPS=$FPS \
      SCENE="$PWD/reel.html?layout=${LAYOUT}" OUTDIR="$PWD/frames" node render.js &
  done
  wait

  N=$(ls frames | wc -l)
  [ "$N" -gt 0 ] || { echo "ERROR: no frames produced for $LAYOUT"; exit 1; }
  echo "  $N frames"

  echo "· [$LAYOUT] encoding $OUT"
  ffmpeg -y -loglevel error -framerate "$FPS" -i frames/f%05d.jpg "${AUDIO_ARGS[@]}" \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart "$OUT"
  rm -rf frames
  echo "  done: $OUT ($(du -h "$OUT" | cut -f1))"
done

echo "· all builds complete"
