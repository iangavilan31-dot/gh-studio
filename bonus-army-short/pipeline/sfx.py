#!/usr/bin/env python3
"""Procedural SFX + music kit (numpy → WAV).

The network policy of the build environment blocks Pixabay/Freesound, so the
full sound kit is synthesized. Every asset is seeded/deterministic. If you
later swap in CC0 recordings, keep the same filenames and the mix Just Works.

Outputs to ../public/audio/sfx/ and ../public/audio/music/.
"""
import numpy as np
from pathlib import Path
from scipy import signal

SR = 24000
OUT_SFX = Path(__file__).parent.parent / "public" / "audio" / "sfx"
OUT_MUS = Path(__file__).parent.parent / "public" / "audio" / "music"
rng = np.random.default_rng(1932)


def t(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def env_exp(dur: float, k: float) -> np.ndarray:
    return np.exp(-k * t(dur))


def bp(x: np.ndarray, lo: float, hi: float, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def lp(x: np.ndarray, fc: float, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, fc, "lowpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def hp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, fc, "highpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = np.abs(x).max()
    return (x * (peak / m)).astype(np.float32) if m > 0 else x.astype(np.float32)


def write(name: str, x: np.ndarray, folder: Path = OUT_SFX, peak: float = 0.9):
    import soundfile as sf

    folder.mkdir(parents=True, exist_ok=True)
    sf.write(folder / name, norm(x, peak), SR, subtype="PCM_16")
    print(f"{name}: {len(x) / SR:.2f}s")


# ------------------------------------------------------------------ one-shots


def paper_slam() -> np.ndarray:
    n = rng.standard_normal(int(0.09 * SR))
    slap = bp(n, 250, 3200) * env_exp(0.09, 55)
    thump = np.sin(2 * np.pi * np.cumsum(np.linspace(130, 55, int(0.1 * SR))) / SR)
    thump *= env_exp(0.1, 30)
    crinkle = bp(rng.standard_normal(int(0.05 * SR)), 2800, 7000) * env_exp(0.05, 80)
    out = np.zeros(int(0.35 * SR), dtype=np.float32)
    out[: len(slap)] += slap
    out[: len(thump)] += 0.9 * thump.astype(np.float32)
    out[int(0.012 * SR) : int(0.012 * SR) + len(crinkle)] += 0.35 * crinkle
    return out


def whoosh(dur: float = 0.26, f_lo: float = 350, f_hi: float = 1400) -> np.ndarray:
    n = rng.standard_normal(int(dur * SR))
    x = bp(n, f_lo, f_hi)
    e = np.sin(np.pi * np.linspace(0, 1, len(x))) ** 2.2
    return (x * e).astype(np.float32)


def soft_pop() -> np.ndarray:
    tt = t(0.07)
    tone = np.sin(2 * np.pi * 340 * tt) * env_exp(0.07, 70)
    click = bp(rng.standard_normal(int(0.012 * SR)), 900, 4500) * env_exp(0.012, 300)
    out = tone.astype(np.float32)
    out[: len(click)] += 0.5 * click
    return out


def thud() -> np.ndarray:
    tt = t(0.42)
    body = np.sin(2 * np.pi * (58 * tt - 14 * tt**2)) * env_exp(0.42, 11)
    knock = lp(rng.standard_normal(int(0.02 * SR)), 500) * env_exp(0.02, 160)
    out = body.astype(np.float32)
    out[: len(knock)] += 0.8 * knock
    return out


def marker_squeak() -> np.ndarray:
    dur = 0.38
    tt = t(dur)
    wob = np.cumsum(rng.standard_normal(len(tt))) * 0.9
    freq = 1350 + 260 * np.sin(2 * np.pi * 7 * tt) + wob
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    strokes = (np.sin(2 * np.pi * 5.2 * tt) > -0.25).astype(float)
    strokes = lp(strokes, 60, 2)
    grit = bp(rng.standard_normal(len(tt)), 900, 5200) * 0.2
    return ((tone * 0.8 + grit) * strokes * env_exp(dur, 3)).astype(np.float32)


def metal_clank() -> np.ndarray:
    dur = 0.6
    base = 470.0
    out = np.zeros(int(dur * SR), dtype=np.float32)
    for ratio, amp, k in [(1.0, 1.0, 9), (2.76, 0.6, 12), (5.40, 0.4, 16), (8.93, 0.25, 22)]:
        f = base * ratio * (1 + rng.normal(0, 0.004))
        out += (amp * np.sin(2 * np.pi * f * t(dur)) * env_exp(dur, k)).astype(
            np.float32
        )
    strike = bp(rng.standard_normal(int(0.015 * SR)), 1500, 8000) * env_exp(0.015, 250)
    out[: len(strike)] += 0.9 * strike
    return out


def camera_click() -> np.ndarray:
    c1 = bp(rng.standard_normal(int(0.012 * SR)), 1800, 8000) * env_exp(0.012, 320)
    c2 = bp(rng.standard_normal(int(0.018 * SR)), 900, 5000) * env_exp(0.018, 220)
    out = np.zeros(int(0.09 * SR), dtype=np.float32)
    out[: len(c1)] += c1
    out[int(0.035 * SR) : int(0.035 * SR) + len(c2)] += 0.8 * c2
    return out


def stamp() -> np.ndarray:
    """Rubber-stamp hit for cutout entrances: thump + slap, drier than paper_slam."""
    n = bp(rng.standard_normal(int(0.05 * SR)), 400, 2600) * env_exp(0.05, 90)
    body = np.sin(2 * np.pi * 95 * t(0.09)) * env_exp(0.09, 45)
    out = np.zeros(int(0.2 * SR), dtype=np.float32)
    out[: len(n)] += n
    out[: len(body)] += 0.8 * body.astype(np.float32)
    return out


# ------------------------------------------------------------------ beds/loops


def hooves(dur: float = 4.0) -> np.ndarray:
    out = np.zeros(int(dur * SR), dtype=np.float32)

    def clop() -> np.ndarray:
        d = 0.05
        knock = lp(rng.standard_normal(int(d * SR)), 900, 4) * env_exp(d, 90)
        ping = np.sin(2 * np.pi * 620 * t(d)) * env_exp(d, 120) * 0.4
        return (knock + ping).astype(np.float32)

    n_horses = 7
    for h in range(n_horses):
        phase = rng.uniform(0, 0.5)
        tempo = rng.uniform(1.55, 1.8)  # strides/sec, walking pace
        amp = rng.uniform(0.4, 1.0)
        tt = phase
        step = 0
        while tt < dur - 0.1:
            c = clop() * amp * rng.uniform(0.6, 1.0)
            i = int(tt * SR)
            out[i : i + len(c)] += c[: len(out) - i]
            # 4-beat walk gait: uneven sub-intervals
            step += 1
            tt += (0.5 if step % 2 else 0.36) / tempo
    return lp(out, 2400)


def rumble(dur: float = 5.0) -> np.ndarray:
    brown = np.cumsum(rng.standard_normal(int(dur * SR)))
    brown = hp(brown, 18)
    x = lp(brown, 95)
    lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * t(dur) + 1.2)
    return (x * lfo).astype(np.float32)


def fire(dur: float = 5.0) -> np.ndarray:
    n = int(dur * SR)
    roar = lp(np.cumsum(rng.standard_normal(n)), 380)
    roar = hp(roar, 130) * 0.5
    crackle = np.zeros(n, dtype=np.float32)
    n_pops = int(dur * 34)
    for _ in range(n_pops):
        i = rng.integers(0, n - int(0.03 * SR))
        d = rng.uniform(0.004, 0.02)
        p = bp(rng.standard_normal(int(d * SR)), 1100, 6500) * env_exp(d, 240)
        crackle[i : i + len(p)] += p * rng.uniform(0.3, 1.0)
    return (roar + crackle).astype(np.float32)


def projector(dur: float = 4.0) -> np.ndarray:
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    frame_rate = 16.0
    for k in range(int(dur * frame_rate)):
        i = int(k / frame_rate * SR + rng.normal(0, 0.0008) * SR)
        if 0 <= i < n - 200:
            d = 0.006
            c = bp(rng.standard_normal(int(d * SR)), 1200, 4200) * env_exp(d, 260)
            out[i : i + len(c)] += c * rng.uniform(0.6, 1.0)
    hum = 0.12 * np.sin(2 * np.pi * 50 * t(dur)) * (1 + 0.1 * np.sin(2 * np.pi * 0.7 * t(dur)))
    whir = bp(rng.standard_normal(n), 300, 900) * 0.05
    return (out + hum.astype(np.float32) + whir).astype(np.float32)


def crowd_boo(dur: float = 3.0) -> np.ndarray:
    """Distant newsreel-audience disapproval: many low detuned voices, muffled."""
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    for _ in range(46):
        f0 = rng.uniform(95, 200)
        vib = 1 + 0.02 * np.sin(2 * np.pi * rng.uniform(3.5, 6.5) * t(dur) + rng.uniform(0, 6))
        raw = signal.sawtooth(2 * np.pi * f0 * np.cumsum(vib) / SR)
        voice = bp(raw, 220, 900, 2) + 0.5 * bp(raw, 500, 1100, 2)
        a0, a1 = rng.uniform(0, 0.4), rng.uniform(0.6, 1.0)
        e = np.interp(np.linspace(0, 1, n), [0, 0.25, 0.7, 1], [a0, a1, a1 * 0.8, 0.1])
        out += (voice * e * rng.uniform(0.4, 1.0) / 46).astype(np.float32)
    return lp(out, 1400)


def room_tone(dur: float = 6.0) -> np.ndarray:
    n = int(dur * SR)
    white = rng.standard_normal(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    pink = signal.lfilter(b, a, white).astype(np.float32)
    hum = 0.06 * np.sin(2 * np.pi * 60 * t(dur))
    return (lp(pink, 3200) * 0.5 + hum.astype(np.float32)).astype(np.float32)


# ------------------------------------------------------------------ music


def ks_pluck(freq: float, dur: float, damp: float = 0.996) -> np.ndarray:
    """Karplus-Strong string, lowpassed to a felt-piano-ish tone."""
    n = int(dur * SR)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    buf = lp(buf, 1600, 2)
    out = np.zeros(n, dtype=np.float32)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = damp * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    att = int(0.004 * SR)
    out[:att] *= np.linspace(0, 1, att)
    return lp(out, 2200)


A2, C3, E3, G2, F2, D3, E2 = 110.0, 130.81, 164.81, 98.0, 87.31, 146.83, 82.41


def music_tense(dur: float = 40.0) -> np.ndarray:
    """Sparse tense motif in A minor. One low note every couple of seconds,
    minor-second rub near the end of each phrase."""
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    motif = [
        (0.0, A2, 1.0), (2.2, E2, 0.7), (4.0, C3, 0.85), (6.4, A2, 0.9),
        (8.2, F2, 0.8), (10.4, E3, 0.5), (12.0, A2, 1.0), (14.6, D3, 0.6),
    ]
    phrase_len = 16.0
    for rep in range(int(np.ceil(dur / phrase_len))):
        for at, f, amp in motif:
            tt = max(0.0, rep * phrase_len + at + rng.normal(0, 0.03))
            if tt >= dur - 0.5:
                continue
            note = ks_pluck(f, 2.6) * amp * rng.uniform(0.85, 1.0)
            i = int(tt * SR)
            end = min(n, i + len(note))
            out[i:end] += note[: end - i] * 0.8
    return out


def drone(dur: float = 30.0, base: float = 55.0) -> np.ndarray:
    n = int(dur * SR)
    tt = t(dur)
    x = np.zeros(n)
    for det in (-0.6, 0.0, 0.5):
        f = base * (1 + det / 100)
        x += signal.sawtooth(2 * np.pi * f * tt + rng.uniform(0, 6)) / 3
    x += 0.6 * np.sin(2 * np.pi * base / 2 * tt)
    sweep = 110 + 60 * np.sin(2 * np.pi * 0.05 * tt)
    out = np.zeros(n, dtype=np.float32)
    block = int(0.1 * SR)
    for i in range(0, n, block):
        fc = float(sweep[min(i, n - 1)])
        sos = signal.butter(2, fc, "lowpass", fs=SR, output="sos")
        out[i : i + block] = signal.sosfilt(sos, x[i : i + block]).astype(np.float32)
    breath = 0.8 + 0.2 * np.sin(2 * np.pi * 0.09 * tt + 2)
    return (out * breath).astype(np.float32)


def riser(dur: float = 2.2) -> np.ndarray:
    n = int(dur * SR)
    tt = t(dur)
    x = signal.sawtooth(2 * np.pi * 82.41 * tt) + signal.sawtooth(2 * np.pi * 82.9 * tt)
    out = np.zeros(n, dtype=np.float32)
    centers = np.geomspace(180, 2400, n)
    block = int(0.05 * SR)
    for i in range(0, n, block):
        fc = float(centers[min(i, n - 1)])
        sos = signal.butter(2, [fc * 0.6, fc * 1.6], "bandpass", fs=SR, output="sos")
        out[i : i + block] = signal.sosfilt(sos, x[i : i + block]).astype(np.float32)
    e = np.linspace(0, 1, n) ** 1.6
    return (out * e).astype(np.float32)


if __name__ == "__main__":
    write("paper-slam.wav", paper_slam())
    write("whoosh.wav", whoosh())
    write("whoosh-big.wav", whoosh(0.4, 200, 900))
    write("pop.wav", soft_pop(), peak=0.7)
    write("thud.wav", thud())
    write("squeak.wav", marker_squeak(), peak=0.5)
    write("clank.wav", metal_clank(), peak=0.75)
    write("click.wav", camera_click(), peak=0.6)
    write("stamp.wav", stamp())
    write("hooves.wav", hooves(), peak=0.8)
    write("rumble.wav", rumble(), peak=0.85)
    write("fire.wav", fire(), peak=0.85)
    write("projector.wav", projector(), peak=0.5)
    write("boo.wav", crowd_boo(), peak=0.6)
    write("room-tone.wav", room_tone(), peak=0.4)
    write("tense.wav", music_tense(), folder=OUT_MUS, peak=0.8)
    write("drone.wav", drone(), folder=OUT_MUS, peak=0.8)
    write("riser.wav", riser(), folder=OUT_MUS, peak=0.8)
