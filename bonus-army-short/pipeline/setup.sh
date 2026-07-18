#!/usr/bin/env bash
# One-command environment bootstrap for the VO/audio pipeline.
# Safe to re-run; everything is idempotent. Works in restricted-network
# containers (all hosts below were reachable under the "Trusted" policy).
set -euo pipefail

WORK="${1:-$HOME/.cache/bonus-army-short}"
VENV="$WORK/venv"
VOICES="$WORK/voices"

mkdir -p "$VOICES/hifi-tts_low"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade \
  onnxruntime soundfile scipy numpy gruut gruut-lang-en phonemes2ids pyloudnorm

BASE_RAW="https://raw.githubusercontent.com/MycroftAI/mimic3-voices/master/voices/en_US/hifi-tts_low"
BASE_LFS="https://media.githubusercontent.com/media/MycroftAI/mimic3-voices/master/voices/en_US/hifi-tts_low"
for f in config.json phonemes.txt speaker_map.csv; do
  [ -s "$VOICES/hifi-tts_low/$f" ] || curl -sL -o "$VOICES/hifi-tts_low/$f" "$BASE_RAW/$f"
done
# generator.onnx is Git-LFS: fetch via the media host (raw returns a pointer)
if [ ! -s "$VOICES/hifi-tts_low/generator.onnx" ] || \
   [ "$(stat -c%s "$VOICES/hifi-tts_low/generator.onnx")" -lt 1000000 ]; then
  curl -sL -o "$VOICES/hifi-tts_low/generator.onnx" "$BASE_LFS/generator.onnx"
fi

echo "venv:   $VENV"
echo "voices: $VOICES"
echo
echo "Regenerate everything:"
echo "  $VENV/bin/python pipeline/vo_local.py --voice-dir $VOICES/hifi-tts_low --speaker 1"
echo "  $VENV/bin/python pipeline/assemble.py"
echo "  $VENV/bin/python pipeline/sfx.py"
echo "  $VENV/bin/python pipeline/preview_mix.py"
