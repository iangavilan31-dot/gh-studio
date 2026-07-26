# MOONREST — THE FINAL RUN (branch claude/moonrest-autonomous-build-015qyb)

Mission: build MOONREST — three beautiful zones, zero words — per
`docs/FINAL_PASS.md`. **Read that file completely before writing any code.**

## Document authority (in order)
1. `docs/TOOLKIT.md` — **wins on every technical/library detail** (verified
   against three.js source + npm, baseline three r185).
2. `docs/FINAL_PASS.md` — wins over every other doc; the build spine.
3. `docs/DIRECTION.md` — the art law. `docs/ASSETS.md` — the Blender pipeline.
4. `docs/MASTER_PROMPT.md` Part 0 — harness (state files, work cycle, evidence).
5. `docs/ASCENSION_PASS.md` Part 0 — collision/speed/wayfinding blockers.

Ledger prefix `FIN-`. Judge file `docs/build/FINAL_JUDGE.md`.

## ⚠️ THIS RUN REVERSES THE OLD TECH CONSTRAINTS
The previous CLAUDE.md said "three + peerjs only · all assets procedural · no
realtime lights · 480×270". **That is dead.** DREAMSCRAP/PRESTIGE shipped; this
run is a different game target. Now:
- Full stack per TOOLKIT §0 (rapier, three-mesh-bvh, postprocessing, n8ao,
  CSM shaders, lil-gui, simplex-noise, glsl plugin, gltf-transform).
- Real lighting: moon directional + CSM shadows, hemisphere, HDRI env, pooled
  point lights, AgX tone mapping in the effect chain, selective bloom, LUT.
- Blender-generated GLB assets committed under `public/assets/`.
- Pin `three@0.185.1` exactly (postprocessing peer caps `<0.186.0`).

## Non-negotiables
- **Zero words in the shipped game** (FINAL_PASS Part 4). Permitted text total:
  numbers in settings, the title, ≤8 lines of credits.
- **Three zones only:** Gloaming Park, Emberwick Village, Moonlit Isle.
- Every Part 3 stage ends in a state worth showing a stranger. Commit only
  states that run and pass their gate; if a stage breaks, **revert** rather than
  push forward on a broken world.
- Never stop early for context/budget. Never ask questions — decide, log in
  `DECISIONS.md`, continue. Never mark done without looking at the evidence.
- Never use lygia (Prosperity license). `infinite-world` is **study-only** —
  reimplement, never copy. Respect every TOOLKIT §9 license flag.
- Hard visual problems: TOOLKIT/FINAL_PASS Part 9 three-attempt loop, three
  *different* techniques, judged by a fresh-context agent that built none.
  Escalate hard subtasks to stronger-model subagents.

## The spine (exact order — do not start a stage until the previous gate passes)
- **Stage 0** toolkit install + swept collision, run speed 5.2 m/s, wayfinding.
  Gate: `collisioncheck.mjs` 100%; Park crossing ≤25s.
- **Stage 1** lighting + post only, no new assets. Largest visual jump.
- **Stage 2** the Blender factory (`tools/`, `npm run assets`, `npm run bake`).
- **Stage 3** the Park, finished (Antlered Sleeper, hero trees, rain, Beldam).
- **Stage 4** the first ten minutes — **the fallback deliverable.**
- Stage 5 Village · Stage 6 Isle + Night's End · Stage 7 judge ×2 · Stage 8 ship.

## Verification
- `npm run build` — must exit 0 at every commit.
- `node scripts/collisioncheck.mjs` / `composecheck.mjs` — stage gates.
- Screenshots: **read the PNGs yourself** before claiming anything passes.

## State files (single source of truth — keep current)
`docs/build/PLAN.md` · `PROGRESS.md` · `DECISIONS.md` · `FINAL_JUDGE.md` ·
`features.json` (prefix `FIN-`) · `TEN_MINUTES.md`

# Compact instructions
When compacting, preserve: the mission (MOONREST final run per
`docs/FINAL_PASS.md`), the document-authority order above, the current stage,
and this instruction — **re-read `docs/FINAL_PASS.md`, `docs/TOOLKIT.md` §0,
`docs/build/PLAN.md` and the tail of `docs/build/PROGRESS.md` before doing
anything else.** Do not revert to the old three+peerjs/procedural constraints.
