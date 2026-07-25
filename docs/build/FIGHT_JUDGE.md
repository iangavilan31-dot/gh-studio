# FIGHT_JUDGE — DREAMSCRAP judge ledger

Thresholds per DREAMSCRAP Part 8: average >= 9.0, none < 8.0,
**game-feel >= 9.5**, two consecutive passing reviews to ship.
Categories: game feel · 4P readability · fighter distinctness · arena
quality · balance · couch+online stability · comedy · Nightmare grade ·
entry/exit flow · performance under chaos.

## Pass 1 — FAIL (7.90)

Fresh-eyes adversarial subagent. Read the spec, ledger, DECISIONS, and all
shots; ran balance.mjs itself.

| category | score |
| --- | --- |
| game feel | 8.5 |
| 4P readability | 7.0 |
| fighter distinctness | 8.0 |
| arena quality | 7.5 |
| balance | 8.0 |
| couch+online stability | 7.5 |
| comedy | 7.5 |
| Nightmare grade | 7.0 |
| entry/exit flow | 9.0 |
| performance under chaos | 9.0 |
| **average** | **7.90 — FAIL** |

Findings → fixes (all landed in commit `FIGHT-13: judge pass 1 fix cycle`):

1. **Hits don't read at 480×270** → spark bursts, 0.12s attacker impact
   pop, white defender hit-flash; all render-dt so they drift through
   hitstop. Recaptured `fight.png` with a 70ms shutter.
2. **Fighters read as palette swaps in silhouette** → Beldam's bottle,
   Watcher's trailing wisp, Lamplighter's hand-lantern; per-seat HUD tints.
3. **Nightmare regrade too subtle AND too dark to read** → per-dream
   authored darkest palettes (ambient/sky raised 35%), hollow moon over
   the mote fields, self-contained dungeon drone.
4. **Online gate only proved 2 seats** → fightonline now runs four
   contexts: host + two seated clients + late-join spectator firefly
   (seat -1), three-way hash equality.
5. **Bots never used melee specials, so balance never exercised them** →
   phased melee-special pulse; full round-robin re-run PASS (40–60% all).
6. **Chicken losing record breaks the joke** → tuned to 52.9%; comedy-swig
   recaptured with the bottle visible.
7. **Mote hitstop 8 ticks breaks the freeze law** → clamped to 7 (116ms).
8. **Mote wrap chases leave the frame** → arena camera capped at maxD 19.

Also fixed while under the lamp: waking-world interaction prompt leaked
into the dream HUD; flaky victory-nap shot rebuilt on deterministic
winNow().

Post-fix verification: fightfeel PASS, balance PASS, fightonline PASS
(12 checks), f0flow PASS, coopcheck PASS (17/17), fightshots COMPLETE
console-clean, build exit 0.

## Pass 2 — FAIL (8.30)

Fresh-eyes adversarial subagent; ran balance + fightfeel personally, read
all 27 shots, audited every pass-1 fix (sim fixes verified genuine; the
presentation fixes judged "landed in code, not proven in pixels").
Verdict in one line: "the deterministic sim is championship-grade; the
presentation evidence is dark, sparse, and in three categories fails its
own required proof artifacts."

| category | score |
| --- | --- |
| game feel | **9.5** |
| 4P readability | 7.5 |
| fighter distinctness | 8.0 |
| arena quality | 7.5 |
| balance | 8.0 |
| couch+online stability | 8.5 |
| comedy | 8.0 |
| Nightmare grade | 7.5 |
| entry/exit flow | 9.0 |
| performance under chaos | 9.5 |
| **average** | **8.30 — FAIL** |

Findings → fixes (all landed in the pass-2 fix cycle, then re-verified in
the recaptured pixels):

1. **No 4P chaos capture existed** → new chaos-4p.png: four fighters piled
   center-hall, items down, everyone swinging, sparks mid-burst, four
   tinted bottles up top.
2. **fight.png showed zero hit feedback** (the FX outlived neither the
   shutter nor 480×270) → sparks 14×/0.42s and bigger, pop 0.2s, flash
   0.22s; 40ms shutter. The burst is now unmissable in the capture.
3. **arena-beldam.png missing** → captured (sixth arena in the reel).
4. **nightmare-forest.png illegible** → nightmare palettes raised (~15%,
   forest ~25%), authored-glow dim 0.4→0.55, moon exempt from the dim
   with a bright rim + bigger hollow; reframed at the pit's inner edges.
5. **Full Hall cold/empty, headless grey cones** → 12 warm feast-goers
   with heads in two rows, banners, goblets, brighter candles; Curator's
   ghost nobles got translucent heads (the two crowds read apart).
6. **Big Sky constellations faint/empty navy** → the figures LOWERED into
   the fight camera's visible band, thicker star-lines, a second small
   figure, 16-star scatter.
7. **Roots/dart hazards near-invisible** → ember-hot roots with per-spike
   glows; dart glow 0.85 + fatter trail.
8. **comedy-swig dead, derby showed 3/6 birds** → authored swig pose
   (bottle to the sky, spine tipped back); derby capture timed to the
   whole flock inside ±9 of center.
9. **Balance hugged both bounds, audit numbers stale** → retune (paleking
   light 10→9, mote light kb 5.2→5.0, watcher light 7→8; a watcher
   startup buff was tried and reverted when it broke the Lucid ladder).
   Final: 44.3–55.7, nothing at a bound; audit + ledger updated.
10. **Trophies were text chips, not figurines** → canvas figurines drawn
    per trophy (curled sleeper, closed eye, identifying detail, zzz).
11. **Online gate assertions loose** → tightened: tick delta <45 (measured
    Δ well under), stall <400 (measured 1).

Post-fix verification: fightfeel PASS (after the watcher revert), balance
PASS, fightshots COMPLETE console-clean ×2, f0flow PASS, fightonline PASS,
build exit 0. All recaptures read personally before recording this entry.
