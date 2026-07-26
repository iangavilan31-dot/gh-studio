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

- `docs/build/k1capture.json` on disk records a full 10 sim-minute run of the
  authored route — 8 waypoints, 3 lanterns, ending in the village, no gap over
  its 20 s threshold. **That run predates all of the FIN-1 lighting work and is
  not evidence for the current build.** It is not being counted.
- The re-run on current code is the next step, at Part 8's stricter **12 s**
  threshold rather than k1capture's 20 s.

## Next

1. Re-point `tenminutes.mjs` at `k1capture.mjs`'s authored route (waypoints,
   not nearest-target), keeping the frame-signature beat detection and the
   screenshot series — the driver from one, the instrument from the other.
2. Run it on current code, log dead stretches at 12 s.
3. Fix the worst, re-run, and record the before/after here with screenshots.
