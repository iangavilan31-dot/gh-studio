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

**2. The authored route only fills ~3.4 of the ten minutes.** The driver walks
optimally and never explores, so a player is slower and the real gap is smaller
than it looks — but the opening is thinner than ten minutes of authored beats.
That is now its own reported line rather than a gap number.

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

**2. The authored route only fills ~3.4 of the ten minutes.** The driver walks
optimally and never explores, so a player is slower and the real gap is smaller
than it looks — but the opening is thinner than ten minutes of authored beats.
That is now its own reported line rather than a gap number.

## Next

1. Re-point `tenminutes.mjs` at `k1capture.mjs`'s authored route (waypoints,
   not nearest-target), keeping the frame-signature beat detection and the
   screenshot series — the driver from one, the instrument from the other.
2. Run it on current code, log dead stretches at 12 s.
3. Fix the worst, re-run, and record the before/after here with screenshots.
