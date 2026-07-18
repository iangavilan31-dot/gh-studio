#!/usr/bin/env python3
"""Assemble per-chunk VO WAVs into the final narration track + timing data.

Voice-engine agnostic: works on chunks from vo_local.py (Mimic3 scratch)
or vo_chatterbox.py (final). Chunk boundaries give EXACT timings for every
visual event anchored to a chunk start; word-level times within a chunk are
estimated from phoneme weights (replace with whisper-cpp word stamps via
scripts/whisper-captions.mjs when network allows — event anchors stay put).

Outputs:
  public/audio/vo.wav     - assembled, post-processed narration (-14 LUFS)
  public/timing.json      - beats/chunks/words absolute ms + named events
  public/captions.json    - flat @remotion/captions Caption[] word stream

Usage: python pipeline/assemble.py
"""
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).parent
CHUNKS = HERE / "build" / "chunks"
PUBLIC = HERE.parent / "public"
SR = 24000

try:
    import gruut

    HAVE_GRUUT = True
except ImportError:
    HAVE_GRUUT = False

# ---------------------------------------------------------------- phoneme weights

VOWEL_CHARS = set("aeiouyɑɐɒæəɘɛɜɝɞɪɨʉʊʌʏɔøœɶo̯ ãẽĩõũ")
STOPS = set("pbtdkgʔ")
NASALS = set("mnŋɱɳɲ")


def phone_weight(ph: str) -> float:
    p = ph.replace("ˈ", "").replace("ˌ", "").replace("ː", "")
    if not p:
        return 0.0
    if any(c in VOWEL_CHARS for c in p):
        return 1.25 if len(p) > 1 else 1.0  # diphthong vs monophthong
    if p[0] in STOPS:
        return 0.45
    if p[0] in NASALS:
        return 0.55
    return 0.6  # fricatives, liquids, glides, affricates


_word_phoneme_cache: dict[str, float] = {}


def word_weight(spoken: str) -> float:
    """Estimated relative duration of a (possibly multi-token) spoken word."""
    key = spoken.lower()
    if key in _word_phoneme_cache:
        return _word_phoneme_cache[key]
    clean = re.sub(r"[^\w\s'\-]", "", spoken).strip()
    weight = 0.0
    if HAVE_GRUUT and clean:
        for sentence in gruut.sentences(clean, lang="en_US"):
            for w in sentence:
                if w.phonemes:
                    weight += sum(phone_weight(p) for p in w.phonemes) + 0.15
    if weight <= 0:  # fallback: vowel-group syllable count
        syl = max(1, len(re.findall(r"[aeiouy]+", clean.lower())))
        weight = syl * 1.0 + 0.3
    _word_phoneme_cache[key] = weight
    return weight


PAUSE_WEIGHTS = {",": 0.9, ";": 1.1, ":": 1.1, "—": 1.0, "...": 1.4}


def trailing_pause(display: str) -> float:
    stripped = display.rstrip("”’\"'")
    for mark, w in PAUSE_WEIGHTS.items():
        if stripped.endswith(mark):
            return w
    return 0.0


# ---------------------------------------------------------------- audio helpers


def load_chunk(path: Path) -> np.ndarray:
    audio, sr = sf.read(path, dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != SR:
        audio = signal.resample_poly(audio, SR, sr).astype(np.float32)
    return audio


def trim_silence(audio: np.ndarray, pad_ms: float = 30.0) -> np.ndarray:
    peak = np.abs(audio).max() or 1.0
    above = np.flatnonzero(np.abs(audio) > 0.004 * peak)
    if len(above) == 0:
        return audio
    pad = int(pad_ms / 1000 * SR)
    lo = max(0, above[0] - pad)
    hi = min(len(audio), above[-1] + pad)
    return audio[lo:hi]


def rbj_high_shelf(fc: float, gain_db: float, q: float = 0.7):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    alpha = np.sin(w0) / (2 * q)
    cos = np.cos(w0)
    b0 = A * ((A + 1) + (A - 1) * cos + 2 * np.sqrt(A) * alpha)
    b1 = -2 * A * ((A - 1) + (A + 1) * cos)
    b2 = A * ((A + 1) + (A - 1) * cos - 2 * np.sqrt(A) * alpha)
    a0 = (A + 1) - (A - 1) * cos + 2 * np.sqrt(A) * alpha
    a1 = 2 * ((A - 1) - (A + 1) * cos)
    a2 = (A + 1) - (A - 1) * cos - 2 * np.sqrt(A) * alpha
    return np.array([b0, b1, b2]) / a0, np.array([1.0, a1 / a0, a2 / a0])


def post_chain(audio: np.ndarray) -> np.ndarray:
    # 80 Hz high-pass
    sos = signal.butter(2, 80, "highpass", fs=SR, output="sos")
    audio = signal.sosfilt(sos, audio).astype(np.float32)
    # gentle presence shelf
    b, a = rbj_high_shelf(3000, 2.5)
    audio = signal.lfilter(b, a, audio).astype(np.float32)
    # tiny room: 0.2s synthetic IR, low wet mix
    rng = np.random.default_rng(1932)
    ir_len = int(0.2 * SR)
    ir = rng.standard_normal(ir_len).astype(np.float32)
    ir *= np.exp(-np.linspace(0, 9.0, ir_len)).astype(np.float32)
    sos_hp = signal.butter(2, 300, "highpass", fs=SR, output="sos")
    ir = signal.sosfilt(sos_hp, ir).astype(np.float32)
    ir /= np.abs(ir).sum() or 1.0
    wet = signal.fftconvolve(audio, ir)[: len(audio)].astype(np.float32)
    audio = audio + 0.06 * wet * len(ir) ** 0.5
    # loudness normalize to -14 LUFS
    try:
        import pyloudnorm

        meter = pyloudnorm.Meter(SR)
        loud = meter.integrated_loudness(audio.astype(np.float64))
        audio = audio * (10 ** ((-14.0 - loud) / 20))
    except ImportError:
        rms = np.sqrt(np.mean(audio**2)) or 1.0
        audio = audio * (10 ** (-17.0 / 20) / rms)
    # safety clip guard
    peak = np.abs(audio).max()
    if peak > 0.985:
        audio = audio * (0.985 / peak)
    return audio.astype(np.float32)


# ---------------------------------------------------------------- assembly


def norm_word(s: str) -> str:
    return re.sub(r"[^\w']", "", s).lower()


def main() -> int:
    script = json.loads((HERE / "script.json").read_text())
    lead_in = script.get("leadInMs", 150)
    tail = script.get("tailMs", 900)
    d_chunk_gap = script.get("defaultChunkGapMs", 170)
    d_beat_gap = script.get("defaultBeatGapMs", 360)

    segments: list[np.ndarray] = []
    beats_out = []
    events: dict[str, float] = {}
    captions = []
    cursor = float(lead_in)
    total_samples = int(lead_in / 1000 * SR)
    segments.append(np.zeros(total_samples, dtype=np.float32))

    for bi, beat in enumerate(script["beats"]):
        chunks_out = []
        for ci, chunk in enumerate(beat["chunks"]):
            if ci == 0:
                gap = beat.get("gapBeforeMs", d_beat_gap) if bi > 0 else beat.get(
                    "gapBeforeMs", 0
                )
            else:
                gap = chunk.get("gapBeforeMs", d_chunk_gap)
            path = CHUNKS / f"{beat['id']}-{chunk['id']}.wav"
            audio = trim_silence(load_chunk(path))
            dur_ms = len(audio) / SR * 1000

            gap_samples = int(gap / 1000 * SR)
            segments.append(np.zeros(gap_samples, dtype=np.float32))
            segments.append(audio)
            cursor += gap
            start_ms = cursor
            cursor += dur_ms

            # word timing distribution
            weights = []
            for w in chunk["words"]:
                spoken = w.get("s", w["d"])
                wt = word_weight(spoken)
                weights.append((wt, trailing_pause(w["d"])))
            # last word gets phrase-final lengthening, no trailing pause
            weights[-1] = (weights[-1][0] * 1.25, 0.0)
            total_w = sum(w + p for w, p in weights)
            words_out = []
            t = start_ms
            for w, (wt, pause) in zip(chunk["words"], weights):
                w_dur = dur_ms * wt / total_w
                p_dur = dur_ms * pause / total_w
                words_out.append(
                    {
                        "text": w["d"],
                        "startMs": round(t, 1),
                        "endMs": round(t + w_dur, 1),
                    }
                )
                captions.append(
                    {
                        "text": (w["d"] if not captions else " " + w["d"]),
                        "startMs": round(t, 1),
                        "endMs": round(t + w_dur, 1),
                        "timestampMs": round(t, 1),
                        "confidence": 1.0,
                    }
                )
                t += w_dur + p_dur

            chunk_out = {
                "id": chunk["id"],
                "startMs": round(start_ms, 1),
                "endMs": round(start_ms + dur_ms, 1),
                "words": words_out,
            }
            chunks_out.append(chunk_out)

            # events
            events[f"{beat['id']}.{chunk['id']}"] = round(start_ms, 1)
            for ev in chunk.get("events", []):
                if "word" in ev:
                    target = norm_word(ev["word"])
                    match = next(
                        (
                            w
                            for w in words_out
                            if norm_word(w["text"]) == target
                        ),
                        None,
                    )
                    if match is None:
                        raise SystemExit(
                            f"event {ev['name']}: word '{ev['word']}' not in "
                            f"{beat['id']}-{chunk['id']}"
                        )
                    events[f"{beat['id']}.{ev['name']}"] = match["startMs"]
                else:
                    events[f"{beat['id']}.{ev['name']}"] = round(start_ms, 1)

        beats_out.append(
            {
                "id": beat["id"],
                "startMs": chunks_out[0]["startMs"],
                "endMs": chunks_out[-1]["endMs"],
                "chunks": chunks_out,
            }
        )
        events[f"{beat['id']}.start"] = chunks_out[0]["startMs"]

    # beat endMs = start of next beat (visual beats tile the video)
    for i, b in enumerate(beats_out):
        if i + 1 < len(beats_out):
            b["endMs"] = beats_out[i + 1]["startMs"]
    total_ms = cursor + tail
    beats_out[-1]["endMs"] = round(total_ms, 1)

    vo = np.concatenate(segments)
    vo = np.concatenate([vo, np.zeros(int(tail / 1000 * SR), dtype=np.float32)])
    vo = post_chain(vo)

    (PUBLIC / "audio").mkdir(parents=True, exist_ok=True)
    sf.write(PUBLIC / "audio" / "vo.wav", vo, SR, subtype="PCM_16")

    timing = {
        "totalMs": round(total_ms, 1),
        "beats": beats_out,
        "events": events,
    }
    (PUBLIC / "timing.json").write_text(json.dumps(timing, indent=1))
    (PUBLIC / "captions.json").write_text(json.dumps(captions, indent=1))

    print(f"vo.wav: {len(vo) / SR:.2f}s  ({total_ms / 1000:.2f}s video)")
    for b in beats_out:
        print(
            f"  {b['id']}: {b['startMs'] / 1000:7.2f}s - {b['endMs'] / 1000:7.2f}s"
        )
    print(f"events: {len(events)}, caption words: {len(captions)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
