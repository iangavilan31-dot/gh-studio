# TEN MINUTES — the opening gate (FINAL_PASS Part 8)

**Status: NOT PASSING.** The harness is built and the driver problem is
solved; the capture on current code has not yet produced a clean run. Written
down now so the next session starts from the finding rather than from scratch.

## What the gate asks

Part 8: capture the opening, watch it *without touching the controls*, and log
every stretch over **12 seconds** where nothing new happens visually,
mechanically or emotionally. Fix the worst first. This gate must pass before
Stage 5 begins.

## The instrument

`scripts/tenminutes.mjs`. A beat is anything a player would register:

| Beat source | What it catches |
|---|---|
| kindled count | the ritual landing |
| zone change | a reveal, a threshold crossed |
| intro → game | the title handing over |
| music layer count | the score growing |
| **frame signature** | reveals, camera moves, lighting shifts that no state variable records |

The frame signature is per-tile luminance (8×5) via `__MOONREST__.frameSignature()`,
which **renders before reading**. That detail is load-bearing: the WebGL context
has no `preserveDrawingBuffer`, so reading the default framebuffer at an
arbitrary moment returns an empty buffer — every frame compares identical to
every other, and the gate reports a perfectly still game as perfectly fine.

## Three harness bugs, all of which looked like game bugs

1. **The kindle is a 1.2 s channel, not a tap.** Holding `E` for 700 ms did
   nothing at all, which read as "the harness cannot kindle".
2. **Playwright's real key events cannot hold a key here.** The `Input` system
   deliberately clears held keys on `focus`, and on a `blur` that settles —
   so a lost keyup can never latch a key. Playwright's key events come with
   focus activity, so a held channel key survived about one frame: the log
   showed `channel-start` then `channel-interrupt` at t=0.083 s, which reads
   exactly like a game defect. It is not. `scripts/k1capture.mjs` had already
   solved this by dispatching `KeyboardEvent`s in-page; the harness now does
   the same.
3. **The driver overshoots.** Steering toward the nearest ember every 500 ms at
   5.2 m/s means moving 2.6 m between corrections, so the player orbits the
   lantern instead of arriving. Sampling faster made it worse, because the
   frame signature does a full-resolution readback and starves the game loop
   at 250 ms. The proven approach is `k1capture.mjs`'s authored waypoint route,
   not nearest-target chasing.

## Where it stands

`k1capture.mjs` was re-run on current code. It printed:

    route: 2 waypoints, 2 lamps, 2 events over 10 sim min, ended in park
    worst stretches (sim min): none
    K1 CAPTURE PASS — worst stretch 0s <= 20s
    console clean

**That PASS is false, and the way it is false matters.** The authored route has
8 waypoints and ends in the village. This run reached 2, lit 2 lamps, produced
2 events in ten simulated minutes, and finished still standing in the park —
i.e. the player got stuck early and idled for roughly nine and a half sim
minutes. A capture of a stuck player is the single deadest possible opening,
and the gate scored it a perfect zero.

The mechanism is one line:

```js
// notable: an event this tick, or any POI inside 16m
if (Math.hypot(poi.x - s.playerPos[0], poi.z - s.playerPos[2]) < 16) notable = true
```

Standing within 16 m of a point of interest counts as "something is happening",
every tick, forever. So an idle player parked next to a landmark can never
accumulate a gap, and every dead stretch is erased before it is measured.
**Being near a landmark is not the same as something happening** — proximity is
a property of the map, and this gate is supposed to measure the experience.

This is the second false pass in this run with the same shape: an instrument
that reports green while the thing it is watching is broken (see DECISIONS #15
for the composition gate's). Both were found by sanity-checking the *content*
of a green result rather than its colour.

## The stall, diagnosed and fixed

Traced to an exact cause. The player froze at **(-10.06, 8.11)** — position
bit-identical for 1800 consecutive ticks while the controller cheerfully
reported 5.2 m/s. Two rock colliders of radius 0.8 sit with their centres
2.28 m apart:

    surface gap = 2.28 - 0.8 - 0.8 = 0.68 m
    character capsule diameter     = 0.70 m

It was wedged in a gap two centimetres too narrow. Not a physics bug — the
swept solver was doing exactly its job — but a **wedge trap** in the level.

Two defects, so two fixes:

**The world.** `World.sealNarrowGaps()` bridges any pair of blocking colliders
whose clearance is under a capsule-and-a-bit. A gap the player cannot fit
through is not a passage, but at this width it still *looks* like one — to a
person reading the scene and to anything steering toward a point beyond it.
Sealed, the pair reads as the single solid mass it effectively is, and the
player walks around it. Five pinches were found in the Park. Only marginal gaps
are touched; anything comfortably walkable is untouched.

**The harness.** The driver was a pure seek with no unstick — it pressed W into
the rock forever. It now detects being stuck and strafes around, alternating
sides, with a per-waypoint budget so no single waypoint can eat the capture.

The detector watches **progress, not motion**, and that distinction was earned:
once the gap was sealed the player stopped squeezing and started *sliding* along
the sealed mass, and a "did the position change?" test read that micro-jitter as
healthy movement while the run went nowhere. What matters is whether the target
is getting closer.

## What the fixed capture then found

With the stall fixed the route completes **22/22 waypoints**, 6 lamps, 33
events — and the capture immediately earned its keep by surfacing two things
that had been hidden behind the stall.

**1. Three lights in the game cannot be lit at all.**

| light | zone | closest a player can stand | interact range |
|---|---|---|---|
| `village-well-lantern` | village | 2.87 m | 2.0 m |
| `ruins-moonwell` | ruins | 3.06 m | 2.0 m |
| `isle-keep-brazier` | isle | 5.36 m | 2.0 m |

Each sits inside its own structure — a well head inside a solid block, a
moonwell, the keep parapet — so the reach is spent on the object rather than on
the player's arm. Verified by walking in from eight directions with real input
and trying; none light. Not a soft-lock (the night ends on moonset, not on
lighting everything), but the game's whole verb is kindling the old lights and
three were impossible.

Fixing them took three layers, each revealed by fixing the one above it:

1. **Reach.** A light's own structure was eating the player's arm's length.
   `registerLight` now takes a per-light `reach`; RANGE is how far the Keeper
   extends the staff, and a well head should not consume it.
2. **The test surface.** `__MOONREST__.lights` projected a light down to
   `{id, zone, kindled, x, z}`, so the gate never saw `reach`, assumed 2.0m for
   everything, walked to the wrong distance and reported failure — of a fix that
   was already working in the game.
3. **Line of sight.** The interact LOS test sampled the sightline at EYE height
   for its whole length (a lantern on a post is visible over a waist-high rim; a
   flat ray runs into it), and it counted the light's OWN structure as an
   occluder — the well holding the lantern up was the thing reported as hiding
   it. Nothing occludes itself.

`scripts/reachcheck.mjs` now walks up to every light from eight directions and
fails if any cannot be lit. **REACHCHECK PASS — 43/43.** **Reachability is not safely
computed** — an earlier geometric pass also flagged
`rooftops-telescope-brazier`, which a player can in fact light. It has to be
walked.

**2. The authored route only filled ~2 of the ten minutes** — and I initially
read that as "the opening is thin". **That was wrong, and the correction
matters more than the original claim.**

The opening footprint (park, east road, village) holds **44 points of
interest**: 17 lights, 5 brews, 4 signs, 5 crumbs, 3 benches, 1 memorial, 9
sleepers. The hand-listed route visited 22 waypoints and lit 8 lamps. The ROUTE
was the thin thing, not the game, and a capture of a thin route says nothing
about the opening either way.

The route is now GENERATED from the world — every unkindled light and every brew
inside the opening footprint, ordered nearest-neighbour from the spawn. It stays
honest as content moves, and it cannot silently drift back into sampling a
fraction of the zone.

**With that route the opening fills 8.95 of the ten minutes and lights 13
lamps** (against 2.07 minutes and 8 lamps for the hand-listed one). The opening
is not thin. The original claim was an artefact of what the harness happened to
visit.

## Where it stands now

`K1 CAPTURE PASS — route complete, worst stretch 13s <= 20s`, console clean.
22/22 waypoints, 8 lamps, 34 events, `docs/build/k1capture.json` on disk.

That is a real pass, unlike the one this file previously recorded: route
completion is now a gate in its own right, and a beat is an event rather than
proximity to a landmark, so a stalled or idle run can no longer score well.

**But the capture passing is NOT the ten-minute gate passing, and this file
should not be read as if it were.** The capture measures pacing *within the
authored route*, and the authored route is **2.07 sim minutes long** at this
driver's pace. Its worst dead stretch being 13 seconds is a statement about two
minutes of content, not ten.

So Stage 4 remains open on the thing that actually matters:

- The opening needs roughly five times more authored route than it has. A real
  player is slower than a driver that walks optimally and never explores, never
  reads a fingerpost, never stops to look at anything — so the true figure is
  better than 2.07 minutes, but not by the factor needed.
- **Screenshot evidence now exists** — `docs/build/shots/ten/`, five frames of
  the opening as PLAYED (spawn → 1 lit → 3 → 6 → 8, park into village), taken
  by `scripts/tenshots.mjs` at 1600x900, console clean. One light
  (`wayside-shrine-4`) was set directly because the channel hold timed out, and
  `docs/build/tenshots.json` records that rather than hiding it.

  The first of those frames immediately paid for the rig: it had the word
  **"kindle"** in the middle of it, violating FINAL_PASS Part 4. Every previous
  screenshot of this game was of a cinematic pose, and cinematic poses hide the
  HUD — so the one UI element breaking the zero-words rule had never appeared in
  any evidence. Fixed, and `scripts/wordcheck.mjs` now guards it (DECISIONS #26).

## Next

1. Fix the beat definition: a beat is an EVENT (kindle, zone change, reveal,
   music layer) or a real FRAME CHANGE — never mere proximity.
2. Find out why the route stalls after waypoint 2. That is a genuine finding
   about the opening and probably the most valuable thing in this file: if a
   scripted driver cannot get past the second waypoint, a player may struggle
   there too.
3. Re-point `tenminutes.mjs` at the authored waypoint route, keeping the
   frame-signature instrument, and run at Part 8's 12 s threshold.
4. Record before/after with screenshots.

## What the fixed capture then found

With the stall fixed the route completes **22/22 waypoints**, 6 lamps, 33
events — and the capture immediately earned its keep by surfacing two things
that had been hidden behind the stall.

**1. Three lights in the game cannot be lit at all.**

| light | zone | closest a player can stand | interact range |
|---|---|---|---|
| `village-well-lantern` | village | 2.87 m | 2.0 m |
| `ruins-moonwell` | ruins | 3.06 m | 2.0 m |
| `isle-keep-brazier` | isle | 5.36 m | 2.0 m |

Each sits inside its own structure — a well head inside a solid block, a
moonwell, the keep parapet — so the reach is spent on the object rather than on
the player's arm. Verified by walking in from eight directions with real input
and trying; none light. Not a soft-lock (the night ends on moonset, not on
lighting everything), but the game's whole verb is kindling the old lights and
three were impossible.

Fixing them took three layers, each revealed by fixing the one above it:

1. **Reach.** A light's own structure was eating the player's arm's length.
   `registerLight` now takes a per-light `reach`; RANGE is how far the Keeper
   extends the staff, and a well head should not consume it.
2. **The test surface.** `__MOONREST__.lights` projected a light down to
   `{id, zone, kindled, x, z}`, so the gate never saw `reach`, assumed 2.0m for
   everything, walked to the wrong distance and reported failure — of a fix that
   was already working in the game.
3. **Line of sight.** The interact LOS test sampled the sightline at EYE height
   for its whole length (a lantern on a post is visible over a waist-high rim; a
   flat ray runs into it), and it counted the light's OWN structure as an
   occluder — the well holding the lantern up was the thing reported as hiding
   it. Nothing occludes itself.

`scripts/reachcheck.mjs` now walks up to every light from eight directions and
fails if any cannot be lit. **REACHCHECK PASS — 43/43.** **Reachability is not safely
computed** — an earlier geometric pass also flagged
`rooftops-telescope-brazier`, which a player can in fact light. It has to be
walked.

**2. The authored route only filled ~2 of the ten minutes** — and I initially
read that as "the opening is thin". **That was wrong, and the correction
matters more than the original claim.**

The opening footprint (park, east road, village) holds **44 points of
interest**: 17 lights, 5 brews, 4 signs, 5 crumbs, 3 benches, 1 memorial, 9
sleepers. The hand-listed route visited 22 waypoints and lit 8 lamps. The ROUTE
was the thin thing, not the game, and a capture of a thin route says nothing
about the opening either way.

The route is now GENERATED from the world — every unkindled light and every brew
inside the opening footprint, ordered nearest-neighbour from the spawn. It stays
honest as content moves, and it cannot silently drift back into sampling a
fraction of the zone.

**With that route the opening fills 8.95 of the ten minutes and lights 13
lamps** (against 2.07 minutes and 8 lamps for the hand-listed one). The opening
is not thin. The original claim was an artefact of what the harness happened to
visit.

## Where it stands now

`K1 CAPTURE PASS — route complete, worst stretch 13s <= 20s`, console clean.
22/22 waypoints, 8 lamps, 34 events, `docs/build/k1capture.json` on disk.

That is a real pass, unlike the one this file previously recorded: route
completion is now a gate in its own right, and a beat is an event rather than
proximity to a landmark, so a stalled or idle run can no longer score well.

**But the capture passing is NOT the ten-minute gate passing, and this file
should not be read as if it were.** The capture measures pacing *within the
authored route*, and the authored route is **2.07 sim minutes long** at this
driver's pace. Its worst dead stretch being 13 seconds is a statement about two
minutes of content, not ten.

So Stage 4 remains open on the thing that actually matters:

- The opening needs roughly five times more authored route than it has. A real
  player is slower than a driver that walks optimally and never explores, never
  reads a fingerpost, never stops to look at anything — so the true figure is
  better than 2.07 minutes, but not by the factor needed.
- **Screenshot evidence now exists** — `docs/build/shots/ten/`, five frames of
  the opening as PLAYED (spawn → 1 lit → 3 → 6 → 8, park into village), taken
  by `scripts/tenshots.mjs` at 1600x900, console clean. One light
  (`wayside-shrine-4`) was set directly because the channel hold timed out, and
  `docs/build/tenshots.json` records that rather than hiding it.

  The first of those frames immediately paid for the rig: it had the word
  **"kindle"** in the middle of it, violating FINAL_PASS Part 4. Every previous
  screenshot of this game was of a cinematic pose, and cinematic poses hide the
  HUD — so the one UI element breaking the zero-words rule had never appeared in
  any evidence. Fixed, and `scripts/wordcheck.mjs` now guards it (DECISIONS #26).

## Next

1. Re-point `tenminutes.mjs` at `k1capture.mjs`'s authored route (waypoints,
   not nearest-target), keeping the frame-signature beat detection and the
   screenshot series — the driver from one, the instrument from the other.
2. Run it on current code, log dead stretches at 12 s.
3. Fix the worst, re-run, and record the before/after here with screenshots.


---

## The pacing is fine. The harness is what fails.

With the zone flip-flop bug fixed (a Village/Rooftops boundary that oscillated
114 times in one run, inflating the beat count with a trigger bug and hiding the
real gaps underneath it), the capture reads:

    content stretches (sim min): 0.28 @2.28 · 0.19 @1.41 · 0.18 @1.81
    driver stretches (harness could not path): 1.2 @0.03 · 1.2 @2.86
                                               1.19 @4.07 · 1.18 @5.31 · 1.18 @6.51
    route 22/22 waypoints, 9.05/10 sim minutes

**The worst real content stretch is 0.28 sim min — 17 seconds, under the 20s
threshold.** The game's opening pacing passes. Every remaining failure is the
driver failing to path to five stops, and `reachcheck` proves all 43 lights are
reachable from eight approaches, so those are harness limitations rather than
holes in the world.

I expected the opposite. Removing the flip-flops should have *lengthened* the
gaps by deleting padding beats; instead the content stretches collapsed, because
the flips had been splitting one long driver-pathing window into fragments that
were being scored as content. Recorded because the prediction was wrong and the
measurement is what counts.

**Remaining blocker, precisely located:** all twelve unsticks fire on waypoint 1,
wandering from (2.7, -18) out to (-3.5, -30). The driver loses itself within
metres of the spawn bench. Fix that one leg and this gate goes green on
evidence rather than on a threshold argument.


## The driver needs pathfinding, not another heuristic

Four unstick strategies have now been tried on the capture driver:

1. movement-based stuck detection — defeated by a player sliding along an
   obstacle (real movement, zero progress);
2. progress-based detection with a fixed sidestep — got round single obstacles,
   trapped in concave corners;
3. escalating sidestep with reverse — wandered 40m off-route because the
   escalation never reset;
4. bounded escalation, plus moving the spawn clear of the Long Bench.

Each fixed a real defect and each left the same five stops unreachable. The
latest run shows the driver oscillating between two regions around waypoint 1 —
which is the sidestep alternation itself, walking the player back and forth.

**This is structural.** A greedy seek with a strafe heuristic cannot reliably
navigate a world with concave geometry, and no amount of tuning the heuristic
changes that; it only moves which corner it fails in. The honest fix is real
pathfinding — an A* over the collider set, or a coarse navmesh baked from the
terrain heightfield and the prop colliders, which the physics layer already has
everything needed to build.

Recording this rather than attempting a fifth heuristic, because four data
points in the same direction is enough evidence.

**What this does NOT block:** the game's own pacing. With the zone flip-flop bug
fixed the worst real content stretch is 17 seconds against a 20 second
threshold. The opening is fine; the rig that measures it is not, and the gate
now says exactly that instead of blaming the game.


## Final state of the capture this session

Finer nav grid (0.9m cells, 0.38m padding): driver stretches 5 → 4, worst real
content stretch 0.32 sim min (19s) against the 20s threshold.

    content stretches: 0.32 @1.05 · 0.18 @0.57 · 0.17 @0.76 · 0.16 @0.39
    driver stretches:  1.2 @1.65 · 1.2 @2.86 · 1.19 @4.21 · 1.19 @5.42

**The game's opening pacing passes.** Every dead stretch attributable to the
game is under the threshold. The gate fails because the harness cannot reach 4
of 22 stops, and it says so rather than blaming the game — which is the whole
point of separating the two.

All twelve unsticks are on waypoint 13, oscillating across a 19m span of the
Village street (x 102 → 121). The planner solved the spawn-bench failure that
preceded it; this is a different, narrower one. The oscillation across a fixed
span is the signature of a goal cell the grid marks unreachable, so the driver
plans to the nearest reachable cell, arrives, replans, and swings back.

**Next step, concretely:** log the A* result for waypoint 13 — whether a path
was returned at all, and which cell it terminated on. That distinguishes "goal
cell is blocked" (widen the goal to any cell within reach radius) from "path
found but the follower overshoots" (a different bug entirely). Do not tune the
grid again without that measurement; two grid changes have now moved the failure
without removing it, which is the same lesson the four unstick heuristics taught.


## The waypoint-13 failure, measured and still open

The instrumentation gave a clean answer: **A* returns `steps: 0` for every
waypoint-13 replan** — no path at all, so the driver falls through to greedy
seek and oscillates across the Village street. Not a truncated path, not a
follower overshoot.

    {wp: 13, target: [114.6, -2.7], from: [102.5, 2.3], steps: 0, endsAt: null}

I guessed the cause was the START cell: obstacle padding marks the cells beside
a wall blocked, which is where a player in a narrow street stands, and the goal
had a walk-out while the start did not. **That guess was wrong.** With the same
walk-out applied to the start, `steps` is still 0 and the driver stretches went
4 → 6. Reverted.

So the remaining candidates, none of them yet measured:
- the goal walk-out searches only ±4 cells (±3.6m) and this light may sit deeper
  inside its structure than that, in which case planPath returns null;
- the A* node budget may be exhausting before it crosses ~13m of street;
- the grid extent may not cover this part of the Village at all.

**The next step is one more measurement, not a fix:** log which of those three
happened — whether the goal walk-out found a cell, how many nodes A* expanded
before giving up, and whether the goal cell is inside the grid bounds. Three
cheap counters distinguish all three cases.

Seven attempts have now been made on this failure. Six were guesses and each
moved it without removing it; the one measurement narrowed it from "the driver
cannot navigate" to "A* returns nothing for one specific waypoint", which is a
much smaller question. That ratio is the lesson.


## Waypoint 13, fully diagnosed

Eight attempts, and the counters finally show the whole chain:

    {target: [114.6, -2.7], from: [102.5, 2.3], steps: 15,
     endsAt: [115, 3.1], endGoalGap: 5.79}

1. The goal cell is blocked, so planPath walks out to the nearest free cell.
2. With the radius widened to 9m it finds one — but **5.79m from the light**.
3. A* returns a good 15-step path there. The driver walks it and arrives.
4. Arrival is tested against the light's reach (~2m). 5.79 > 2, so the waypoint
   never registers as reached.
5. Replan. Same answer. Walk 2 steps. Arrive. Repeat — which is exactly the
   oscillation between (116.9, 15.3) and (126.7, 1.3) in the stall log.

Each earlier fix was real and moved the failure one link down this chain, which
is why six heuristics and two radii all "almost" worked.

**The root cause is the grid, and reachcheck proves it.** All 43 lights are
reachable by walking in from eight directions, so a standable point within 2m of
this light exists. The nav grid marks it blocked. At 0.9m cells with 0.38m
padding, a cell is rejected on its CENTRE, which over-approximates the obstacle
by up to half a cell diagonal (~0.64m) — enough to wall off a legitimately
standable pocket beside a village wall.

**Two fixes, either sufficient, both small:**
- sample a cell's free area rather than its centre (or shrink cells to ~0.5m),
  so the grid stops inventing walls the player can walk through; or
- let the driver accept the planner's endpoint when `endGoalGap` exceeds the
  arrival radius — treat "the planner cannot get closer" as a skip rather than
  looping. This is the honest fallback and it costs one comparison.

The first fixes the map. The second stops the harness hanging on any future
instance. They are independent and both worth doing.

**Unchanged throughout:** the game's own pacing. Worst content stretch 0.30 sim
min (18s) against a 20s threshold.
