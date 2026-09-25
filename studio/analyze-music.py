"""Register music tracks in assets/music/LICENSE.json and find a good start point for each.

For every audio file not yet registered: parse "ES_<Title> - <Artist>.mp3" (Epidemic's naming),
measure duration, and pick `start_sec` — the first moment the music reaches its full energy
(so a 25-second reel does not play only the quiet intro). Run once after adding tracks:
    python studio/analyze-music.py
"""
import json
import re
import subprocess
from datetime import date
from pathlib import Path

import numpy as np

MUSIC = Path(__file__).resolve().parent.parent / "assets" / "music"
LIC = MUSIC / "LICENSE.json"
SR = 8000          # analysis sample rate (plenty for loudness)
WIN = 0.5          # seconds per RMS window
REEL = 24.8        # reel length the segment must fit


def pcm(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def best_start(x):
    n = int(SR * WIN)
    rms = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(n) / n, mode="valid")[::n] + 1e-12)
    db = 20 * np.log10(rms)
    dur = len(x) / SR
    body = np.percentile(db, 75)                    # the track's "full" level
    k = int(4 / WIN)                                # 4-second smoothing
    smooth = np.convolve(db, np.ones(k) / k, mode="valid")
    latest = max(0.0, dur - REEL - 2)
    for i, v in enumerate(smooth):
        t = i * WIN
        if t > latest:
            break
        if v >= body - 3:                           # within 3 dB of the full level
            # step back to the start of the rise so the fade-in lands on the build-up
            return round(max(0.0, t - 1.0), 1)
    return 0.0


def main():
    lic = json.loads(LIC.read_text(encoding="utf-8"))
    known = {t["file"] for t in lic.get("tracks", [])}
    added = 0
    for f in sorted(MUSIC.iterdir()):
        if f.suffix.lower() not in (".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg") or f.name in known:
            continue
        m = re.match(r"^ES_(.+?) - (.+)\.[a-z0-9]+$", f.name, re.I)
        title, artist = (m.group(1), m.group(2)) if m else (f.stem, "")
        x = pcm(f)
        lic["tracks"].append({
            "file": f.name, "title": title, "artist": artist,
            "duration_sec": round(len(x) / SR, 1), "start_sec": best_start(x),
            "instrumental": True, "added": date.today().isoformat(), "enabled": True,
        })
        added += 1
        print(f"  + {title} — {artist}: start {lic['tracks'][-1]['start_sec']} s of {lic['tracks'][-1]['duration_sec']} s")
    LIC.write_text(json.dumps(lic, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"registered {added} new track(s); {len(lic['tracks'])} total")


if __name__ == "__main__":
    main()
