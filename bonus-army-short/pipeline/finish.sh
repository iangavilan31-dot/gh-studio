#!/usr/bin/env bash
# Finishing pass: one global grade (gentle S-curve, ~2% warm on paper tones,
# blacks lifted to ~4% so nothing is pure black) + a 0.6% zoom-crop to hide any
# drifting-layer edge artifacts, encoded at CRF 16. Then cut the review clips.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=out/bonus-army-short.mp4
OUT=out/bonus-army-short-final.mp4
UPLOAD=out/bonus-army-short-upload.mp4

GRADE="curves=all='0/0.04 0.25/0.23 0.5/0.51 0.75/0.79 1/0.985',eq=gamma_r=1.03:gamma_g=1.0:gamma_b=0.97:saturation=1.02,scale=iw*1.006:ih*1.006,crop=1920:1080"

echo ">>> grade + zoom-crop + CRF 16"
ffmpeg -y -i "$IN" -vf "$GRADE" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 256k "$OUT" 2>&1 | tail -2

echo ">>> upload file (yuv420p, faststart)"
ffmpeg -y -i "$OUT" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k "$UPLOAD" 2>&1 | tail -2

# --- isolated review clips (from the graded master) ---
b1a=0; b1b=$(python3 -c "print(round((__import__('json').load(open('public/timing.json'))['events']['b1.against']+40)/30,2))")
b8a=$(python3 -c "print(round((__import__('json').load(open('public/timing.json'))['events']['b8.sabers']-8)/30,2))")
b8b=$(python3 -c "print(round((__import__('json').load(open('public/timing.json'))['events']['b9.gas']+6)/30,2))")
echo ">>> clip: B1 match cut ($b1a-$b1b s)"
ffmpeg -y -ss $b1a -to $b1b -i "$OUT" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a aac out/clip-b1-matchcut.mp4 2>&1 | tail -1
echo ">>> clip: B8 attack ($b8a-$b8b s)"
ffmpeg -y -ss $b8a -to $b8b -i "$OUT" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a aac out/clip-b8-attack.mp4 2>&1 | tail -1

echo ">>> done"
for f in "$OUT" "$UPLOAD" out/clip-b1-matchcut.mp4 out/clip-b8-attack.mp4; do
  ls -la "$f"
done
