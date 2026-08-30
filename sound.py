#!/usr/bin/env python3
"""Synthesise the reel's sound design from scratch — no samples, no licensing.

Every sound is generated numerically, so there is nothing to credit and nothing
to pay for. Cues are placed against the same timeline as the GSAP animation.
"""
import numpy as np, wave, sys, json

SR = 48000
DUR = 24.8
N = int(SR * DUR)
bus = np.zeros((N, 2), dtype=np.float64)


# ── helpers ────────────────────────────────────────────────────────────────
def env(n, attack, decay, curve=2.2):
    """Percussive envelope: fast attack, exponential decay."""
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a) ** 0.5
    tail = np.linspace(0, 1, max(1, n - a))
    e[a:] = (1 - tail) ** curve
    return e


def onepole_lp(x, cut):
    """Cheap one-pole low-pass; cut may be a scalar or a per-sample array."""
    c = np.full(len(x), cut, dtype=np.float64) if np.isscalar(cut) else cut
    a = np.exp(-2 * np.pi * c / SR)
    y = np.zeros(len(x))
    prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev
        y[i] = prev
    return y


def onepole_hp(x, cut):
    return x - onepole_lp(x, cut)


def place(sig, t, gain=1.0, pan=0.0):
    """Mix a mono signal into the stereo bus at time t (seconds)."""
    i = int(t * SR)
    n = min(len(sig), N - i)
    if n <= 0:
        return
    l = gain * (1 - max(0.0, pan)) ** 0.5
    r = gain * (1 + min(0.0, pan)) ** 0.5
    bus[i:i + n, 0] += sig[:n] * l
    bus[i:i + n, 1] += sig[:n] * r


# ── voices ─────────────────────────────────────────────────────────────────
def whoosh(dur=0.75, f0=240, f1=1250, back=False):
    n = int(dur * SR)
    noise = np.random.default_rng(int(f0 + f1 + dur * 1000)).normal(0, 1, n)
    sweep = np.linspace(f1, f0, n) if back else np.linspace(f0, f1, n)
    s = onepole_hp(onepole_lp(noise, sweep * 1.9), sweep * 0.55)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.4          # soft in / soft out
    return s * e * 0.26


def pop(freq=880, dur=0.13, drop=0.55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (drop + (1 - drop) * np.exp(-t * 26))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return s * env(n, 0.001, dur, 3.2) * 0.5


def thud(freq=140, dur=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (0.42 + 0.58 * np.exp(-t * 15))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    click = np.random.default_rng(7).normal(0, 1, n) * np.exp(-t * 300) * 0.25
    return (s + click) * env(n, 0.002, dur, 2.6) * 0.85


def riser(dur=0.9, f0=200, f1=1500):
    n = int(dur * SR)
    t = np.arange(n) / SR
    cut = np.linspace(f0, f1, n)
    noise = np.random.default_rng(11).normal(0, 1, n)
    s = onepole_hp(onepole_lp(noise, cut), cut * 0.6)
    tone = np.sin(2 * np.pi * np.cumsum(np.linspace(f0 * 1.4, f1 * 1.3, n)) / SR) * 0.22
    ramp = (t / dur) ** 1.7
    return (s * 0.6 + tone) * ramp * 0.5


def tick(freq=2100, dur=0.045):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 130) * 0.32


def shimmer(dur=1.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(3)
    for f in (1860, 2480, 3120, 4180, 5240):
        ph = rng.random() * 6.28
        out += np.sin(2 * np.pi * f * t + ph) * np.exp(-t * (2.0 + rng.random()))
    return out / 5 * np.sin(np.linspace(0, np.pi, n)) ** 0.7 * 0.42


def airbed(dur=DUR):
    """Very low room tone so the cues do not sit on dead silence. Not music."""
    n = int(dur * SR)
    noise = np.random.default_rng(5).normal(0, 1, n)
    s = onepole_lp(noise, 160)
    s /= (np.max(np.abs(s)) + 1e-9)
    swell = 0.65 + 0.35 * np.sin(np.linspace(0, 3.1, n))
    e = np.ones(n)
    f = int(1.5 * SR)
    e[:f] = np.linspace(0, 1, f)
    e[-f:] = np.linspace(1, 0, f)
    return s * swell * e * 0.055


# ── cue sheet — mirrors the GSAP timeline in reel.html ─────────────────────
place(airbed(), 0.0, 0.85)

# S1 hook
place(whoosh(0.80, 220, 1150), 0.10, 0.30, -0.2)
place(tick(2300), 0.46, 0.5)
place(tick(1900), 0.58, 0.45)
place(pop(520, 0.16), 0.28, 0.30)

# S2 card + chart
place(whoosh(0.75, 240, 1250), 4.16, 0.32, 0.2)
place(thud(120, 0.38), 4.30, 0.35)
place(pop(760, 0.14), 4.52, 0.32)
place(riser(0.90, 220, 1400), 5.24, 0.34)          # bar 1 climbs
place(thud(150, 0.36), 6.14, 0.45)                 # bar 1 lands
place(riser(1.10, 240, 1750), 6.02, 0.40)          # bar 2 climbs
place(thud(110, 0.50), 7.14, 0.62)                 # bar 2 lands, heavier
place(pop(1180, 0.15), 7.32, 0.42)                 # ×2 badge
place(shimmer(1.1), 7.34, 0.20)

# S3 / S4 / S5 scene changes
for t, pan in ((10.12, -0.25), (14.12, 0.25), (18.12, -0.2)):
    place(whoosh(0.70, 210, 1100), t, 0.28, pan)
    place(pop(640, 0.13), t + 0.20, 0.26)
    place(tick(2000), t + 0.42, 0.30)

# S6 end card
place(whoosh(0.85, 200, 1300), 21.30, 0.32, 0.0)
place(pop(880, 0.18), 21.50, 0.34)
place(thud(105, 0.55), 22.26, 0.40)
place(shimmer(1.6), 22.30, 0.30)
place(tick(2400), 23.16, 0.26)


# ── master ─────────────────────────────────────────────────────────────────
peak = np.max(np.abs(bus))
bus *= (0.72 / peak)                                   # headroom, no clipping
lim = np.tanh(bus * 1.12) * 0.9                        # gentle soft-clip
pcm = (np.clip(lim, -1, 1) * 32767).astype(np.int16)

with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print(f'sfx.wav  {DUR}s  peak {peak:.3f} -> normalised')
