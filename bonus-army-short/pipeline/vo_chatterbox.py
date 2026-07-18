#!/usr/bin/env python3
"""Final VO synthesis via Chatterbox (Resemble AI, MIT).

Requires open network to huggingface.co (weights download on first run):
    pip install chatterbox-tts torch --index-url https://pypi.org/simple
    python pipeline/vo_chatterbox.py [--ref path/to/reference-voice.wav]

Reads pipeline/script.json (chunk structure), synthesizes each chunk,
writes per-chunk WAVs to pipeline/build/chunks/ for assembly by
pipeline/assemble.py. If --ref is given, zero-shot clones that voice
(~10s of clean, deep, measured documentary read is ideal).

Falls back with a clear error if weights can't be fetched — use
pipeline/vo_local.py (Mimic3 VITS, fully offline) for scratch tracks.
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
BUILD = HERE / "build" / "chunks"


def spoken_text(chunk: dict) -> str:
    return " ".join(w.get("s", w["d"]) for w in chunk["words"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", help="Reference WAV for zero-shot voice cloning")
    ap.add_argument(
        "--exaggeration", type=float, default=0.3,
        help="Chatterbox emotion exaggeration (low = measured documentary)",
    )
    ap.add_argument(
        "--cfg-weight", type=float, default=0.5,
        help="Chatterbox CFG weight (lower = slower, more deliberate pacing)",
    )
    args = ap.parse_args()

    try:
        import torchaudio
        from chatterbox.tts import ChatterboxTTS
    except ImportError:
        print(
            "chatterbox-tts not installed. Run:\n"
            "  pip install chatterbox-tts\n"
            "(needs network access to huggingface.co for weights)",
            file=sys.stderr,
        )
        return 1

    script = json.loads((HERE / "script.json").read_text())
    model = ChatterboxTTS.from_pretrained(device="cpu")
    BUILD.mkdir(parents=True, exist_ok=True)

    for beat in script["beats"]:
        for chunk in beat["chunks"]:
            text = spoken_text(chunk)
            kwargs = {
                "exaggeration": args.exaggeration,
                "cfg_weight": args.cfg_weight,
            }
            if args.ref:
                kwargs["audio_prompt_path"] = args.ref
            wav = model.generate(text, **kwargs)
            out = BUILD / f"{beat['id']}-{chunk['id']}.wav"
            torchaudio.save(str(out), wav, model.sr)
            print(f"{out.name}: {wav.shape[-1] / model.sr:.2f}s  «{text}»")

    print("\nDone. Now run: python pipeline/assemble.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
