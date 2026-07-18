#!/usr/bin/env python3
"""Scratch/timing VO via Mimic3 VITS onnx — fully offline once the voice
files are present. Quality is draft-grade; final VO should come from
pipeline/vo_chatterbox.py (see README).

Voice files (generator.onnx, config.json, phonemes.txt) are expected in
VOICE_DIR. They come from MycroftAI/mimic3-voices (CC BY-SA / Apache per
voice; apope_low is Alan Pope's CC BY-SA voice, fine for drafts, check
before shipping publicly).

Usage:
    python pipeline/vo_local.py [--voice-dir DIR] [--speaker N] [--audition]
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import onnxruntime

try:
    import gruut
except ImportError:
    print("pip install gruut gruut-lang-en", file=sys.stderr)
    raise

from phonemes2ids import phonemes2ids

HERE = Path(__file__).parent
BUILD = HERE / "build" / "chunks"
DEFAULT_VOICE_DIR = Path(
    "/tmp/claude-0/-home-user-gh-studio/597c26c7-8edb-514f-a6c6-f0acf3706927"
    "/scratchpad/voices/apope_low"
)


def load_voice(voice_dir: Path):
    config = json.loads((voice_dir / "config.json").read_text())
    phoneme_to_id = {}
    for line in (voice_dir / "phonemes.txt").read_text().splitlines():
        if not line.strip():
            continue
        idx, _, phoneme = line.partition(" ")
        # A phoneme can be a literal space; preserve it.
        phoneme_to_id[phoneme if phoneme else " "] = int(idx)
    sess = onnxruntime.InferenceSession(
        str(voice_dir / "generator.onnx"),
        providers=["CPUExecutionProvider"],
    )
    return config, phoneme_to_id, sess


def text_to_ids(text: str, config: dict, phoneme_to_id: dict):
    """Replicates mimic3 GruutVoice.text_to_phonemes + phonemes_to_ids."""
    lang = config.get("text_language") or "en_US"
    word_phonemes = []
    for sentence in gruut.sentences(text, lang=lang):
        word_phonemes.extend(w.phonemes for w in sentence if w.phonemes)
    p = config["phonemes"]
    return phonemes2ids(
        word_phonemes=word_phonemes,
        phoneme_to_id=phoneme_to_id,
        pad=p["pad"],
        bos=p["bos"],
        eos=p["eos"],
        auto_bos_eos=p["auto_bos_eos"],
        blank=p["blank"],
        blank_word=p["blank_word"],
        blank_between=p["blank_between"],
        blank_at_start=p["blank_at_start"],
        blank_at_end=p["blank_at_end"],
        simple_punctuation=p["simple_punctuation"],
        punctuation_map=p["punctuation_map"],
        separate=p["separate"],
        separate_graphemes=p["separate_graphemes"],
        separate_tones=p["separate_tones"],
        tone_before=p["tone_before"],
        phoneme_map=p["phoneme_map"],
        fail_on_missing=False,
    )


def synthesize(
    sess, config: dict, ids, length_scale: float, speaker: int | None
) -> np.ndarray:
    inputs = {
        "input": np.expand_dims(np.array(ids, dtype=np.int64), 0),
        "input_lengths": np.array([len(ids)], dtype=np.int64),
        "scales": np.array(
            [
                config["inference"].get("noise_scale", 0.667),
                length_scale,
                config["inference"].get("noise_w", 0.8),
            ],
            dtype=np.float32,
        ),
    }
    if config["model"].get("n_speakers", 1) > 1:
        inputs["sid"] = np.array([speaker or 0], dtype=np.int64)
    audio = sess.run(None, inputs)[0].squeeze()
    return audio.astype(np.float32)


def spoken_text(chunk: dict) -> str:
    return " ".join(w.get("s", w["d"]) for w in chunk["words"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice-dir", type=Path, default=DEFAULT_VOICE_DIR)
    ap.add_argument("--speaker", type=int, default=None)
    ap.add_argument(
        "--audition",
        action="store_true",
        help="Synthesize one test line only, report duration + median f0",
    )
    args = ap.parse_args()

    import soundfile as sf

    onnxruntime.set_seed(1932)
    config, phoneme_to_id, sess = load_voice(args.voice_dir)
    sr = config["audio"]["sample_rate"]
    script = json.loads((HERE / "script.json").read_text())
    default_ls = script.get("defaultLengthScale", 1.1)

    if args.audition:
        line = (
            "In nineteen thirty-two, America's three most famous generals "
            "fought their first battle together."
        )
        ids = text_to_ids(line, config, phoneme_to_id)
        audio = synthesize(sess, config, ids, default_ls, args.speaker)
        out = BUILD.parent / f"audition-{args.voice_dir.name}-{args.speaker}.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out, audio, sr)
        # crude median f0 via autocorrelation on voiced 30ms frames
        f0s = []
        w = int(0.03 * sr)
        for i in range(0, len(audio) - w, w // 2):
            fr = audio[i : i + w]
            if np.sqrt(np.mean(fr**2)) < 0.02:
                continue
            fr = fr - fr.mean()
            ac = np.correlate(fr, fr, "full")[w - 1 :]
            lo, hi = int(sr / 260), int(sr / 60)  # 60..260 Hz
            if hi >= len(ac):
                continue
            lag = lo + int(np.argmax(ac[lo:hi]))
            if ac[lag] > 0.3 * ac[0]:
                f0s.append(sr / lag)
        print(
            f"{out.name}: {len(audio) / sr:.2f}s  "
            f"median f0 ≈ {np.median(f0s):.0f} Hz over {len(f0s)} frames"
        )
        return 0

    BUILD.mkdir(parents=True, exist_ok=True)
    for beat in script["beats"]:
        beat_ls = beat.get("lengthScale", default_ls)
        for chunk in beat["chunks"]:
            ls = chunk.get("lengthScale", beat_ls)
            text = spoken_text(chunk)
            ids = text_to_ids(text, config, phoneme_to_id)
            audio = synthesize(sess, config, ids, ls, args.speaker)
            out = BUILD / f"{beat['id']}-{chunk['id']}.wav"
            sf.write(out, audio, sr)
            print(f"{out.name}: {len(audio) / sr:.2f}s  «{text}»")

    print("\nDone. Now run: python pipeline/assemble.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
