# MOONREST — Build Plan (live status)

**Now running: THE FINAL RUN** (`docs/FINAL_PASS.md`). Ledger prefix `FIN-`,
judge `docs/build/FINAL_JUDGE.md`. Do not start a stage until the previous
gate passes and is committed. Every stage ends in a state worth showing a
stranger; if a stage breaks, **revert** rather than push forward.

## FINAL RUN — the spine (Part 3)

| Stage | What | Gate | State |
|---|---|---|---|
| 0 | toolkit install + collision/speed/wayfinding | `collisioncheck.mjs` 100%; Park crossing ≤25s | **IN PROGRESS** |
| 1 | lighting + post only (no new assets) | before/after per zone; value-floor + highlight scarcity | **NEXT — blocker mapped, see DECISIONS #9** |
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
- [x] **Collider audit** ✅ empty — 11 scanned, 35 merged batches skipped, self-healing via `autoCoverColliderGaps()`.
- [x] **Camera spherecast** ✅ continuous Rapier sphere-cast r=0.25, hit−0.15, snap-in/ease-out. Old 10-step march replaced.
- [x] **Speeds:** ✅ walk 2.2 / run 5.2 default / sprint 8.0; measured 5.19 m/s median on open ground; accel 0.15s, decel 0.12s, jump apex 1.6m, coyote 6f.
- [x] **World boundary** ✅ four unclimbable slabs replace the coordinate clamp.
- [x] **Ember-visible unkindled lights** ✅ holds ANGULAR size past 26m (constant 11.3px to 80m) + fog-lift opacity; still depth-occluded.
- [x] **Lantern Listen** ✅ L fires a wisp to the nearest unkindled light over 3s, keeper glances after it, zero UI.
- [x] `scripts/collisioncheck.mjs` ✅ **PASS 7/7** — 560 charges at sprint speed, 1560 fuzz steps, 0 penetrations / 0 OOB / 0 sink / 0 camera clips.
- [x] Crossing times ✅ `crossingcheck.mjs` PASS 4/4 — Park 18.55s (budget 25s); all legs logged in PERFORMANCE_AUDIT.md.

### Stage 1 status — NEARLY DONE, 11/13 (see DECISIONS #14–#16)

- [x] `litMaterial()` on three-custom-shader-material, flag-gated (`?lit=0` reverts).
- [x] `MoonRig` — 1 directional (only shadow caster, tracks the visible moon) + 1 hemisphere.
- [x] Post chain — HalfFloat linear → SMAA / N8AO / bloom / vignette → **AgX** → sRGB; `NoToneMapping` on the renderer.
- [x] Night grade LUT (33³, tetrahedral) — contrast restored, palette anchors, black floor.
- [x] Emitters are HDR sources again (bloom threshold does the selecting).
- [x] Zone skies clamped into the DIRECTION Part 7 envelope; Rule 3 preserved.
- [x] `scripts/composecheck.mjs` — the gate, in CIE L*, **deterministic** (see #15).
- [ ] **`lanternpool` 17.4 / `player` 17.3 vs an 18.0 readability line.** Same
      location, same cause: a large uniform ground plane. Lighting levers are
      spent (key/fill is non-monotonic and at its optimum). Fix is ground value
      variation → **Stage 2 asset work.** Do NOT close these by lowering the line.
- [ ] Per-zone LUTs (TOOLKIT asks for them; one global grade ships today).

### Stage 1 — the order it must be done in (DECISIONS #9)

**Do not add lights first — they would be silent no-ops.** `retroMaterial()`
is a raw `ShaderMaterial` without `lights: true`, so three feeds it no light
uniforms. ~99 call sites.

1. Port `retroMaterial` onto `three-custom-shader-material` (TOOLKIT §8 names
   this as the backbone for exactly this job) so the existing look survives
   but materials receive three's lighting/shadows/fog. Write
   `csm_DiffuseColor`, never `csm_FragColor`. Populate `roughnessMap` with a
   1×1 white texture or `csm_Roughness` silently does nothing.
2. Replace the 480×270 nearest RT + quantize post shader with the composer:
   `HalfFloatType`, `NoToneMapping` on the renderer, **AgX** in the chain
   (TOOLKIT §1.3 overrides DIRECTION's ACES), SMAA ULTRA, N8AO half-res with
   `aoTones`, `SelectiveBloomEffect` (threshold 0.6–0.9, never 0), vignette,
   per-zone LUT ≥32³ with `tetrahedralInterpolation`, fine grain.
3. Then the rig: ONE moon directional (only shadow caster, core CSM,
   `PCFShadowMap`, `shadowMap.autoUpdate=false`, `normalBias` 0.02–0.05), one
   hemisphere, single-digit point lights `castShadow=false`, everything else
   emissive. Shade tints blue/violet — never black.
4. Gate: before/after screenshot pair per zone + value-floor (≥55% below
   L*40) and highlight-scarcity (≤8% above L*75) metrics.

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
