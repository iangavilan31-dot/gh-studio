# MOONREST — Build Plan (live status)

**Now running: THE FINAL RUN** (`docs/FINAL_PASS.md`). Ledger prefix `FIN-`,
judge `docs/build/FINAL_JUDGE.md`. Do not start a stage until the previous
gate passes and is committed. Every stage ends in a state worth showing a
stranger; if a stage breaks, **revert** rather than push forward.

## FINAL RUN — the spine (Part 3)

| Stage | What | Gate | State |
|---|---|---|---|
| 0 | toolkit install + collision/speed/wayfinding | `collisioncheck.mjs` 100%; Park crossing ≤25s | **IN PROGRESS** |
| 1 | lighting + post only (no new assets) | before/after per zone; value-floor + highlight scarcity | todo |
| 2 | the Blender factory (`tools/`) | Park bakes; hero tree beats procedural (Part 9 judged) | todo |
| 3 | the Park, finished | every Park pose passes `composecheck.mjs` | todo |
| 4 | the first ten minutes — **fallback deliverable** | `TEN_MINUTES.md`, no dead stretch >12s | todo |
| 5 | Emberwick Village | composecheck; inhabited with nobody awake | todo |
| 6 | Moonlit Isle + Night's End | composecheck; the ending lands | todo |
| 7 | judge ×2 consecutive | Part 10 thresholds | todo |
| 8 | ship | morning report ends `FINAL — SHIP` | todo |

### Stage 0 checklist (ASCENSION Part 0 blockers)

- [x] TOOLKIT §0 stack installed in order; `three` pinned 0.185.1; build green.
- [x] CLAUDE.md rewritten as the compaction hook; DECISIONS #1–#3 logged.
- [x] **Swept collision.** ✅ live: 150 props + heightfield + boundary; 40m single-step charge at a 0.2m wall stops dead.
- [ ] **Collider audit** — log every reachable mesh >1m without a collider;
      the list must be empty.
- [ ] **Camera spherecast** (§2.2): three-mesh-bvh `acceleratedRaycast` +
      `firstHitOnly`; sphere-cast r=0.25 head→desired, place at
      `hit.distance − 0.15`; **snap in immediately, ease out 5–10 u/s**; near
      plane ≤0.1. ⚠️ renames: `MeshBVHHelper`→`BVHHelper`,
      `maxLeafSize`→`targetLeafSize`.
- [x] **Speeds:** ✅ walk 2.2 / run 5.2 default / sprint 8.0; measured 5.19 m/s median on open ground; accel 0.15s, decel 0.12s, jump apex 1.6m, coyote 6f.
- [x] **World boundary** ✅ four unclimbable slabs replace the coordinate clamp.
- [ ] **Ember-visible unkindled lights** — faint pulsing ember readable at 80m,
      occluded by geometry, never lost to fog. Biggest wayfinding win.
- [ ] **Lantern Listen** — hold L/LB: lantern lifts, chimes, one wisp streaks
      toward the nearest unkindled light, fades in 3s. No UI.
- [ ] `scripts/collisioncheck.mjs` — bot charges every wall/cliff/prop/door
      frame/world edge in every zone from 8 angles at max speed + 5-min random
      fuzz per zone. Zero penetrations, zero OOB, zero obstructed camera rays.
- [ ] Park crossing time measured; all zone crossings logged in
      `PERFORMANCE_AUDIT.md`.

### Notes that will bite later (from TOOLKIT)
- Effect order §3: SMAA → SSAO → DoF → CA → Bloom → GodRays → Vignette →
  **ToneMapping → LUT** → Noise. Composer **HalfFloatType**; `NoToneMapping`
  on the renderer (double tone mapping is the classic bug);
  `material.dithering = true` on every large gradient. Use **AgX**, not ACES.
- Night bloom: default `luminanceThreshold: 1.0` means nothing blooms. Make
  emitters genuinely HDR (`emissiveIntensity` 2–10), threshold 0.6–0.9, never
  0. `SelectiveBloomEffect` + `Selection` for lanterns/runes/eyes only.
- Shadows: **one** directional (the moon) via core CSM, `PCFShadowMap`
  (`PCFSoftShadowMap` deprecated at r186), `shadowMap.autoUpdate = false` with
  manual `needsUpdate`, `shadow.normalBias` 0.02–0.05.
- Never bake darkness into albedo; shade tints blue/violet, never black.
- Zero words (Part 4). Three zones only; archived zones stay behind a flag.

---

## Previous run — MOONREST base game (M0–M10, shipped)

- [x] M0 Pipeline proof · M1 The Lamplighter · M2 Kindling + audio core
- [x] M3 World blockout · M4 Art pass I · M5 Art pass II
- [x] M6 Systems complete · M7 Co-op · M8 Shell & polish
- [x] M9 Judge loops · M10 Ship
- [x] **DREAMSCRAP** (dream-world platform fighter) — shipped at judge 9.00 ×2

## Re-planning notes

- FINAL RUN supersedes the old tech constraints (see DECISIONS #1). The
  480×270 / procedural-only / no-lights law is dead for this target.
