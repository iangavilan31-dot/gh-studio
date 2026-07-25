# MOONREST: DREAMSCRAP — the dream-fighting mode (one-shot overnight prompt)

> **How to use:** run AFTER the prestige pass (fun pass optional but ideal —
> its brews become items). Paste into a Claude Code session on this repo (auto
> permission mode), or say "read docs/DREAMSCRAP_PASS.md and execute it." Then:
>
> ```
> /goal every FIGHT- entry in docs/build/features.json passes with evidence,
> docs/build/FIGHT_JUDGE.md shows two consecutive passing reviews (average
> >= 9.0, no category < 8.0, game-feel >= 9.5), all deterministic feel gates
> pass, npm run build exits 0, and docs/build/PROGRESS.md ends with
> "DREAMSCRAP COMPLETE — SHIP" — or stop after 400 turns
> ```
>
> All prior law holds (MASTER_PROMPT constitution, PRESTIGE_PASS visual bar,
> harness rules). Ledger prefix `FIGHT-`, judge file `docs/build/FIGHT_JUDGE.md`,
> same work cycle, evidence gates, do-not-stop rules, and escape hatches.

---

# PART 1 — CONCEPT

**DREAMSCRAP is a platform fighter that lives inside MOONREST's sleepers.**

The waking world stays exactly as it is: cozy, combat-free, sacred. But lie
down (sleep emote) beside any sleeper with 1–3 friends nearby — or pick
"Dream" from the title menu once discovered — and the screen tunnels into
that sleeper's dream, where the rules are different. Dreams are where wizards
scrap. Nobody gets hurt in a dream; you just get knocked so geeked you wake
up for a second.

Design pillars:

1. **Feel first.** A platform fighter lives or dies on game feel. Numeric
   feel gates (Part 5) are the hardest requirements in this document.
2. **Readable chaos.** 4 players + items + hazards must stay readable using
   MOONREST's own rules: silhouette-first fighters, one dominant hue per
   arena, warm accents = threats/pickups.
3. **Bloodless, never toothless.** No blood, no gore — impact is sold with
   hitstop, screenshake (the dream permits what the waking world forbids),
   moth-bursts, petals, sparks, and chunky sound. KO = poof into moths + a
   drifting "z".
4. **The comedy is in the cast.** A drunken-master wizard, a tiny furious
   gnome, a polite ghost, a dead king, a tortoise, and a chicken who was
   never supposed to be this good.

---

# PART 2 — THE WOOZE SYSTEM (health, reskinned as geek)

- No health bars. Each fighter shows only their **wobble state**: hits stack
  Wooze — the fighter sways more, halo fringes grow, their name-rune tilts.
  Knockback scales with accumulated Wooze (Smash percent, reskinned).
- The only HUD: a small bottle icon per player that fills tint as Wooze
  rises (readable at a glance, no numbers — constitution rule).
- Ring-out / launch: the fighter poofs into moths, "wakes" briefly (snore
  z drifts up), and respawns on a descending moon platform with 2s
  invulnerable shimmer. Stocks: 3 by default (1–5 configurable).
- Last wizard still dreaming wins. Victory scene: the winner sits down,
  yawns, and lies down next to the losers — everyone sleeping peacefully as
  the dream fades back to the waking world. Every match ends cozy.

---

# PART 3 — THE ROSTER (8 fighters, all from existing meshes)

Each fighter: run/jump/double-jump + light (bonk), heavy (charged), special
(signature), toss (gentle grab-throw), and a **Deep Dream** super charged by
landing hits (lantern meter fills; full lantern = one super).

| Fighter | Archetype | Special | Deep Dream super |
|---|---|---|---|
| **The Lamplighter** (player skin carries over) | all-rounder | flame dart that leaves a warm footprint trail | Moonrise: a mini moon rises behind them, brief slow-fall for enemies + big knockback ring |
| **Beldam** | drunken master, unpredictable | swig: random stagger-dash with armor frames | Bottle Tornado: orbiting bottles, screen sways for everyone |
| **Nib** | tiny, fastest, lightest | hat throw (returns like a boomerang) | Constellation Slam: draws a constellation, then IS the constellation, briefly enormous |
| **The Curator** | zoner, floaty | dust gust that pushes without damage | The Party Remembered: ghost nobles waltz across the stage as moving hazards |
| **The Pale King** | heavy, armored | cape sweep with royal armor frames | Chandelier Court: chandeliers drop as spotlight slams |
| **Mote** | tank, slowest, hits like a landslide | shell spin (rolls, bonks, can't stop well) | The Old Forest: roots erupt along the ground in sequence |
| **The Chicken** | joke character; secretly excellent | peck flurry; can't be grabbed (obviously) | The Derby: a stampede of chickens crosses the stage |
| **The Watcher** (secret unlock: win a match at Wooze 3 in the waking world's terms — i.e., enter a dream fully geeked) | mirror-spacing wraith | fog step (short teleport) | Lights Out: the arena's warm accents extinguish 3s, only lantern pools visible |

Balance philosophy: no infinites, toss-escapes at high Wooze, the Chicken is
genuinely good and this is never acknowledged anywhere. Verify balance with
bot round-robins (Part 6): no fighter above 60% or below 40% winrate across
the bot bracket.

---

# PART 4 — ARENAS (dream-logic zones, darker than waking)

Each arena is its sleeper's dream: the familiar zone warped by dream logic,
same palette family pushed one shade deeper. Platforms use MOONREST's
authored-composition rules.

1. **Beldam's Dream — the Endless Bench:** the Park, but the Long Bench is
   forty meters long and the rain falls upward. Bottle towers as platforms;
   the firefly jar is the center stage light.
2. **Nib's Dream — the Big Sky:** rooftops among ENORMOUS constellations;
   star-lines draw and undraw as temporary platforms (telegraphed 2s ahead).
3. **The Curator's Dream — the Party, 10,000 Years Ago:** the Ruins intact
   and gleaming, moonwell fountaining, a crowd of ghost nobles watching and
   politely applauding good hits. The saddest-beautiful arena; her dream is
   the night the party never ended.
4. **The Pale King's Dream — the Full Hall:** the throne hall warm and
   crowded (silhouette feast-goers), feast tables as platforms, chandeliers
   swing and occasionally drop (telegraphed).
5. **Mote's Dream — the Young Forest:** the Mosswood as saplings under a
   bright ancient moon; the gate loops the arena edges (walk off left,
   appear right — the only wrap-around stage).
6. **The Chicken's Dream — the Warm Oven:** a giant bakery interior; pie
   platforms, flour-dust ground fog, the bakery window as a huge warm moon.
7. **Nightmare variants (the tone dial):** every arena has a Nightmare
   regrade — palettes drop to their darkest measured values, the crowd
   becomes shadows, music goes full doom-laden dungeon synth, the moon's
   face goes hollow. Selectable at stage pick; identical layout/hitboxes
   (presentation only, verified by hitbox-overlay screenshot pairs).

Hazard rule: every hazard telegraphs ≥1.5s in the arena's warm accent color.

---

# PART 5 — GAME FEEL (deterministic gates; the hard part)

Measured by an instrumented feel harness (`scripts/fightfeel.mjs`) using the
test hooks; all numbers logged in PERFORMANCE_AUDIT:

- Input→action latency ≤ 34ms (2 frames at 60fps) local; input buffer 6
  frames; coyote time 5 frames; landing lag 2–8 frames by move weight.
- Hitstop: 40–70ms lights, 80–130ms heavies/supers, both parties frozen,
  particles NOT frozen (dreams keep drifting).
- Screenshake: amplitude scales with knockback, max 0.6% of frame height,
  always under 200ms, disabled by the reduced-motion setting.
- Knockback curves: tunable per-fighter base+growth; DI-lite (hold a
  direction during launch bends trajectory ≤ 20°).
- 60 FPS with 4 fighters + items + hazards + full particles on the target
  profile (p95 ≤ 16.6ms in a scripted 4-bot chaos capture).
- Fast-fall, ledge-forgiveness on all platforms, no wall-stick bugs, toss
  escapes (mash to escape scales with Wooze).

Feel references to study in spirit: Smash Ultimate's buffer, Rivals of
Aether's readability, TowerFall's chaos-clarity.

---

# PART 6 — MODES, MULTIPLAYER, BOTS

- **Couch (primary):** 2–4 players — gamepads + split keyboard (WASD+F/G vs
  arrows+K/L). The geeked-on-the-couch session is the design target.
- **Online:** reuse the PeerJS room codes. Delay-based lockstep with 3–5
  frames input delay (document the choice honestly in DECISIONS.md; rollback
  is out of scope). Online is for distant homies, couch is for feel purists.
  Late joiners spectate as fireflies until next match.
- **Bots:** 3 difficulty levels (Dozy / Awake / Lucid), built on the test
  hooks; used for solo play, filling couch lobbies, AND the balance
  round-robin (every fighter vs every fighter, 20 matches each, winrates
  logged — the balance gate in Part 3).
- **Items (toggleable, on by default):** Moon Brews drop as items — each
  FUN_PASS brew becomes a pickup (Floatleaf low-gravity bubble, Tinywort
  shrink, Gigglewater giggle-stun, Emberjack flame trail, Humble Brew moth
  cloud). Rare: the Boot (fishing) — throwable, comically strong, honks.
  A neutral chicken wanders most arenas; it cannot be hit (it always
  dodges, frame-1) but may peck the current leader.
- **Entry/exit:** dream entry tunnel ≤ 4s; back to the waking world ≤ 3s;
  the waking world is the lobby (walk together to the next sleeper to
  change arena — or use the quick rematch menu).
- Dream trophies (tiny sleeping figurines of defeated opponents' characters)
  appear on the pause-menu shelf. No stats screens, no ranks, no numbers.

---

# PART 7 — INTEGRATION LAW

- The waking world remains 100% combat-free. Fighting exists ONLY inside
  dreams. No waking NPC ever references violence; sleepers murmur about
  "lively dreams" at most.
- DREAMSCRAP is discoverable (lie by a sleeper with a friend; Beldam's dream
  is the tutorial arena) and skippable entirely — the cozy game must remain
  complete without ever fighting.
- Tone: playful-dark default, Nightmare dial for heavy sessions. Even
  Nightmare stays bloodless and 10-year-old-at-midnight safe.
- Performance/visual budgets, handcraft rules (no AI tells), and the
  Restored render mode all apply to arenas and fighters unchanged.

---

# PART 8 — JUDGE (FIGHT_JUDGE.md, two consecutive passes to ship)

Scored 1–10 with evidence, thresholds: average ≥ 9.0, none < 8.0,
**game-feel ≥ 9.5**:

1. game feel (the Part 5 gates + hands-on capture review);
2. readability in 4-player chaos (screenshot audits of worst-case moments);
3. fighter distinctness (each plays and reads unlike the others);
4. arena quality (composition + dream-storytelling + hazard fairness);
5. balance (bot round-robin winrates within bounds);
6. couch + online stability (4-context online capture, input-device matrix);
7. comedy landing (the chicken, Beldam's stagger, victory-nap — captured);
8. Nightmare mode grade quality;
9. entry/exit flow and lobby integration;
10. performance under chaos.

Plus the fresh-eyes competitive reviewer subagents, as always. Morning
report per PRESTIGE Part N, ending only ever with:
`DREAMSCRAP COMPLETE — SHIP`

---

*The waking world keeps the lights on. The dreams settle who's best at it.*
