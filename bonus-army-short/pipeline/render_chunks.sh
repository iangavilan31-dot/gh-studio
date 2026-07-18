#!/usr/bin/env bash
# Render the composition in frame chunks (each small enough that the font load
# clears well within the delayRender timeout), then concat losslessly. Works
# around a full-length render stalling the font delayRender at init.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/node22/bin:$PATH"
export NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
OUT=out/chunks
mkdir -p "$OUT"
: > "$OUT/list.txt"

CHUNKS=("0-350" "351-700" "701-1050" "1051-1400" "1401-1715")
i=0
for range in "${CHUNKS[@]}"; do
  f="$OUT/chunk_$i.mp4"
  echo ">>> chunk $i frames $range"
  npx remotion render BonusArmyShort "$f" --frames="$range" \
    --concurrency=1 --timeout=120000 --log=error
  echo "file '$(basename "$f")'" >> "$OUT/list.txt"
  i=$((i+1))
done

echo ">>> concatenating $i chunks"
ffmpeg -y -f concat -safe 0 -i "$OUT/list.txt" -c copy out/bonus-army-short.mp4
echo ">>> done: out/bonus-army-short.mp4"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 out/bonus-army-short.mp4
