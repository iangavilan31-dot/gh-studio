# PERFORMANCE_AUDIT — DREAMSCRAP feel + perf numbers (Part 5)

All feel numbers are SIM TICKS at fixed 60Hz (16.667ms/tick), measured by
scripts/fightfeel.mjs manual stepping (DECISIONS #8) — deterministic,
contention-proof.

## F1 kinematics record (first green run)
- input→action: jump consumed on tick 1 of the press; live path is
  event → same-frame snapshot → next tick ⇒ ≤2 ticks = 33.3ms ✓ (gate ≤34ms)
- input buffer: 6 ticks (tap 4-before-land fires; 9-before does not) ✓
- coyote time: 5 ticks (free jump at +3, double-jump consumed at +7) ✓
- run speed 6.4 m/s; jump apex ≈2.2m @23 ticks; dj apex ≈1.8m
  (raised from 9.6/8.6 — the FIRST gate run caught 3.0m platforms being
  unreachable; feel bug fixed before any art existed)
- fast-fall ×1.8 (measured faster descent) ✓ · no wall-stick (vy keeps
  growing beside slabs) ✓ · ledge snap 0.35m · drop-through down+jump ✓
- landing lag 2–8 by move weight: plumbed (aerialWeight), GATED IN F2
  when moves exist — not yet claimed.

## Perf budget notes
- Dream scene draw calls (F1 blockout): trivial. Budget tracking begins
  when fighters+items+hazards land (F5/F6); MOONREST budgets apply
  unchanged (≤150 calls, ≤250k tris).

## F2 impact record (all tick-measured, FIGHTFEEL PASS 29/29)
- hitstop: light 3 ticks = 50ms (∈40–70) · heavy 6 ticks = 100ms (∈80–130);
  BOTH parties frozen (positions bit-identical through the freeze) ✓
- knockback: heavy 10.72 vs light 5.18 at first blood; growth verified
  5.18 → 5.96 across a wooze-building exchange ✓
- DI-lite: launch angle 64.4° (hold toward) vs 24.4° (hold away) = ±20°
  exactly, measured from the launch event's own angle ✓
- landing lag by move weight: aerial light 3 ticks, aerial heavy 7 (∈2–8) ✓
- toss: grab in 1.25m reach; fresh escape ≈5 mashes; need grows
  +1 per 20 wooze ✓ (hits break grabs; the Chicken will be ungrabbable)
- screenshake: amp01→meters capped at 0.6% of visible frame height
  (0.047m ≤ 0.070m cap), ≤12 ticks = 200ms, reduced-motion zeroes it ✓

## F3 visual-half record + the landing-teleport fix
- The money-shot pass caught a REAL sim bug the deterministic gates never
  tripped: wall pushout ran before landing resolution with no side-entry
  guard, so the one integration frame that dips a hair below a slab top
  (landing from a low knockback arc) matched the "inside the slab band"
  test and teleported the fighter to the slab's nearer END face — on the
  26m bench that was x 0.95 → 13.3 in one tick, read as "a jab sends you
  half the stage". Fix: pushout requires prevY already below the top
  (true side entry). Tick-trace after fix: jab at 6 wooze travels
  0.49 → 0.96 (~0.5m) and lands clean; wall-stick gate still green
  (fall-beside-slab has prevY below top every frame). 34/34 ×2.
- Dynamic fight camera: frames all living fighters, d ∈ [13, 24]
  (fitW/fitH against fov 38°), exp-smoothed τ=0.28s; shake offsets ride
  on top; victory push-in to d=14.5. Shake cap now measured against the
  CURRENT camera distance (cap grows with zoom-out, stays 0.6% of frame).
- KO poof clamps to ±14/-4..13 (just inside the widest frame) so the
  blast-edge burst is SEEN — before this, x=±18 was off-screen at every
  zoom, which is why ko-moths.png used to read empty.

## F7 record: the round-robin as a bug hunt
560 bot matches at full sim speed (2.0s in node — fightsim imports clean,
no three/DOM) surfaced three determinism-preserving sim bugs the tick
gates never tripped: (1) a fighter GRABBED at exactly the super's cast
tick recast it every tick (1278 Moonrises); (2) the hitstop-expiry tick
returned before advancing move.t, so edge-triggered move ticks re-fired
when their own hitstop thawed (3859 darts) — fixed with a thawed flag the
resolution loop respects, freeze length bit-identical; (3) the buffered
jump outranked drop-through, so down+jump on a shelf pogoed instead of
descending (28% of the bracket drew). After fixes: zero draws in 560.
Final winrates all 40–60: lamp/beldam/nib 47.1, curator 59.3, king 52.9,
mote 52.9, chicken 42.9, watcher 50.7.
