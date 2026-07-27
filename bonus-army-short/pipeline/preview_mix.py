#!/usr/bin/env python3
"""Audio-only moodboard: VO + music/SFX placed from timing.json events.
NOT the final mix - a demo of the sound narrative for review.
Writes public/audio/preview-mix.wav
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).parent
PUB = HERE.parent / "public" / "audio"
SR = 24000

timing = json.loads((HERE.parent / "public" / "timing.json").read_text())
EV = timing["events"]
total = int(timing["totalMs"] / 1000 * SR)


def load(p: Path) -> np.ndarray:
    x, sr = sf.read(p, dtype="float32", always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = signal.resample_poly(x, SR, sr).astype(np.float32)
    return x


def place(mix, x, at_ms, gain=1.0, fade_in=0.0, fade_out=0.0, until_ms=None):
    x = x.copy() * gain
    if until_ms is not None:
        need = int((until_ms - at_ms) / 1000 * SR)
        if need <= 0:
            return
        reps = int(np.ceil(need / len(x)))
        x = np.tile(x, reps)[:need]
    if fade_in > 0:
        n = min(len(x), int(fade_in * SR))
        x[:n] *= np.linspace(0, 1, n)
    if fade_out > 0:
        n = min(len(x), int(fade_out * SR))
        x[-n:] *= np.linspace(1, 0, n)
    i = int(at_ms / 1000 * SR)
    end = min(total, i + len(x))
    if end > i:
        mix[i:end] += x[: end - i]


vo = load(PUB / "vo.wav")
mix = np.zeros(total, dtype=np.float32)
mix[: len(vo)] += vo

# ducking envelope for music: -11 dB while VO is loud
env = np.abs(signal.hilbert(vo))
env = signal.sosfilt(signal.butter(2, 4, "lowpass", fs=SR, output="sos"), env)
env = env / (env.max() or 1)
duck = 1.0 - 0.72 * np.clip(env * 6, 0, 1)
duck = np.concatenate([duck, np.ones(total - len(duck), dtype=duck.dtype)]).astype(
    np.float32
)

music = np.zeros(total, dtype=np.float32)
tense = load(PUB / "music" / "tense.wav")
army_cut = EV["b7.armyCut"]
place(music, tense, 0, gain=0.5, until_ms=army_cut)  # dead stop on "Army"
riser = load(PUB / "music" / "riser.wav")
place(music, riser, EV["b6.c3"] - 1800, gain=0.4)
drone = load(PUB / "music" / "drone.wav")
place(music, drone, EV["b8.start"], gain=0.55, fade_in=1.2, until_ms=EV["b11.start"])
place(
    music, drone, EV["b11.start"], gain=0.3, fade_in=2.0,
    until_ms=timing["totalMs"] - 300,
)
mix += music * duck

sfxdir = PUB / "sfx"
place(mix, load(sfxdir / "room-tone.wav"), army_cut, gain=0.5, until_ms=EV["b8.start"])
place(mix, load(sfxdir / "hooves.wav"), EV["b8.sabers"], gain=0.4, fade_out=0.6)
place(mix, load(sfxdir / "clank.wav"), EV["b8.bayonets"], gain=0.35)
place(mix, load(sfxdir / "rumble.wav"), EV["b8.tanks"], gain=0.6, fade_out=1.0)
place(mix, load(sfxdir / "fire.wav"), EV["b9.burned"], gain=0.5, fade_in=0.4,
      until_ms=EV["b10.start"])
place(mix, load(sfxdir / "boo.wav"), EV["b12.booed"], gain=0.35)
place(mix, load(sfxdir / "projector.wav"), EV["b12.audience"], gain=0.25,
      until_ms=EV["b12.fdr"])
for name, ev in [
    ("paper-slam.wav", "b2.number"), ("paper-slam.wav", "b3.owed"),
    ("thud.wav", "b3.date1945"), ("paper-slam.wav", "b6.voteCard"),
    ("stamp.wav", "b1.generals"), ("stamp.wav", "b7.hoover"),
    ("squeak.wav", "b11.quoteStart"), ("paper-slam.wav", "b12.headlines"),
]:
    place(mix, load(sfxdir / name), EV[ev], gain=0.55)

peak = np.abs(mix).max()
if peak > 0.98:
    mix *= 0.98 / peak
sf.write(PUB / "preview-mix.wav", mix, SR, subtype="PCM_16")
print(f"preview-mix.wav: {total / SR:.1f}s, peak {np.abs(mix).max():.2f}")
