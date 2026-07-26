# MOONREST — THE FINAL RUN

> This is the last full build pass. Everything the project has learned is
> compressed into it. Read this document completely before writing any code.
>
> **The goal to set after pasting:**
>
> ```
> /goal docs/build/TEN_MINUTES.md shows the opening ten-minute gate passing with
> screenshot and capture evidence, all three zones pass scripts/composecheck.mjs
> on every pose, docs/build/FINAL_JUDGE.md shows two consecutive passing reviews
> (stop-scrolling >= 9.0, first-ten-minutes >= 9.0, no category < 8.5), every
> deterministic gate passes, npm run build exits 0, and docs/build/PROGRESS.md
> ends with "FINAL — SHIP" — or stop after 600 turns
> ```
>
> **Authority:** this document wins over every other doc. It inherits the
> harness from `MASTER_PROMPT.md` Part 0 (state files, work cycle, evidence
> gates, do-not-stop rules), the visual law from `DIRECTION.md`, the asset
> rules from `ASSETS.md`, and the collision/speed/wayfinding blockers from
> `ASCENSION_PASS.md` Part 0. Where anything conflicts, follow this file.
> Ledger prefix `FIN-`. Judge file `docs/build/FINAL_JUDGE.md`.

---

# PART 1 — THE RULES OF THIS RUN

Four decisions are locked. Do not revisit them, do not "improve" them.

1. **Three zones only.** The Gloaming Park, Emberwick Village, the Moonlit
   Isle. Every other zone is archived behind a flag — code stays, content is
   out of scope. A short beautiful game beats a long mediocre one.
2. **Zero words.** No sentences anywhere in the shipped game. See Part 4.
3. **The first ten minutes outrank everything.** If this run stops early for
   any reason, the opening must already be finished and beautiful. Build in
   the order given in Part 3 and this is guaranteed.
4. **Hard problems get three attempts, judged.** See Part 9.

## 1.1 The prime directive

**Every stage of Part 3 ends in a state that is worth showing to a stranger.**
Never leave the build mid-surgery at the end of a work cycle. Commit only
states that run, look intentional, and pass their stage gate. If a stage is
half-done when something fails, revert to the last commit rather than pushing
forward with a broken world.

## 1.2 Standing orders

- Never stop early for context or budget reasons. State lives on disk; when
  context compacts, re-read this file, `PLAN.md`, and the tail of
  `PROGRESS.md`, then continue.
- Never ask questions. Decide, log the decision and its risk in
  `DECISIONS.md`, continue.
- Never mark anything done without looking at the evidence yourself. Read the
  screenshot. Watch the capture. Run the check.
- Never delete or weaken a test, a ledger entry, or a gate.
- Never ship a placeholder. If something cannot be finished, cut it cleanly
  rather than leaving it visible.

---

# PART 2 — SCOPE LOCK

## The three zones and what each one is for

| Zone | Role | Emotional job |
|---|---|---|
| **The Gloaming Park** | the opening | intimacy, safety, first light, curiosity |
| **Emberwick Village** | the middle | warmth, life, the only place that feels inhabited |
| **The Moonlit Isle** | the ending | awe, scale, loneliness, release |

That is a complete three-act arc in 30–40 minutes: *small and safe* → *warm
and alive* → *vast and final*. Connect them with the Old Road through fog.

Archived (flag off, do not build content for): Rooftops, Violet Ruins, Castle
Gloomspire, Candlelit Hall, Mosswood Gate, Undercroft, DREAMSCRAP, the full
FUN_PASS toy list. The Wooze/Unseen system survives in reduced form (Part 7.4).

## One colossal sleeper per zone (non-negotiable, this is the scale)

- **Park — the Antlered Sleeper.** What reads as a treeline is a 45m stag
  lying on its side. Its antlers are the canopy above the bench. Lanterns hang
  from them. It breathes, slowly, and you only notice after a minute.
- **Village — the Long Sleeper.** A 200m breathing ridge on the far horizon,
  visible from the street, never reachable, never explained.
- **Isle — the Drowned Choir.** A 120m leviathan ribcage arcing out of the
  sea; the keep stands inside it. It hums the bass note of the zone's music.

---

# PART 3 — THE SPINE (build in exactly this order)

Each stage is a complete, shippable improvement. Do not start a stage until
the previous one's gate passes and is committed.

### Stage 0 — Make it playable (blockers)
`ASCENSION_PASS.md` Part 0: swept collision + collider audit + camera
spherecast, run speed 5.2 m/s, ember-visible unkindled lights, Lantern Listen.
**Gate:** `collisioncheck.mjs` passes 100%; Park crossing ≤ 25s.
*Shippable state: the game is no longer broken.*

### Stage 1 — Light it (no new assets, no new geometry)
The full lighting rig and post stack on the existing world: moon directional
with cascaded shadows, hemisphere ambient, HDRI environment, pooled lantern
point lights, ACES, selective bloom, height fog with moon inscattering, SSAO,
per-zone LUT grade, palette lock from `DIRECTION.md` Part 7.
**Gate:** before/after screenshot pair per zone; value floor and highlight
scarcity metrics pass.
*Shippable state: the same world, three times better looking. This is the
single largest visual jump in the run — do it before anything else.*

### Stage 2 — The Blender factory
`tools/` scripts + `npm run assets` and `npm run bake` (Part 5). Prove it by
baking the Park's lightmaps and generating one hero tree.
**Gate:** Park renders with baked lighting; the hero tree beats the procedural
tree in a side-by-side judged by Part 9.
*Shippable state: the pipeline that makes everything else cheap exists.*

### Stage 3 — The Park, finished
Sculpted terrain, composition optimizer, the Antlered Sleeper, hero trees,
density pass, rain, fireflies, the bench, Beldam.
**Gate:** every Park pose passes `composecheck.mjs`; the self-critique
questions all answer correctly.
*Shippable state: one genuinely beautiful place.*

### Stage 4 — The first ten minutes
Part 8, beat by beat: title, wake, first lantern, the road, the village
reveal. Zero words. Camera authored. Music layered.
**Gate:** `docs/build/TEN_MINUTES.md` — a full capture reviewed against Part 8
with no dead stretch over 12 seconds.
*Shippable state: **this is the fallback deliverable.** If everything stops
here, you have a vertical slice worth showing anyone.*

### Stage 5 — Emberwick Village
Terrain, architecture kit, warm windows, the street, chickens, the Long
Sleeper on the horizon.
**Gate:** composecheck on all poses; the village reads as inhabited with
nobody awake.

### Stage 6 — The Moonlit Isle and the ending
Causeway, the climb, the Drowned Choir, the moon at 35°, the final brazier,
Night's End.
**Gate:** composecheck; the ending capture lands emotionally.

### Stage 7 — Judge loops
Part 10 until the exit condition holds twice.

### Stage 8 — Ship
Morning report, README, final capture set, push, PR.

---

# PART 4 — ZERO WORDS (how the game speaks)

**No sentences appear anywhere in the shipped game.** No tutorials, no
subtitles, no item names, no quest text, no tooltips, no dialogue. Menus use
icons and numbers only. This is not a limitation — it is the most premium
choice available, and it makes bad writing structurally impossible.

Study how *Journey*, *ICO*, and *Rime* teach without language, then apply:

**Light is the verb.** Warm = interactive. Cold ember = not yet lit. Nothing
warm in the world is decorative; if it glows warm, you can act on it. Teach
this once, in the first minute, by making the first lantern the only warm
thing on screen.

**The camera points.** Authored reveal volumes at every threshold ease the
camera toward what matters for 1–3 seconds without taking control. The player
learns where to go because the game already looked there.

**The body speaks.** The Lamplighter's animation is the tutorial: near an
unlit lantern he glances at it and his staff hand twitches upward. Near a
ledge he hesitates. In rain he adjusts his hat. Beldam, asleep, turns his head
toward the road you should take. No prompt UI beyond a single small ring that
fills as you hold — no letters, no button glyph names.

**Sound leads.** The lantern hums faintly when something is actionable
nearby, pitch rising with proximity. You hear the village before you see it.

**Space forbids.** Where the player should not go, the path does not go.
Never block with an invisible wall in an open space; block with terrain,
water, cliff, or fog.

**The moon is the compass.** Always visible, always in the same part of the
sky, descending. Direction and time, without a HUD.

Permitted text, total: numbers in settings, the title, and the credits.
Nothing else. The credits are the only prose in the project and they are
eight lines maximum.

---

# PART 5 — THE BLENDER FACTORY

Blender runs headless via Python. Build these under `tools/`, each callable
from npm, each idempotent, each logging what it produced.

| Script | Job |
|---|---|
| `tools/bake_lightmaps.py` | Import a zone's static geometry, place the moon and warm anchors, bake lightmaps + AO to a second UV channel, export GLB. **The highest-value script in the project.** |
| `tools/make_tree.py` | Generate hero trees: curve + skin for twisted trunks, displace for bark relief, boolean hollows, remesh, bevel, decimate. Parameterized so one script yields a family. |
| `tools/make_stone.py` | Columns, arches, statues, monoliths: primitive → displace → boolean damage → bevel → decimate. |
| `tools/bake_normals.py` | High-poly → low-poly normal map baking. This is where commercial-grade surface quality comes from at zero cost. |
| `tools/make_impostors.py` | Render distant geometry to 8-angle billboard cards for the background layer. |
| `tools/make_lods.py` | 4-tier LOD generation for anything ≥ 500 tris. |
| `tools/convert.py` | FBX/OBJ → GLB, UV repair, scale normalization, material stripping. |

Rules: every generated asset is re-graded into the locked palette, re-scaled
to the scale law, beveled, Draco-compressed, and recorded in
`public/assets/LICENSES.md`. Generated assets are committed; Blender itself is
a dev dependency, never a runtime one.

If Blender is unavailable in the environment, install it or fall back to
procedural three.js generation and log the degradation — **do not let this
block the run.**

---

# PART 6 — THE LOOK (condensed law)

Full detail in `DIRECTION.md`. The rules that matter most, restated because
they are the ones most often violated:

- **Priority ladder:** composition → lighting → silhouette → scale →
  atmosphere → color → materials → geometry → micro detail. Trade downward
  freely, never upward.
- **Three light sources maximum per scene.** Darkness stays dark.
- **≥55% of every frame below L\*40; ≤8% above L\*75.** Warmth is scarce.
- **A dark foreground mass touches a frame edge in every shot.** This one move
  does more than any asset purchase.
- **Four readable depth planes** separated by haze.
- **One focal point per zone.** Nothing competes with it.
- **≥40% of every zone's ground is deliberately empty.**
- **Nothing evenly spaced. Nothing perfectly still. Nothing recently built.**
- The world edge is never visible.

---

# PART 7 — THE THREE ZONES

## 7.1 The Gloaming Park

Teal-blue night, rain, the smell of a place nobody visits. A clearing under
the Antlered Sleeper's antler-canopy. The Long Bench with **Beldam** asleep
upright, bottle in his lap, breathing. Four cold lanterns: one beside the
bench, two along the path, one at the gate where the road leaves.

Composition: the bench and Beldam at the focal point, framed by two antler
tines in the foreground, the road exiting frame right into fog, the moon
visible above the canopy gap.

Motion: rain, dripping antlers, fireflies after the first kindle, Beldam's
breath, the Sleeper's chest rising once every twelve seconds.

## 7.2 Emberwick Village

Indigo night. A cobbled street climbing an S-curve between half-timbered
houses built into the hillside. Six warm windows, four lamp posts, a covered
well. **Chickens** — the one warm joke in the game, and the only creatures
awake. A sleeping cat on a sill. The **Long Sleeper** breathing on the horizon
above the rooftops.

The village must feel inhabited while nobody is awake: silhouettes behind
curtains, fireplace flicker, laundry, a cart left mid-unload, a door ajar.

Composition: the street as leading line, the spire as focal point, house
gables framing both edges, the Long Sleeper as the distant silhouette plane.

## 7.3 The Moonlit Isle

Moonlit blue. A stone causeway across still water, the **Drowned Choir**'s
ribcage arcing overhead as you cross, then a switchback climb to a keep. The
moon grows as you ascend until it fills a third of the sky at the top.

The final brazier sits at the summit. Kindling it triggers Night's End: every
lantern lit during the run ignites at once across the world, visible from the
height, and then the night quietly resets.

Composition: the causeway as leading line, ribs as foreground frame, the keep
as focal point, the moon behind it. This is the game's hero shot — spend
disproportionate effort here.

## 7.4 What survives of the geeked layer

Moon Brew bottles are hidden in all three zones. Drinking one opens **the
Unseen** for 90 seconds: wisps trace the road, the trees' faces become
visible, sleepers' dreams drift above them as small images, and the moon's
eyes follow you when you are not looking directly at it. In co-op, only the
drinker sees it — which is the point.

The world itself never jokes. What you find in it sometimes does.

---

# PART 8 — THE FIRST TEN MINUTES (the fallback deliverable)

Treat this as a standalone commercial demo. Capture it, watch it without
touching the controls, and log every stretch over 12 seconds where nothing
new happens visually, mechanically, or emotionally. Fix the worst first.

**0:00–0:30 — the title.** Rain on black. The moon rises over the treeline.
The camera drifts through fog and finds Beldam asleep on the bench. The title
appears. The menu fades in without cutting away from the world.

**0:30–1:30 — waking.** Control begins on the bench beside Beldam. The only
warm thing on screen is the unlit lantern's dying ember, three meters away.
No prompt appears until you are within two meters, and then only a ring.

**1:30–2:30 — the first light.** The kindle is the most polished interaction
in the game: staff lifts, flame transfers, the lantern blooms, warm light
floods the bench, rain lights up gold in the pool, the first music layer
enters, and Beldam shifts in his sleep and turns his head toward the road.

**2:30–5:00 — the road.** Two more lanterns along the path, each visible as
an ember from the last. Fireflies. The antler canopy overhead. At the gate,
the first reveal volume: the camera widens, fog parts, and the village's warm
windows are visible far below, tiny.

**5:00–7:00 — the descent.** The Old Road through fog. You hear chickens
before you see anything. One fingerpost. One Moon Brew bottle placed where
curiosity, not instruction, will find it.

**7:00–10:00 — the village.** The street reveal. Warm windows, lamp posts,
a chicken crossing the road in front of you. The music reaches its full
arrangement. Somewhere above the rooftops, the Long Sleeper breathes.

Gate: `docs/build/TEN_MINUTES.md` records the capture, the dead-stretch log,
and the fixes. This gate must pass before Stage 5 begins.

---

# PART 9 — THE THREE-ATTEMPT LOOP (for every hard visual problem)

When a problem is visual and hard — the hero tree, a zone's composition, the
moon, the water, the Night's End — do not iterate once and settle.

1. **Spawn three parallel attempts** as subagents, each with a *different
   technique*, not three tries at the same idea. Example for the hero tree:
   (a) Blender curve+skin+displace, (b) L-system branching with baked normals,
   (c) sculpted silhouette + impostor cards for distance.
2. **Screenshot all three** from the same pose under the same lighting.
3. **Judge them** against `composecheck.mjs` metrics plus the Part 10
   self-critique questions. Judging is done by a **fresh-context subagent that
   did not build any of them**, and it must justify the winner in one
   paragraph.
4. **Keep the winner, log the losers** in `DECISIONS.md` with their
   screenshots. Never average three attempts together.

If all three fail the gate, the problem is mis-specified: write a root-cause
note, redesign the approach, and run three new attempts. If a hard subtask
resists repeatedly, hand it to a subagent with a stronger model or higher
effort setting rather than grinding the main loop against it.

Cap: three rounds per problem. After that, take the best available, log the
shortfall honestly, and move on — the schedule is more valuable than
perfection on one asset.

---

# PART 10 — THE JUDGE

`docs/build/FINAL_JUDGE.md`. Two consecutive passing reviews required.

Each pass: regenerate every zone pose and postcard at 1920×1080, capture the
first ten minutes, capture Night's End, run every deterministic gate, and
**look at all of it yourself**.

Scored 1–10 with evidence. Ship requires **stop-scrolling ≥ 9.0**,
**first-ten-minutes ≥ 9.0**, and no category below 8.5:

1. stop-scrolling (would a stranger stop for this screenshot?)
2. first ten minutes
3. composition
4. lighting
5. scale and awe
6. atmosphere
7. wordless clarity (can a new player play with no text and never be lost?)
8. movement and camera feel
9. audio
10. performance at High preset
11. stability (zero console errors, no collision failures)
12. handcraft (nothing evenly spaced, nothing default, no AI tells)

Plus, every pass: two fresh-context reviewer subagents given only the
screenshots and this document, instructed to find the most serious problems,
competing. Merge their findings into the defect list.

**The seven questions**, answered per zone with the screenshot attached:
Would someone stop scrolling? Is there one obvious focal point? Does the
player feel small? Could this be any other game? Is the composition
memorable? Can geometry be simplified while improving lighting? Can lighting
improve while reducing asset count?

---

# PART 11 — WHEN THINGS GO WRONG

- **A stage gate fails twice:** revert to the last good commit, write a
  root-cause note, try a different technique via Part 9. Do not push forward
  on a broken world.
- **Blender unavailable:** fall back to procedural generation, log it, continue.
- **An asset the owner was going to supply never arrives:** ship the
  procedural stand-in. Never block on a purchase.
- **Performance fails:** step down the quality preset before cutting content,
  and log the trade.
- **Context compacts:** re-read this file, `PLAN.md`, and the `PROGRESS.md`
  tail before doing anything else.
- **Running out of run:** stop adding, start finishing. Complete the current
  stage, commit, write the morning report. A finished Stage 4 is worth far
  more than a half-built Stage 6.

---

# PART 12 — THE MORNING REPORT

Append to `docs/build/PROGRESS.md`:

- **What to look at first** — the three screenshots you are proudest of, by
  filename, and the ten-minute capture.
- **What changed** — the ten differences a player would notice immediately.
- **What is unfinished** — plainly, with no softening.
- **What was cut and why.**
- **What the owner must decide** — including any asset gap worth spending on,
  with the screenshot that proves the gap.
- **Evidence** — build result, gate results, performance numbers, judge
  scores, commit range.

Final line, only when every threshold in Part 10 is met:

`FINAL — SHIP`

---

*Three places. No words. One warm light at a time, and something enormous
breathing just past the edge of the lantern.*
