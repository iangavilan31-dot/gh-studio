# MOONREST — VISUAL DIRECTION REWRITE (v2, authoritative)

> **Status:** this document **replaces the visual direction** in
> `MASTER_PROMPT.md`, `PRESTIGE_PASS.md`, and `ASCENSION_PASS.md`. Where any of
> them describes how the game should *look*, this wins. What survives from them:
> the harness (state files, work cycle, evidence gates, do-not-stop rules), the
> gameplay systems, `ASCENSION_PASS.md` **Part 0 blockers** (collision, speed,
> wayfinding — still the top priority), and the Part 3 renderer techniques,
> which this document refines rather than repeals.
>
> **How to run:** paste into a Claude Code session (auto permission mode), or
> say "read docs/DIRECTION.md and execute it." Then:
>
> ```
> /goal ASCENSION Part 0 blockers all pass, every DIR- entry in
> docs/build/features.json passes with evidence, scripts/composecheck.mjs
> passes on every zone shot, docs/build/DIRECTION_JUDGE.md shows two
> consecutive passing reviews with stop-scrolling >= 9.0 and no category
> < 8.5, performance gates pass at High, npm run build exits 0, and
> docs/build/PROGRESS.md ends with "DIRECTION COMPLETE — SHIP" — or stop
> after 500 turns
> ```
>
> Ledger prefix `DIR-`. Judge file `docs/build/DIRECTION_JUDGE.md`.

The current visuals are **placeholders**. They exist only to prove the
mechanics work. You have full permission to redesign every visual system,
asset, shader, material, palette, terrain rule, placement algorithm, camera
behaviour, post effect, and architectural language from scratch. Nothing is
protected except gameplay functionality.

---

# PART 1 — THE STYLE LOCK

**MOONREST is big-form atmospheric dark fantasy.**

Reference tier — study the *principles*, copy nothing: **Shadow of the
Colossus**, **ICO**, **Ashen**, **Little Nightmares**, with the lighting
discipline of **Journey** and **Death's Door**, and the compositional habits of
**Breath of the Wild**'s distant vistas and **Princess Mononoke**'s forests.

What this style actually means, stated as buildable rules:

- **Few, enormous shapes** beat many small ones. A valley with one colossal
  statue, three trees, and fog is stronger than a forest of two hundred trees.
- **Detail lives in silhouette, not in surface.** Materials stay broad and
  quiet; the drama is in outline, scale, and light.
- **Emptiness is content.** Negative space is a designed material. Long
  stretches of nothing are correct when they frame something.
- **The player is small and the world does not care.** Awe first, loneliness
  second, comfort only in scarce warm pools.
- **Haze is the depth engine.** Everything reads as layered planes fading into
  atmosphere, exactly like the reference painting.

**Strategic consequence — this style is CHEAPER than the alternatives.** It
needs fewer unique assets, less texture detail, and less geometric complexity.
Spend the savings on lighting, scale, and composition. If any decision trades
asset count for lighting quality, take the lighting every time.

---

# PART 2 — THE PRIORITY LADDER (settles every argument)

1. Composition
2. Lighting
3. Silhouette
4. Scale
5. Atmosphere
6. Color
7. Materials
8. Geometry detail
9. Micro detail

If an improvement helps something higher and hurts something lower, **do it**.
Log the trade in `DECISIONS.md`. Never invert this ladder.

---

# PART 3 — SCALE LAW

The player is 1.6m. Everything is measured against that.

| Element | Minimum |
|---|---|
| Hero trees | 60–120m trunk height, 8–15m trunk diameter |
| Ruined columns / arches | 20–40m |
| Castle walls | 80m+, tops lost in cloud |
| Doors and gates | 8–15m (never human-scaled) |
| Bridges | span an entire valley, 100m+ |
| Statues | mountain-scale, 60–200m |
| Cliff faces | 40m+ |
| The moon | 8–15° of sky, 35° at the climax |

Rules: every zone contains at least one object over 60m. Every zone has one
"look up" moment and one "look down" moment. Every destination is visible long
before it is reachable. Nothing in the world should read as recently built —
every structure implies centuries of collapse, overgrowth, and forgetting.

---

# PART 4 — TERRAIN LAW

**Flat terrain is forbidden.** Delete every flat plane in the build.

Every zone must contain rolling hills, cliffs, at least one ravine, a plateau
or overlook, switchback paths, natural elevation change of 25m+, and at least
one hidden pocket (cave, hollow, ledge) not visible from the main road.

Implementation: sculpted heightfields (multi-octave noise **shaped by authored
splines and masks**, never raw noise), slope-based triplanar auto-texturing,
terrain LOD, collision from the same heightfield. The path is *cut into* the
land with raised banks that frame the view down it — the road is a canyon at
knee height, not a stripe painted on a field.

The world edge is never visible: terminate every sightline in ridgeline,
cloud, water, or fog.

---

# PART 5 — COMPOSITION LAW (the part that makes it look like concept art)

Every frame must contain four readable bands: **foreground → midground →
background → sky.** Every zone has **exactly one dominant focal point**
(a cathedral, a world tree, a shattered shrine, a colossal statue, a fortress,
a bridge). Nothing competes with it.

Required per frame:
- A **dark foreground framing mass** touching at least one frame edge — a
  trunk, a rock, a broken arch, a bank of earth. This is what the reference
  painting does with its two trees and it is the single highest-leverage
  compositional move in the game.
- The **path as leading line**, entering low and pointing at the focal point.
- **Scattered pinprick warm lights** in the midground — tiny, distant, warm.
  Cheap to render, enormous atmospheric payoff.
- **4+ distinguishable depth planes** separated by haze.
- Controlled negative space; no tangent collisions; no evenly spaced anything.

## 5.1 Procedural placement as landscape architecture

Procedural must never read as random. Implement placement as an **optimizer,
not a scatterer**:

1. Author a **golden path** spline per zone and sample camera poses along it
   every 8m at player eye height, looking down-path.
2. For each sampled pose, run a **view analysis**: where is the focal point,
   what occupies the frame edges, what is the depth distribution.
3. Place assets to *satisfy the frame*, not to fill the ground:
   - frame-edge occluders placed 2–8m from camera at the outer thirds;
   - mid-ground silhouettes at 30–80m that never occlude the focal point
     (raycast-verified);
   - clusters via Poisson-disc with enforced **empty corridors** — every zone
     keeps 40%+ of its ground area deliberately bare;
   - density falls off sharply away from the path (nobody sees it, don't pay
     for it).
4. **Score, adjust, repeat** using the metrics in Part 11.2. This is the
   automated art director: render → measure → move → re-render until the shot
   passes. This loop is the core technical idea of this document.

---

# PART 6 — LIGHTING LAW

Lighting is the primary artistic tool. The world exists mostly in darkness, and
**darkness is allowed to stay dark** — no lifting shadows to "show the work."

- **Maximum three major light sources per scene.** One moon (directional, with
  cascaded shadows), one or two warm anchors (a lantern, a doorway, a fire).
  Everything else is emissive detail below the threshold of "a light."
- Warm light appears **only** where civilization, memory, or magic survives.
  Warm light is the game's scarcest and most meaningful resource.
- Required atmospherics: volumetric fog with moon-direction inscattering,
  distance haze, soft bloom on emissives only, subtle god rays, wet ground
  reflections, drifting embers, fireflies, mist sheets.
- **Image-based lighting:** load a free Poly Haven night HDRI as the
  environment map. This alone lifts every material's believability.
- **Baked lighting (see Part 10.3)** carries the heavy lifting so the runtime
  stays cheap.

---

# PART 7 — PALETTE LOCK

Aggressively limited. Every screenshot must be recognizable as this game.

**Dominants:** deep navy `#0B1220` · cold blue `#16243A` · charcoal `#14161B` ·
desaturated green `#2A3A32` · stone gray `#3B4048` · haze blue `#4A5D78`

**Accents (scarce, ≤8% of any frame):** warm amber `#E8A13C` · gold `#F0C25A` ·
soft white `#E8E4FF` · rare crimson `#7E1F2B` (used at most once per zone)

Per-zone identity comes from *which dominant leads* and *which accent appears*,
not from new hues. Reconcile the measured reference-footage palettes
(MASTER 2.1) into this by keeping their hue relationships and pulling
saturation down 30–40% and value down 20%.

**Saturation is capped.** No fully saturated color anywhere except a kindled
flame core. Enforced by the automated check in Part 11.2.

---

# PART 8 — ARCHITECTURE, TREES, WATER

**Architecture** grows out of terrain — built into cliffs, straddling ravines,
half-swallowed by hillsides. Never a building sitting on flat ground. Every
structure is partially collapsed, weathered, moss-grown, uneven, and clearly
centuries dead. Modular kit approach: a small set of pieces (wall, arch,
column, stair, buttress, roof) combined with variation, damage masks, and
rotation — not hundreds of unique models.

**Trees:** two species maximum per zone, made iconic instead of varied.
Twisted trunks, massive exposed roots, wide asymmetric silhouettes, strong
negative space between branches. **Never a uniform forest.** Every single tree
must earn its place by improving a specific frame.

**Water:** flat, dark, mirror-still in the distance; planar reflection of the
moon and any warm light; foam only where it meets stone. Still water doubles
your composition for free.

---

# PART 9 — MATERIALS & RENDERER

Target: **stylized physically based rendering.**

- Low-to-medium poly meshes with **beveled edges** (bevels catch moonlight and
  are what separate "cheap" from "crafted" at this poly count).
- Hand-painted-style albedo at **512–1024px**, minimal surface noise, broad
  shapes, large gradients, clear forms. Materials reinforce lighting; they
  never compete with it. No photogrammetry, no busy detail, no tiling noise.
- `MeshStandardMaterial`-family PBR: real roughness/metalness so wet stone,
  old bronze, and cloth read differently under the same moon.
- Rim lighting keyed to the moon on every character and creature.
- Post stack, in order: ACES tone mapping → selective bloom (emissive layer,
  half-res) → god rays (quarter-res) → SSAO (half-res) → subtle DOF → per-zone
  LUT grade → vignette + fine grain → SMAA. Use the pmndrs `postprocessing`
  library rather than hand-rolling the composer.

---

# PART 10 — THE ASSET PIPELINE (new — this is what unblocks quality)

The all-procedural rule is **repealed**. Assets now come from four sources,
used deliberately.

## 10.1 What stays procedural (it's genuinely better)

Terrain heightfields, rock and cliff forms, foliage scattering, grass, fog
cards, particles, water, sky gradients, and all placement logic.

## 10.2 What comes from packs (the owner purchases; agent integrates)

Purchased/free assets live in `public/assets/models/<pack>/` as **glTF/GLB**,
Draco-compressed, with a `LICENSES.md` recording each pack's license. Total
model budget ≤ 40MB; texture budget ≤ 256MB.

**The shopping list, ~$100 total** (owner buys; agent must not attempt to
purchase or scrape anything):

| Priority | Item | Cost | Why |
|---|---|---|---|
| 1 | **Blockade Labs Skybox AI**, 1 month | ~$15–20 | Generate 8 custom 360° night skies, one per zone, matched to Part 7. In this style the sky is half of every frame. Highest impact per dollar. |
| 2 | **One modular ruins/architecture pack** — Synty *POLYGON Dungeon Realms* or *Fantasy Kingdom*, or KayKit Medieval/Dungeon bundles | ~$30–70 | Professionally modeled arches, columns, walls, stairs. This is what stops it looking amateur. |
| 3 | **Meshy or Tripo3D**, 1 month | ~$20 | 6–10 hero props no pack has: the gnarled hero tree, the colossal statue, the moon shrine, the fallen god's hand. |
| 4 | **Poly Haven HDRIs + Quaternius/Kenney CC0 packs** | free | Environment lighting and filler props. Take these regardless. |

Integration rules: strip pack materials and **re-author them into the Part 7
palette** (Synty ships bright and cheerful — regrade hard or it will fight the
mood). Re-scale everything to Part 3's scale law. Bevel and simplify where
needed. Never ship a pack asset at its default color or default size.

## 10.3 Baked lighting via headless Blender (free, and the biggest win here)

Blender is fully scriptable from Python with no GUI. Build
`tools/bake.py` + `npm run bake` that: imports the zone's static geometry, sets
up the moon and warm anchors, **bakes lightmaps and ambient occlusion** into a
second UV channel, and exports GLB. The runtime then samples baked light for
all static geometry and spends its real-time budget only on the player,
creatures, and kindled lights.

This gives near-offline-render lighting quality at nearly zero frame cost, and
it is the single technique most responsible for "how is this running in a
browser." Treat it as mandatory infrastructure, not an optimization.

## 10.4 Licensing discipline

Every third-party asset is recorded in `public/assets/LICENSES.md` with source,
license, and date. Nothing is used whose license forbids game use. No scraping,
no ripping from other games, ever.

---

# PART 11 — THE AUTOMATED ART DIRECTOR

## 11.1 Camera

The camera exists to compose shots, not merely to follow. Landmarks stay in
frame; sky occupies meaningful space; foreground elements naturally frame the
player; authored reveal volumes at zone entrances bias yaw/pitch/FOV for 1–3
seconds without ever removing control. The camera should constantly produce
frames worth saving.

## 11.2 `scripts/composecheck.mjs` — composition as a test suite

For every zone shot and every postcard pose, measure and gate:

| Metric | Requirement |
|---|---|
| value floor | ≥ 55% of pixels below L\*40 — darkness stays dark |
| highlight scarcity | ≤ 8% of pixels above L\*75 — warmth stays rare |
| edge mass | outer 15% border ≥ 25% darker than the centre third |
| foreground framing | ≥ 1 contiguous near-black mass ≥ 8% of frame touching an edge |
| focal point | brightest cluster centroid in the centre third, local contrast ≥ 2.5× |
| depth planes | ≥ 4 distinct bands in the depth histogram |
| sky fraction | 15–40% of frame |
| saturation cap | mean chroma below threshold; no saturated region outside accents |
| horizon | no straight world-edge line detectable |
| emptiness | ≥ 40% of zone ground area with no placed props |

A shot that fails any metric is **not done**. The placement optimizer (Part
5.1) uses these as its fitness function: render, score, move assets, re-render.

## 11.3 The self-critique gate

Before any zone is marked complete, answer in `DIRECTION_JUDGE.md`, with the
screenshot attached:

- Would someone stop scrolling because of this?
- Is there a single obvious focal point?
- Does the player feel small?
- Could this screenshot belong to any other game?
- Is the composition memorable?
- Can geometry be simplified while improving lighting?
- Can lighting improve while reducing asset count?

Every answer must be yes (and "could this be another game" must be no) before
the zone passes. Remove visual noise, increase atmosphere, increase mystery,
iterate.

---

# PART 12 — WEATHER & ENVIRONMENTAL STORYTELLING

Weather is a mood instrument, never decoration: rain, fog banks, ash, snow,
wind gusts, drifting leaves, dust. Each zone gets one signature weather state
tied to its emotional register, plus one rare variant per night seed.

Every area implies history with zero dialogue: broken statues, collapsed
bridges, abandoned camps, ruined shrines, old battlefields, forgotten roads,
lamp bases with worn instructions still carved into them. The player should
constantly wonder *what happened here* — and the answer, revealed only through
objects, remains the Lamplighter thesis: the world stopped needing them, and
they simply stopped coming.

---

# PART 13 — TONE: SERIOUS WORLD, GEEKED SECRETS

The **world** is solemn, ancient, lonely, and awe-inspiring at all times. Its
default register carries no jokes. Nothing in the environment winks.

The **secrets** keep the humor and the geeked layer, and they land harder for
the contrast:
- The Wooze/Unseen system (FUN_PASS Part 2) survives fully — drinking still
  opens the hidden layer, tree faces still appear, the moon still watches. In a
  world this severe, discovering that the trees have been smiling all along is
  a genuine emotional event.
- Beldam stays a drunk wizard asleep on a bench, but he now sleeps beneath a
  200m colossus, and that's the joke: nobody told him it was there.
- The chickens survive, in one zone only, as the single warmest thing in the
  game.
- Co-op toys survive but are discovered, never advertised.

Rule: the world is never funny. The things you *find* in it sometimes are.
Comedy is always a reward for curiosity, never the baseline texture.

---

# PART 14 — BUILD ORDER

0. **ASCENSION Part 0 blockers first** — collision, speed, wayfinding. A
   gorgeous world you fall through is worth nothing.
1. Lighting rig: moon + cascaded shadows + HDRI environment + ≤3 light rule.
2. Post stack: ACES, selective bloom, height fog with inscattering, LUT grade.
3. **Palette lock** (Part 7) applied globally — instant identity, near-zero cost.
4. Terrain rewrite: sculpted heightfields, path cut into land, world edge hidden.
5. `composecheck.mjs` + the placement optimizer — build the art director before
   building the art.
6. Scale pass: one 60m+ element per zone, then the full Part 3 table.
7. Asset integration: skyboxes → architecture pack → hero props (as the owner
   supplies them; keep procedural stand-ins until they arrive so work never
   blocks on purchases).
8. Blender bake pipeline (Part 10.3).
9. Trees and water; then weather; then environmental storytelling props.
10. Judge loop until every gate and every self-critique answer passes twice.

Morning report per PRESTIGE Part N, plus before/after pairs per zone and the
honest answer to "would someone stop scrolling." Final line, only when
everything passes: `DIRECTION COMPLETE — SHIP`

---

*Few shapes. Enormous. Mostly dark. One warm light, far away, that somebody
left burning.*
