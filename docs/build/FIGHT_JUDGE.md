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
