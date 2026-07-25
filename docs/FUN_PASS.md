# MOONREST — The Fun Pass (co-op play & geeked systems, one-shot overnight prompt)

> **How to use:** run this AFTER the prestige pass ships. Paste into a Claude Code
> session on this repo (auto permission mode), or say "read docs/FUN_PASS.md and
> execute it." Then set the goal:
>
> ```
> /goal every FUN- entry in docs/build/features.json passes with evidence,
> docs/build/FUN_JUDGE.md shows two consecutive passing reviews (average >= 9.0,
> no category < 8.0, "toy density" and "co-op laughter potential" >= 9.0), all
> deterministic gates pass, npm run build exits 0, and docs/build/PROGRESS.md
> ends with "FUN PASS COMPLETE — SHIP" — or stop after 400 turns
> ```
>
> Everything in MASTER_PROMPT.md (Vibe Constitution, budgets) and
> PRESTIGE_PASS.md (visual bar, Part AA gates, handcraft rules) remains law.
> This pass adds PLAY on top of a finished, beautiful build — it never trades
> polish away for content.

---

# PART 0 — HARNESS (inherited, one addition)

Operate exactly as in PRESTIGE_PASS.md Part 0: same state files, same work
cycle, same do-not-stop rules, same evidence-gated ledger. New entries use the
`FUN-` prefix. New judge file: `docs/build/FUN_JUDGE.md`.

**The one addition — the Toy Test.** Every feature in this document must pass
this question before it's marked done: *"Would two friends discover this
without being told, and would it make one of them say 'wait, come look at
this'?"* If a feature needs a tooltip to be fun, redesign it until it doesn't.

---

# PART 1 — DESIGN THESIS: FROM AMBIENCE TO PLAYGROUND

The prestige pass made the world beautiful. This pass makes it a **playground**.

Rules of the playground:

1. **Toys, not tasks.** Everything added is a toy first: discoverable, optional,
   repeatable, funnier with friends. Nothing added is required to finish a
   night. The kindling loop stays the only "job."
2. **Comedy is physical and gentle.** Chickens, hats, stumbles, echoes — never
   sarcasm, never memes-as-text, never breaking the world's sincerity. The
   game is funny the way a cat falling asleep sitting up is funny.
3. **Geeked is a lens, not a joke.** Being geeked doesn't degrade the wizard —
   it opens his third eye. The whole geeked-wizard meme is, at its core, a
   wizard who perceives more than sober people do. Build THAT.
4. **Co-op moments must degrade gracefully to solo.** Every multiplayer toy
   has a solo echo (a ghost partner, a chicken stand-in, or a reduced solo
   version) so single players never find dead switches.
5. **No numbers on the screen.** Toys never award points visibly. Trinkets,
   sights, sounds, and saved memories are the only rewards.

---

# PART 2 — THE GEEKED SYSTEM (flagship): WOOZE & THE UNSEEN

## 2.1 Wooze (the geeked meter — hidden, felt, never displayed)

Drinking Moon Brew now stacks **Wooze** (three levels, decaying over ~4 min):

- **Wooze 1 — warm:** slight screen sway (0.3° roll ease), colors bloom 5%,
  the walk cycle gains a happy bounce, hums occasionally.
- **Wooze 2 — glowing:** light halos gain soft chromatic fringes, music
  detunes ±4 cents with a slow wow, the wizard's giggle emote unlocks, small
  stumble animation on direction changes (charming, never impairing control).
- **Wooze 3 — FULLY GEEKED (the point of the system):** the world's hidden
  layer becomes visible for ~90 seconds. See 2.2.

Never impair actual control, camera, or navigation. Wooze is a perception
costume, not a debuff. Accessibility: a "reduce wooze visuals" toggle keeps
the unlock logic but flattens the visual effects.

## 2.2 The Unseen (the hidden layer of the world)

Content that exists ONLY while fully geeked (or during specific echoes):

- **Wisps** drift along the roads — faint blue-white sprites that scatter from
  sober eyes. They trace the optimal route to the nearest unkindled light
  (navigation disguised as folklore).
- **Old Lamplighter footprints** glow faintly on the paths — they walk the
  routes the order walked centuries ago, and following a full trail end to
  end triggers an echo.
- **The trees have faces.** Subtle, sleepy, benevolent bark-faces (Bartleby
  energy) fade in on the largest trees. One of them very slowly winks.
- **Sleeper dreams** appear as tiny drifting pictograms above sleeping NPCs
  (Beldam dreams of a full bottle; Nib of enormous constellations; the Pale
  King of a crowded, warm hall; Mote of rain).
- **The moon's face watches you** — its eyes track the player only at Wooze 3,
  and only when you're not looking directly at it (verified via screenshot
  pairs).
- **Brew glints** through walls at short range (finding the last few bottles
  becomes the geeked player's party trick).
- In co-op, a fully geeked player SEES all this and their friends don't —
  the game's best social engine: "trust me, the tree just winked." A sober
  player standing inside a geeked player's lantern pool gets 5-second
  flickers of the Unseen (shared hallucination radius).

Acceptance: screenshot pairs (sober vs geeked, same pose) for each Unseen
element; co-op capture proving asymmetric visibility + the flicker share.

## 2.3 Tone guardrail

Wooze is magic brew, full stop: no smoke, no substances beyond the established
mysterious bottle, no impairment humor. The comedy is a wizard nodding sagely
at a tree only he can see smiling. PEGI-7 energy forever.

---

# PART 3 — THE BREW BENCH (make Moon Brew a system)

Beldam's bench gains a small brewing rack (it was under the bench all along).

## 3.1 Ingredients (found while playing, 3 per recipe, respawn nightly)

`moon dew` (grass droplets after rain) · `ember spore` (drifts off kindled
lamps) · `chicken feather` (dropped when a chicken flees) · `violet petal`
(Ruins meadow) · `sea glass` (Isle coves) · `moss button` (Mote's shell,
politely) · `star fleck` (Rooftops, after the constellation event) ·
`candle wax` (Hall sconces).

## 3.2 Recipes (discovered by experimenting; failed mixes produce a comical
gray "Humble Brew" that just makes the wizard burp a small cloud of moths)

| Brew | Mix | Effect (~90s, all co-op-visible) |
|---|---|---|
| Moon Brew (classic) | dew + dew + petal | Wooze +1 |
| Floatleaf | dew + feather + petal | hops float: slow-fall, +1m height, robe parachutes |
| Echo Brew | wax + dew + sea glass | emotes echo visually (3 fading copies) and sonically |
| Tinywort | moss + petal + spore | shrink to chicken height for 60s — the world at gnome scale, chickens become majestic |
| Starheart | star fleck + dew + sea glass | you softly emit the constellation you last drew; walking writes it in brief light |
| Emberjack | spore + spore + wax | your lantern pool doubles; footsteps leave brief warm prints others can follow |
| Gigglewater | feather + petal + dew | giggle emote becomes contagious within 6m (chain-giggles across the whole lobby) |

Recipes are recorded (as smudged pictograms, no text) on the underside of the
bench — the trinket shelf's new neighbor. Acceptance: all recipes craftable,
effects visible in co-op capture, Humble Brew moth-burp confirmed adorable.

---

# PART 4 — CO-OP GAMES (wordless, discoverable, gentle)

## 4.1 Wisp Tag
A playful wisp adopts one player (orbits their hat). Staff-touching another
player passes it. Whoever holds the wisp gets a brighter lantern and slightly
faster jog. The wisp gets bored after 3 minutes and leaves to nap in a lamp.
No score, no winner — the toy IS the chasing. Solo: the wisp plays keep-away
with you around one tree, once per night.

## 4.2 The Night Choir (band mode)
Interacting with the bench, well, or any brazier while holding the emote wheel
offers a small instrument: lute (strums the zone's chord), bells (pentatonic
taps), drum (the night pulse), hum (the Lamplighter motif). Notes quantize
into the generative score — it is impossible to sound bad. All four playing
within 10m triggers the **Night Choir**: windows brighten, sleepers hum one
bar, chickens bob in rhythm (they must bob on beat; this is load-bearing),
and the music layer persists for the rest of the night. Solo: playing near a
sleeper makes them hum a duet.

## 4.3 The Great Lantern
In the Undercroft rests a two-person palanquin lantern. Two players carry it
(front and back handles — coordinated walking, speed set by the slower).
While carried: fog parts dramatically around it, the Unseen flickers visible
for BOTH carriers (sober or not), and route echoes trigger along the Old
Road. Carrying it the full loop back to the Undercroft grants the "Bearers"
trinket (one per lobby, shared shelf). Solo: it's too heavy — but you can
light it in place, which brightens the Undercroft permanently.

## 4.4 Hide-and-Sleep
Lying down (the sleep emote) anywhere hides you into the world — your wizard
visibly dozes and your name-rune fades. Friends who find you and sit beside
you both earn a tiny shared "z" particle crown for 10 minutes. The game never
explains this. It will be discovered within one session, guaranteed.

## 4.5 Small synchronized delights
- Simultaneous jump (4 players, within 0.5s): one soft firework only the
  lobby sees.
- Simultaneous point at the moon: the moon's face goes briefly bashful.
- All players sitting in a circle: a tiny shared flame kindles in the middle
  (counts as nothing; warms everything).
- Staff-bonk (gentle): hats tip; three bonks in a row and both wizards'
  hats swap for 60 seconds.

Acceptance for Part 4: two-context (and where relevant 4-context) captures of
every game; solo fallbacks verified; nothing gates progression.

---

# PART 5 — CHICKENS: THE DEEPENING

The Village chickens are the game's comedians. Expand:

- **Befriending:** crouching (sit emote) near a chicken for 10 seconds earns
  its trust — it follows you anywhere, forever (that night). Max one chicken
  per player. A trusting chicken gets a name-rune like a player's.
- **The Chicken Derby:** the Village street has faint old lane-markings
  (they were always there, look closer). Players line up with their chickens;
  any player crowing (new emote) starts the race; chickens run the street
  with different gaits (each night-seed gives them different racing
  personalities). Winner-chicken gets a tiny leaf crown for the night.
  Betting: players may wager one Moon Brew cork; corks go on the winner's
  player's shelf. Solo: race your chicken against the Watcher's... no —
  against a determined duck who appears only for derbies and has never lost.
- **Chicken fashion:** leaf hats, flower crowns, and one tiny knitted cap
  (Undercroft) can be placed on befriended chickens. Chickens wearing hats
  appear in the title-screen diorama the next night.
- **The chicken that follows you to the Isle** and watches the Night's End
  brazier beside you is recorded in the credits ("and Henrietta").

Acceptance: derby captured with 2+ players; befriended chicken follows
through zone transitions and appears in Night's End; hats persist per night.

---

# PART 6 — NIGHT ERRANDS (soft objectives, so there's always "a thing")

A notice board stands by the Park gate (it was always there). Each night-seed
posts 2–3 handwritten errands, pictogram-first, max 12 words each:

- "Bakery window's gone cold twice this week. See to it." → kindle the bakery
  first tonight → the baker's silhouette leaves a pie cooling on the sill
  (world-visible reward; pie is decorative and sacred).
- "Something glimmers in the well." → a brew ingredient cache.
- "Mote asked for a red leaf." → carry one from the Park to Mote → he wears
  it on his shell for the night; unique murmur.
- "The Curator misses the sound of the fountain." → kindle the Ruins in a
  specific order → the moonwell sings early.
- "Someone keeps moving my bench. — B." → find the Foglands bench and sit on
  it → Beldam echo.
- Pool of 12+ errands, drawn per seed; all optional; all reward sights,
  sounds, ingredients, or murmurs — never numbers.

Acceptance: board renders per-seed; every errand completable; autopilot
extended to verify each errand's trigger chain at least once across seeds.

---

# PART 7 — THE ORDER TRIALS (three skill toys, found not assigned)

Three overgrown Lamplighter training shrines, one line of carved instruction
each:

1. **The Relay (Ruins):** four sconces flash a sequence; kindle them in order
   at increasing speed. Co-op: sconces split between players — the sequence
   becomes a callout game. Reward at streak 5: the shrine hums the motif.
2. **The Stillness (Mosswood):** stand perfectly still (input-silent) as
   wisps gather on your hat and staff; 30 seconds crowns you in living light
   for the walk home. Any movement scatters them (gently, forgivingly).
   Co-op: wisps prefer whoever has been still longest — a patience contest.
3. **The Long Walk (Foglands):** a ghost of an old Lamplighter walks his
   exact historical route once; walk it behind him step-for-step (generous
   tolerance) to see the road as it was — lit, loud, alive — for the final
   ten meters. Co-op: everyone walks it single file; the vision strengthens
   per follower.

Acceptance: each trial playable solo and co-op, discoverable without text,
failable without punishment, and captured on video-frame sequences.

---

# PART 8 — COZY ANCHORS: MOON FISHING & THE CONSTELLATION JOURNAL

## 8.1 Moon fishing
Two rods lean against the Isle causeway rail (a third appears for full
lobbies; nobody asks how). Cast into the moon-streak on the water; moonfish
bite based on stillness, not timing skill. Caught fish are held up (the
wizard is SO proud), glow briefly, and are always released — each release
adds one silver streak to the water permanently that night. Fishing near a
friend slows both bobbers' drift: the game mechanically rewards sitting
together doing nothing. Rare catch: a boot (the wizard is equally proud).

## 8.2 The constellation journal
The Rooftops telescope now lets you DRAW: connect visible stars into your own
constellations (3–8 stars). Each completed drawing gets named by pictogram,
plays a chord in the zone key, and is permanently drawn faintly in that
night's sky — visible from every zone, by every player. Co-op: constellations
are signed with the drawer's rune; a night with four players' constellations
overhead is the game's best screenshot. Starheart brew (Part 3) lets you wear
your last drawing.

Acceptance: fishing capture (solo + duo), constellation drawn in one zone and
photographed from two other zones, sky persistence across the full night.

---

# PART 9 — VISUAL SET-PIECES (make the fun photogenic)

1. **The Moonrise:** nights now OPEN with the moon visibly rising over the
   Park treeline during the title card (30s) — the world brightens from
   near-black to its palette as it climbs. Skippable; never skipped twice.
2. **The Aurora (rare seed):** teal-green aurora ribbons (Skyrim palette
   `#35D0C0`/`#4EF0A0`) over the Rooftops and Isle; constellations drawn
   during an aurora are drawn in aurora colors.
3. **Geeked bloom grade:** Wooze levels get their own subtle post grade
   (warmth +5%, halo fringes) — screenshot pairs required per level.
4. **Derby dust & feathers:** the chicken derby kicks up a proper cartoon
   dust line with feather trails — the Village's one allowed burst of chaos.
5. **The Night Choir stage light:** during a choir, the moon acts as a
   followspot — a soft silver pool on the performers. The single most
   shareable clip in the game; treat it as such.

---

# PART 10 — JUDGE ADDITIONS (fun is now measured)

`docs/build/FUN_JUDGE.md`, same protocol as Part L of the prestige pass, with
these added scored categories:

17. **toy density** — the wander test (random 3-min walk) must now log a PLAY
    opportunity (not just an objective) at least every 30 seconds;
18. **discoverability** — a fresh-context subagent plays via the test hooks
    with NO documentation and must find ≥5 toys in 15 minutes;
19. **co-op laughter potential** — for each Part 4–8 feature, the judge
    writes the one-sentence story a player would tell a friend the next day
    ("the tree winked and nobody believed me"); features without a tellable
    story get redesigned;
20. **solo fallback completeness** — every toy verified with lobby size 1.

Thresholds to ship: categories 17 and 19 at >= 9.0, overall average >= 9.0,
no category below 8.0, two consecutive passes, all deterministic gates green,
and every FUN- ledger entry passing with evidence.

---

# PART 11 — PRIORITIES & ALLOWED CUTS

Build order: Part 2 (Wooze/Unseen) → Part 4.1/4.4/4.5 (cheap co-op joy) →
Part 5 (chickens) → Part 3 (brew bench) → Part 6 (errands) → Part 4.2/4.3 →
Part 8 → Part 7 → Part 9 extras.

If constrained, cut from the bottom: Trials → fishing → aurora → derby
betting → Echo/Starheart brews. NEVER cut: Wooze/Unseen, wisp tag,
hide-and-sleep, synchronized delights, chicken befriending, the notice board,
Night Choir, moonrise.

Tone guardrails from all prior documents remain absolute: no combat, no
griefing (toys cannot target unwilling players — hat-swaps require mutual
bonks), no visible numbers, no horror, nothing a 10-year-old at midnight
shouldn't dream about.

---

# PART 12 — MORNING REPORT

Same format as the prestige pass Part N, plus: the ten best "story sentences"
from judge category 19, and one saved capture each of: a full derby, a Night
Choir, a fully geeked walk through the Park, and four constellations overhead.

Final line, only when every threshold is met: `FUN PASS COMPLETE — SHIP`

---

*The prestige pass made people say "this looks expensive."
This pass makes them say "come back, you have to see this."*
