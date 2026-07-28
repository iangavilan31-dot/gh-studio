#!/usr/bin/env bash
# MOONREST — baseline check: build + preview + smoke test.
# Every work cycle starts by running this (MASTER_PROMPT 0.8.2).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== npm run build =="
npm run build

echo "== smoke test (preview server + headless load + non-blank canvas + console clean) =="
node scripts/shoot.mjs --smoke

echo "== BASELINE OK =="
