#!/usr/bin/env bash
# MOONREST waking gate suite — STRICTLY SEQUENTIAL (DECISIONS #1: parallel
# vite previews poison each other's timings). Reconstructed in-repo after
# the session scratchpad was reclaimed. Build first, then every rig.
set -o pipefail
cd "$(dirname "$0")/.."
FAIL=0
run() {
  echo "== $1 =="
  if ! bash -c "$2" 2>&1 | tail -2; then FAIL=$((FAIL+1)); echo "^^ GATE FAILED: $1"; fi
}
run "build+smoke"      "bash scripts/init.sh"
run "hue"              "node scripts/huecheck.mjs"
run "feel"             "node scripts/feelcheck.mjs"
run "kindle"           "node scripts/kindlecheck.mjs"
run "moments"          "node scripts/momentscheck.mjs"
run "shell"            "node scripts/shellcheck.mjs"
run "coop"             "node scripts/coopcheck.mjs"
run "perf"             "node scripts/perfgate.mjs"
run "traverse"         "node scripts/traversecheck.mjs"
run "quarter"          "node scripts/quartercheck.mjs"
run "firstperson"      "node scripts/fpcheck.mjs"
echo "GATES DONE, failures: $FAIL"
exit $FAIL
