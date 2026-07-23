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

## D6 — Draw calls exceed budget at blockout (163 worst view; budget ≤120)
**Risk: MEDIUM (perf gate is a hard gate at M6/M9).** The whole 400×400m world sits
inside the camera far plane, so every zone renders every frame (fog hides it visually
only). Plan: per-zone group visibility by distance (zones >~100m hidden) + per-zone
static geometry merging (Part 7.2 requires ≤6 draw calls/zone by material) during
M4/M5 art passes; re-measure at the M6 perf gate. Not fixed at M3 because blockout
acceptance doesn't gate on draw calls and merging placeholder geometry twice is waste.

## D7 — Rooftops as elevated heightfield strip, not per-roof colliders
**Risk: LOW-MEDIUM.** Walkable roofs are a contiguous heightAt() strip (plus ladder
ramp exempted from slope-slide); stepping between houses walks on air a little. At
N64 fidelity with fog this reads fine and it keeps player physics one code path. If
the M9 judges flag it, add per-gap fall-through then.

## D8 — "Four causeway lantern pairs" read as 4 lantern objectives (2 visual pairs)
**Risk: LOW.** Gloomspire spec says four causeway lantern pairs + gatehouse brazier
among 5 cold lights; 8 individual objectives would make the zone 9. Read the intent
as 5 objectives (4 causeway lanterns arranged as 2 flanking pairs + brazier), keeping
the world total at the spec's 37.
