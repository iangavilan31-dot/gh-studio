# MOONREST — Decisions & Workarounds

Ranked by how expensive it would be if wrong (riskiest first). Scan top-down.

## D1 — VIBE_BIBLE.md and docs/research/ are absent; building from MASTER_PROMPT alone
**Risk: MEDIUM.** The spec references `docs/VIBE_BIBLE.md` §1 (judge dimension j compares
screenshots against its scene descriptions) and `docs/research/`. Neither exists in the
repo (checked working tree, origin/main, and all remote branches). Part 0.1 explicitly
covers this: "if absent, this document is self-sufficient." Judge dimension (j) will be
scored against the per-zone reference descriptions embedded in Part 3 (each zone names
its reference video/scene and framing) plus the Part 2.1 palette table. If the human has
a real VIBE_BIBLE, re-judging (j) against it is cheap; zone art itself follows Part 2/3
either way.

## D2 — Replaced the app shell instead of adding a /play route
**Risk: LOW (branch-scoped, reversible).** Part 12.1 M0 allows "(`/play` route or replace
app shell)". The repo is a React portfolio site; keeping React alive alongside the game
costs bundle size (budget: ≤1.2MB gz incl. three.js) and complexity. On this feature
branch `index.html` now boots `src/game/main.js` directly; the portfolio React sources
remain on disk, unbundled and untouched, so main is unaffected until a human merges
deliberately.

## D3 — Master spec persisted from the in-session prompt
**Risk: LOW.** `docs/MASTER_PROMPT.md` did not exist in the repo; the full document was
supplied in-conversation and has been written to disk verbatim (it is the re-orientation
anchor). If the human has a canonical copy that differs, diff against this one.

## D4 — Fonts bundled via @fontsource (permitted dependency reading)
**Risk: LOW.** Part 0.6 limits runtime deps to `three` + `peerjs` + existing, but Part 10
explicitly instructs bundling OFL faces "via `@fontsource`... npm-bundled, never fetched
at runtime". Installed `@fontsource/im-fell-english` (headers) and `@fontsource/alegreya`
(body). These are static font assets, not runtime code; treating Part 10 as the specific
override of Part 0.6's general rule.

## D5 — Timestamps in state files use UTC from the environment clock
**Risk: NEGLIGIBLE.** Session date 2026-07-23; entries stamped from `date -u`.
