# MOONREST — Master Build Document (one-shot overnight prompt for Claude Code)

> **How to use:** paste this entire document into Claude Code as your prompt (or say
> "read docs/MASTER_PROMPT.md and execute it"). It is a complete, self-contained
> specification plus an autonomous work harness. The agent should not need to ask
> questions — every decision that matters is made in here. Working title **MOONREST**
> — rename freely.
>
> **Recommended launch (overnight pass):** start Claude Code in auto permission
> mode, paste this document, and then set the goal so the session keeps working
> turn after turn with an *external* evaluator deciding when it's truly done:
>
> ```
> /goal docs/build/PLAN.md shows every milestone M0–M10 checked off, `npm run build`
> exits 0, docs/build/JUDGE.md shows two consecutive passing judge passes
> (avg >= 8.5, no dimension < 7), and docs/build/PROGRESS.md's final entry says
> SHIP with evidence — or stop after 400 turns
> ```
>
> `/goal` uses a separate evaluator model, so the build agent can't grade its own
> homework; paired with auto mode it removes the two things that stall overnight
> runs (permission prompts and premature "done"). Details in Part 0.7.

---

# PART 0 — MISSION & OPERATING PROTOCOL (read first, obey always)

## 0.1 Mission

Build **MOONREST**: a 3D browser game — a cozy-dread night-walk through a sleeping
fantasy world rendered like a lost N64 game — with a controllable third-person
character and simple online co-op (up to 4 players), at a level of polish that reads
like a well-funded studio made it. The full design is specified in Parts 1–13. The
visual/audio target is defined by the vibe research in `docs/VIBE_BIBLE.md` and
`docs/research/` (if present in this repo, read them after this document; if absent,
this document is self-sufficient).

You are running a LONG AUTONOMOUS SESSION ("overnight pass"). Work milestone by
milestone (Part 12), verify everything yourself, judge your own output against the
rubric (Part 12.4), and loop improvement passes until the quality bars are met. Do
not stop early. Do not ask the user questions — make the call this document implies,
record it, and continue.

## 0.2 State files (compaction insurance)

Long sessions get summarized/compacted. Externalize ALL state to disk so nothing is
lost. Maintain these files from the very first minutes and update them after EVERY
milestone and EVERY judge pass:

- `docs/build/PLAN.md` — the milestone checklist from Part 12 with live status
  (`[ ]` / `[x]` / `[~] in progress`), plus any re-planning decisions and why.
- `docs/build/PROGRESS.md` — append-only log: timestamped entries, what was done,
  what's verified working, exact next action. Written so that a fresh agent with zero
  context could resume from it alone.
- `docs/build/JUDGE.md` — every judge pass: scores per rubric dimension, defects
  found (numbered), fixes applied, before/after notes.
- `docs/build/DECISIONS.md` — any place you deviated from this spec and why.

**Re-orientation rule:** after any compaction, or whenever you feel uncertain what to
do next: re-read `docs/MASTER_PROMPT.md` Part 0 + Part 12, then `PLAN.md`, then the
tail of `PROGRESS.md`. Never re-derive the plan from memory.

## 0.3 The ratchet (never lose working code)

- Work on the designated feature branch; commit after EVERY milestone that passes its
  acceptance checks, with message `M<n>: <what> — verified: <how>`.
- A commit is a floor: later work may refactor but must never leave the game in a
  state worse than the last commit. If an experiment fails, `git checkout -- .` back
  to the ratchet rather than patching a broken tree forward.
- Never rewrite a working system for style points late in the run. After M7, changes
  must be additive polish or targeted defect fixes only.

## 0.4 Verification discipline (no claimed success without evidence)

- "It should work" is banned. Every milestone's acceptance criteria (Part 12) name
  the exact verification: a command that exits 0, a screenshot that shows the thing,
  or a logged runtime check.
- `npm run build` must pass at every commit. Treat a failing build as a stop-the-line
  event.
- **Visual verification loop:** you have Chromium + Playwright available. Maintain a
  script `scripts/shoot.mjs` that: starts the built preview server, loads the game,
  teleports the camera to named poses (one per zone, defined in Part 3), waits for
  scene settle, and saves PNGs to `docs/build/shots/<zone>.png`. Read those PNGs
  yourself with the Read tool and inspect them against the Vibe Constitution
  (Part 2) every art milestone and every judge pass. You are the art director:
  LOOK at the work.
- **Console hygiene:** the shoot script must also capture the browser console; any
  error or warning in it is a defect.

## 0.5 Scope discipline

- The spec in Parts 1–13 is the whole scope. Do not add features not specified here
  (no combat, no chat, no inventory screens, no quests beyond what's written).
- If time-boxing forces cuts, cut in this order (last item cut first):
  photo mode → seeded weather variation → mobile touch controls → the Moonlit Isle
  zone → gamepad support. NEVER cut: co-op, the kindling loop, the retro pipeline,
  the audio system, or any of the first four zones.
- Placeholder art is allowed only before its zone's art milestone; by M8 zero
  placeholder assets may remain.

## 0.6 Failure-mode guards

- **Premature victory:** you may only declare the run complete when Part 12.6's
  final checklist is 100% checked with evidence lines in `PROGRESS.md`.
- **Thrash guard:** if the same defect survives 3 fix attempts, stop, write a
  root-cause analysis in `JUDGE.md`, and fix the cause, not the symptom.
- **Drift guard:** at the start of every judge pass, re-read Part 2 (Vibe
  Constitution) in full and compare screenshots against it literally.
- **Dependency guard:** the only permitted runtime dependencies are `three` and
  `peerjs` (plus existing repo deps). Everything else is written by you. No asset
  downloads, no CDN links, no texture/model/audio files fetched from anywhere —
  all assets are generated procedurally in code (Part 7).

## 0.7 Harness setup (do this in the first 10 minutes of the run)

These mechanisms are documented Claude Code features; set them up before writing
game code so the long run is self-sustaining:

1. **Compaction insurance, mechanical:** long sessions auto-compact near the
   context limit; conversation history is summarized but files on disk survive.
   That is why Part 0.2's state files exist. Additionally:
   - Append a `# Compact instructions` section to the project `CLAUDE.md`:
     *"When compacting, preserve: the mission (build MOONREST per
     docs/MASTER_PROMPT.md), current milestone from docs/build/PLAN.md, build
     status, and the instruction to re-read MASTER_PROMPT.md Part 0 + PLAN.md
     before continuing."*
   - Add a `SessionStart` hook with the `compact` matcher to
     `.claude/settings.json` that echoes: *"REMINDER: you are mid-way through
     building MOONREST. Re-read docs/MASTER_PROMPT.md Part 0 and
     docs/build/PLAN.md, then continue from the tail of
     docs/build/PROGRESS.md."* This re-injects the mission after every
     compaction automatically.
2. **Keep CLAUDE.md lean** (<200 lines): mission one-liner, tech constraints
   (three + peerjs only, procedural assets only), verification commands, and the
   compact instructions. Everything else stays in this document — an
   over-stuffed CLAUDE.md gets ignored.
3. **Verifiable end state only:** the `/goal` condition (title block) is written
   against artifacts you produce (`PLAN.md` checkboxes, build exit code,
   `JUDGE.md` pass records) — never against your own opinion. Keep those
   artifacts truthful; the evaluator only sees what you surface, so surface
   evidence every turn (print test/build output, name the screenshot files you
   reviewed).
4. **If `/goal` is unavailable** (e.g. this environment doesn't expose it), the
   fallback is a Stop-hook loop: a `Stop` hook script that exits non-zero (block,
   forcing another turn) while `docs/build/PLAN.md` still contains an unchecked
   milestone, and exits 0 once 12.6 is fully checked. Note the 8-consecutive-block
   override: structure turns so each one makes real progress, or the harness will
   let the session end.
5. **Screenshot verification is first-class:** Chromium + Playwright are
   available in this environment; the shoot rig (0.4) is your eyes. You are
   multimodal — read every screenshot you take. A judge pass without looking at
   images is invalid.
6. **Cost/turn discipline:** don't idle the session (idle gaps lose the prompt
   cache and waste budget); don't re-read large files you just wrote; offload
   bulk exploration to subagents if you must survey many files, keeping the main
   context for building.

---

# PART 1 — THE PITCH

**MOONREST** is a third-person ambient exploration game set in a single endless
night. You are the **Lamplighter** — a small, round, magnificently bearded wizard
who is, frankly, a little geeked — waking at dusk on a park bench with one job
inherited from a long-gone order: walk the old cobblestone roads and rekindle the
world's cold lights before the moon sets.

There is no combat, no death, no timer pressure beyond the slow descent of an
enormous watching moon. The world is asleep: gnomes doze on rooftops, a ghost king
sits his candlelit hall, chickens wander an empty village street. Every lantern you
kindle adds a musical layer to the night. Friends can join your night with a room
code and light the world with you.

It plays like a memory of an N64 game that never existed — because that's exactly
what it's modeled on: the fake-retro ambience scene (@ashenmoon89-style), World of
Warcraft's zone-painting, Wizard101's friendly darkness, Lunacid's lonely-but-safe
dungeon crawling, Majora's Mask's descending moon, and Skyrim's scarce-warmth
palette. Feel target in one line: **a campfire with the dark pressing in.**

---

# PART 2 — THE VIBE CONSTITUTION (non-negotiable art law)

These rules were measured from the reference footage and distilled from the five
pillar games. Every scene, every asset, every screenshot must obey them. Judge
passes check these literally.

1. **One dominant hue family per zone** + near-black shadows. Darkness is always a
   saturated cool color, never grey/black-black. (WoW zone scripting; W101 rule.)
2. **Exactly one warm accent type per zone** — window glow, lantern, candle, carpet,
   bottle. Warmth is scarce, therefore precious. (Skyrim palette philosophy.)
3. **Fog color == horizon color, always.** Short draw distance must read as
   atmosphere, never limitation. Every zone defines `fog`, and the sky gradient's
   lowest band equals it. (WoW Light.dbc; Lunacid silhouette trick.)
4. **A particle or mist layer in every zone** — rain, stars, motes, fireflies,
   ground fog, chimney smoke, water shimmer. The air is never empty.
5. **Nobody is awake.** NPCs sleep, doze, or drift as ghosts; lit windows imply
   life. Player characters are the only fully awake beings in the world.
6. **The moon is UI.** It is visible from every exterior zone, has a painted face,
   descends over the session, and is the only clock. (Majora's Mask; Lunacid.)
7. **Silhouette first.** Chunky exaggerated proportions (big hat, big beard, big
   hands), readable at 20 meters in fog. Detail lives in painted texture, form
   lives in silhouette. (WoW: ~1,500-tri characters.)
8. **Textures are hand-painted and tiny** — 64–128px, nearest-filtered, lighting
   and wear painted in, no realistic materials, no normal maps, no dynamic shadows.
9. **Cobblestone paths are the leading lines.** Every zone's composition guides the
   eye down a path toward its landmark.
10. **Comfy dread, never horror.** Spooky = Halloween-friendly (Wizard101 rule):
    monsters have manners, darkness is blue/violet, melancholy resolves into warmth.
11. **Idle motion everywhere, drama nowhere.** Breathing characters, drifting
    clouds, swaying lanterns, shimmering water — but no sudden movement, no jump
    scares, nothing faster than a chicken.
12. **Lo-fi is warmth.** The N64 softness (low res, chunky texels, fog) is the
    comfort blanket; authenticity dials (Part 8.6) may add crunch but the default
    look is "the memory, not the hardware."

## 2.1 Master palette (measured from reference footage — use verbatim)

| Zone (Part 3) | Dominant field | Supporting | Warm accent |
|---|---|---|---|
| Gloaming Park | `#203b45 #3d5865 #172730` | moss `#5a8a7b`, bark `#221b1a` | bottle blue-label lamplight `#e8c26a` |
| Emberwick Village | `#111b19 #070913 #0e0a3d` | indigo sky `#2907a6 #070367`, stone `#53605d` | window amber `#f0a848` |
| Emberwick Rooftops | cobalt `#0406a0 #090766 #05013e` | moss roof `#1d4635 #4f7460 #70a595` | gnome hat red `#c22f22` |
| Mosswood Gate | `#15292a #244035 #111e1d` | moss glow `#315943 #508b66` | lantern orange `#e08a30` |
| Violet Ruins | `#50365b #593f6f #322832` | flower magenta `#c888d2 #b56ec0`, arcane `#8956a8` | rune cyan `#7fd4d4` (cool accent exception: the ONE zone whose accent is cold) |
| Castle Gloomspire | `#13111c #1f1330 #23212f` | nebula violet `#4b14ac #53287c`, path stone `#a9877c` | window toxic green `#58e050` |
| The Candlelit Hall | `#17191e #271f20 #15141c` | runner green `#18321f`, stone gold `#8d8a55 #464c30` | carpet red `#781814` + candleflame `#ffb45e` |
| Moonlit Isle | `#264651 #233638 #1d2847` | sea `#22375c #374c70`, moonlight `#88aebc` | moon glow `#e8e4ff` |

Global: night-sky zenith `#0B1626`; moon face `#e8e4ff` with `#8f7fd4` shadow;
character skin `#d9b48f`; wizard robe `#4B3B6E`; player tint variants (co-op):
`#4B3B6E` violet / `#6B1F2A` oxblood / `#1F2A44` navy / `#2E4A34` forest (wizardcore
canon palette).

---

# PART 3 — WORLD & ZONES

## 3.1 Topology

One continuous scene graph — no loading screens between zones. Zones are connected
by **the Old Road**: winding cobblestone paths through banked fog ("the Foglands",
~40m connective corridors where fog closes to ~12m visibility, hiding the seams and
making each zone arrival a reveal). Total walkable world ≈ 400×400m.

```
                (8) Moonlit Isle
                     |  (causeway over water)
 (4) Violet Ruins — (1) GLOAMING PARK — (2) Emberwick Village — (3) Rooftops
        |                (spawn)              |
 (5) Castle Gloomspire ——————————————— (7) Mosswood Gate
        |
 (6) The Candlelit Hall (interior, entered through castle door)
```

Each zone declares a `ZoneLight` record (Part 8.3): sky gradient (5 stops), fog
color+near+far, ambient tint, accent color, particle system set, audio key/mode.
Crossing zone boundaries lerps all values over 4 seconds (WoW Light.dbc behavior).

## 3.2 Zone specs

Each zone lists: layout, landmark, cold lights (the kindling objectives), sleeper
(NPC), props, particles, camera pose for the screenshot rig (`scripts/shoot.mjs`),
and one co-op moment. Counts are minimums.

### Zone 1 — THE GLOAMING PARK (spawn; teal-forest night; reference: video 1 scene 1)
- **Layout:** forest clearing, ~60×60m; dirt path loop around a mossy lawn; park
  benches (3); big deciduous pixel-canopy trees (12+) ringing the space; distant
  hill silhouette; light rain.
- **Landmark:** the Long Bench under the largest tree, where **Beldam the Geeked
  Wizard** sleeps upright, blue bottle in lap, beard to his knees. He is the
  tutorial voice: kindle the lamp beside him and he half-wakes to mumble the
  premise ("...ah. The Lamplighter's up. Roads are dark, friend. The moon won't
  wait... zzz").
- **Cold lights (4):** park lamp by the bench; two path lanterns; a firefly jar on
  a stump (kindling it releases the fireflies as a permanent particle system).
- **Sleeper:** Beldam (breathing idle, head-lolls, occasional snore particle "z").
- **Props:** benches, stumps, mushroom clusters, a stone birdbath, low fences.
- **Particles:** light rain (streak sprites, splash rings on path), drifting canopy
  leaves, firefly system after jar kindled.
- **Camera pose:** low 3/4 angle framing bench + lamp + path receding into fog.
- **Co-op moment:** sitting on the bench next to Beldam with 2+ players triggers a
  shared "rest" — screen vignettes warm, rain audio softens, players' hats nod.

### Zone 2 — EMBERWICK VILLAGE (indigo; reference: video 2 scene 1)
- **Layout:** one cobblestone street climbing ~8m over 70m, S-curve; 7 half-timbered
  houses (white plaster + dark timber, steep shingle roofs) + 1 conical-spire stone
  tower; market square halfway with a covered well.
- **Landmark:** the spire tower with a clock face that has no hands (the moon is
  the clock).
- **Cold lights (6):** four iron lamp posts up the street; the well lantern; the
  bakery window (kindling windows lights them from inside, amber).
- **Sleeper:** none human — **chickens (5)** wander the street with pecking idle
  animation and soft clucks; they are the only ambulatory NPCs in the game and must
  be impeccable. One sleeping cat on a windowsill.
- **Props:** crates, barrels, hanging shop signs (swaying), flower boxes, a
  handcart, rain barrels.
- **Particles:** chimney smoke (2 chimneys), moths orbiting kindled lamps, star
  field dense overhead.
- **Camera pose:** street-level looking uphill, lamps receding, spire against sky.
- **Co-op moment:** a chicken followed by a player will hop onto their head and
  ride (pure silliness; syncs over network).

### Zone 3 — EMBERWICK ROOFTOPS (cobalt starry; reference: video 1 scene 2)
- **Layout:** climbable route (ladder behind the bakery) onto connected rooftops;
  mossy shingles, chimneys, a rooftop garden; the densest starfield in the game.
- **Landmark:** **Nib the Garden Gnome** (classic red hat) asleep spread-eagle on
  the moss beside a tiny pine, next to a chimney.
- **Cold lights (3):** two chimney-side lanterns; a stargazer's telescope brazier.
- **Sleeper:** Nib (snoring, hat rises/falls). Kindling all rooftop lights makes
  him sleep-talk constellation names, and the constellations faintly draw
  themselves (Skyrim standing-stone glow, in the sky).
- **Particles:** star twinkle (shader), occasional slow meteor, moths.
- **Camera pose:** low over the moss at Nib, cobalt sky filling the frame.
- **Co-op moment:** lying down (emote) near Nib with all players triggers the
  constellation show at full brightness.

### Zone 4 — THE VIOLET RUINS (violet twilight; reference: video 1 scene 4)
- **Layout:** broken colonnade avenue (6 columns, 2 intact with blue-painted
  capitals), arched ruin façade, domed shrine, purple flower meadow, cobble path.
- **Landmark:** the **Rune Stone** — dark monolith with a cyan glyph (this zone's
  accent is cold: the exception that proves the rule) — plus a dry **moonwell**.
- **Cold lights (5):** four arcane sconces on columns (they kindle CYAN, not warm);
  the moonwell itself is the fifth "light" — kindling it fills it with glowing
  water and starts a soft choir pad.
- **Sleeper:** **the Curator** — a translucent Highborne ghost drifting a slow
  patrol loop, pausing to "dust" fallen stones. Kindled sconces make her bow to
  the player as she passes. ("The party ended ten thousand years ago. The
  cleaning, however...")
- **Props:** fallen column drums, vine-wrapped arch, floating mote crystals,
  flower drifts, half-buried statue of an owl.
- **Particles:** violet petal drift, arcane motes rising from the well when lit.
- **Camera pose:** down the colonnade toward the ruin façade, rune stone left of
  frame (matches reference framing).
- **Co-op moment:** each player standing on one of 2–4 floor glyphs (scales to
  lobby size) makes the moonwell glow brighter per player — full lobby = a beam of
  light into the sky (Skyrim standing stone).

### Zone 5 — CASTLE GLOOMSPIRE (purple+green; reference: video 2 scene 2)
- **Layout:** cobble causeway over dark water, jagged rock banks, gatehouse, castle
  with 3 towers, green-shingled conical roofs, every window glowing toxic green,
  one dark red door.
- **Landmark:** the castle silhouette against purple nebula clouds (billboard cloud
  cards, additive, slow drift).
- **Cold lights (5):** four causeway lantern pairs; the gatehouse brazier. Windows
  are pre-lit green (they are set dressing, not objectives — this zone is already
  "awake" in the wrong color; the story is you bringing WARM light to its
  approach).
- **Sleeper:** a stone **gargoyle** on the gatehouse that is very obviously
  pretending to be a statue (it slowly turns its head when no player is looking
  at it; networked "who is it watching" logic).
- **Particles:** nebula cloud drift, green window flicker, bats (3–5, lazy loops,
  strictly non-scary).
- **Camera pose:** causeway centerline, castle full-frame, reflections in water.
- **Co-op moment:** if all players wave (emote) at the gargoyle simultaneously, it
  waves back with one wing, then snaps back to statue pose.

### Zone 6 — THE CANDLELIT HALL (interior; reference: video 2 scene 3)
- **Layout:** through the red door: gothic hall, 40×12m, columns both sides, red
  ornate carpet crossed by an emerald runner, stairs to a dark throne, floor mist,
  candle chandeliers (3) + wall sconces (6).
- **Landmark:** the throne, on which the **Pale King** sleeps sitting up, crown
  tilted, a ghost cat on his lap.
- **Cold lights (6):** the six wall sconces (chandeliers pre-lit). Kindling all six
  wakes the ghost cat only, which pads over and follows the players for the rest
  of the night (global follower, synced).
- **Interior rendering:** this zone showcases the baked-vertex-color interior trick
  (WoW MOCV): no realtime lights at all — all lighting painted into vertex colors,
  warm pools under candles, cold vault above.
- **Particles:** floor mist sheets, candle flame sprites, dust motes in
  "moonbeams" from high windows.
- **Camera pose:** hall centerline at carpet height (matches reference dolly).
- **Co-op moment:** sitting at the foot of the throne with the ghost cat present
  plays a short music-box lullaby stem, once per night.

### Zone 7 — THE MOSSWOOD GATE (moss green; reference: video 2 scene 4)
- **Layout:** the deepest fog in the game; colossal mossy trees (6, trunks 3m+
  diameter) flanking a green-lit cobble path to a stone arch gate; beyond the arch,
  the fog is impenetrable — it is the world's edge, and walking through loops you
  (visibly, honestly) back out the other side, which the sleeper comments on.
- **Landmark:** the arch, with hanging iron lanterns (2, swaying).
- **Cold lights (4):** the two arch lanterns + two trail lanterns.
- **Sleeper:** **Mote**, a moss-covered tortoise the size of a table, asleep beside
  the path; kindling all four lights makes him open one eye: "Through the gate is
  the same forest. It's always the same forest. That's the secret. Goodnight."
- **Particles:** thick ground-fog cards (3 layered, parallax), spore motes, drips
  from the canopy.
- **Camera pose:** path centerline toward the arch, trees vignetting the frame.
- **Co-op moment:** all players standing under the arch rings a deep bell and
  grants the "Gatewalkers" trinket.

### Zone 8 — THE MOONLIT ISLE (moonlit blue; reference: video 1 scene 3)
- **Layout:** a stone causeway (from the Park's north edge) crossing shimmering
  sea to a jungle-cliff island; sandy coves; palm trees; a switchback path up to a
  round crenellated keep.
- **Landmark:** the keep tower — and from its top, the best view of the moon in
  the game (it fills a third of the sky).
- **Cold lights (4):** two causeway lamps, the cove beacon, the keep-top brazier —
  the final light of the night if players sequence naturally; kindling it triggers
  the Night's End sequence (Part 6.5).
- **Sleeper:** a colony of seabirds, heads tucked; and inside the keep, hammocks
  with sleeping sailors (blanket lumps + snore particles only).
- **Particles:** sea sparkle (shader glints), foam edges (scrolling alpha strips),
  moon cross-flare sprite, palm sway.
- **Camera pose:** across the water, tower + moon + palm framing (reference
  framing).
- **Co-op moment:** the keep-top brazier requires all present players to channel
  it together (hold E) — the game's single "everyone together now" beat.

## 3.3 The Foglands (connective tissue)

Path corridors with 12m fog visibility, lined by occasional dim lanterns
(pre-kindled, flickering — breadcrumbs, not objectives), distant silhouette cards
(hills, towers of the next zone) at the fog wall. Wayfinding: carved fingerpost
signs at every fork (readable on approach, text floats as sprite). Ambient audio
crossfades happen here.

---

# PART 4 — PLAYER CHARACTER, CONTROLS, CAMERA

## 4.1 The Lamplighter (player avatar)

- **Silhouette:** WoW-proportioned little wizard: body 3 heads tall, hat adds a
  4th; wide-brim pointed hat with a soft bend at the tip; huge beard (covers
  torso); stubby legs, big round hands, big boots; a lantern-staff carried in the
  right hand (the lantern is the player's light source and swings with gait).
- **Build:** ≤2,500 tris, one 128×128 painted texture + vertex colors; hat/robe
  tinted per player (Part 2.1 tints). Procedural build from primitives + lathe
  (Part 7.2) — no model files.
- **Animation (procedural, no rig files):** bones = simple hierarchy built in
  code (root/spine/head/hat/arms/legs/beard). Gaits: idle breathe (2s sine, hat
  counter-bobs), walk (1.6 m/s), jog (3.2 m/s, hat brim flaps), sit, lie-down,
  wave, point, sleep (for the "rest" moments), channel (two-handed staff raise).
  Lantern glow subtly pulses with footsteps.
- **The geeked touch (tasteful):** picking up a **Moon Brew** bottle (Part 6.3)
  plays a happy "hmm!" hum, adds a brief warm screen-bloom + 10° camera roll ease
  ("woozy blink"), and unlocks the giggle emote for 60s. Nothing stronger; it's a
  wink, not a mechanic.

## 4.2 Controls

| Input | Action |
|---|---|
| WASD / left stick | move (camera-relative) |
| Mouse / right stick | orbit camera |
| Shift / LT | jog |
| E / A-button | interact (kindle, sit, read sign) — hold-to-channel where specified |
| Space / B | small hop (0.5m — traversal flavor, no platforming) |
| C / D-pad down | sit/lie toggle |
| Tab hold / Y | emote wheel (wave, point, giggle*, sleep) |
| P | photo mode |
| Esc | menu |

Feel spec: input→movement latency <50ms; acceleration 0→full in 120ms with
ease-out; turn-in-place under 90ms; camera-relative movement re-normalized on
orbit; slopes >40° slide gently; footstep SFX per surface (grass/cobble/wood/
shingle/sand) synced to gait phase; controller rumble ping on kindle (if gamepad).

## 4.3 Camera

Third-person orbit: default 4.5m behind, 1.8m above hip, 8° down-tilt; orbit with
0.12s smoothing; collision: spherecast pull-in with 0.25s recovery ease (never
snaps); auto-frame assist gently biases yaw toward interactables within 6m (max
2°/s, off in settings); FOV 55°, +4° while jogging (eased). Interior clamp in the
Hall (min distance 2.5m, ceiling-aware). Photo mode: free-fly, roll, FOV 20–90,
filter picker (the Part 8.6 dials), UI hide, PNG download at canvas res ×2.

---

# PART 5 — SIMPLE CO-OP (2–4 players)

## 5.1 Architecture

- **PeerJS** (WebRTC data channels, public PeerJS cloud broker — zero server code,
  works from static Netlify hosting). Host = authority.
- Flow: title → "Host Night" generates room code = 4 letters from a wordless-safe
  alphabet (e.g. `MBRK`); host's peer ID is `moonrest-<code>`. "Join Night" → enter
  code → connect. In-game: code shown in pause menu for sharing.
- Max 4 players. Late join allowed: host sends full world snapshot (kindled lights,
  moon phase, trinkets, ghost-cat state) on connect.

## 5.2 Sync model (keep it genuinely simple)

- **Transforms:** each client sends `{pos, yaw, gait, emote}` at 10 Hz (~30 B);
  remotes render with 150ms interpolation buffer + hermite smoothing; teleport snap
  if error >3m.
- **Events (reliable, host-relayed):** `kindle(lightId)`, `emote(id)`,
  `chickenMount(playerId)`, `channelStart/Stop(lightId)`, `trinket(id)`,
  `nightEnd`. Host validates (e.g. channel requires all present players in radius)
  and rebroadcasts; all sim of consequences is deterministic from events.
- **Moon clock:** host-owned `nightT` heartbeat every 5s; clients slew to it.
- **Disconnects:** remotes fade to fireflies (in-fiction), removed after 10s. Host
  migration is OUT of scope: if host leaves, clients get "the night drifts on
  without its keeper" + soft return to title (documented in DECISIONS.md).
- **No text chat** (vibe + safety): communication is emotes + proximity presence.
  Player names render as small floating runes (6-char limit, sanitized).

## 5.3 Co-op presence polish

Remote players' lantern-staffs light the world identically to local; their
footsteps are audible (quieter); their kindles bloom the same music layers; sitting
players get idle candle-warmth vignette. Every co-op moment in Part 3 must work
with 2, 3, and 4 players (radius/glyph counts scale).

---

# PART 6 — GAMEPLAY SYSTEMS

## 6.1 Kindling (the core verb)

- Interact prompt within 2m of a cold light: hold E for 1.2s; the channel shows
  the lantern-staff tipping flame toward the target; on completion: warm bloom
  (2s ease), particle burst (embers), one-shot chime in the zone's key, and the
  zone's **next audio layer fades in** (Part 9.2). Kindled lights persist for the
  night, sync over network, flicker gently forever after.
- World counter (pause menu only, no HUD): "Lights kindled: 23 / 37".
- Zone completion (all its lights): the sleeper's scripted stir (Part 3), a
  trinket, and the zone's audio reaches full arrangement.

## 6.2 The Moon Clock

- A night lasts **40 minutes** real time. The moon (painted face, subtle) descends
  along a great arc from zenith to the western fog. At 30 min it grazes the
  treeline (light warms slightly, long shadows painted into vertex ambient
  lerp); at 38 min a deep bell tolls (MM's final-hours nod, gentle); at 40 the
  Night's End plays regardless of progress.
- The moon's phase mirrors the REAL lunar phase at play time (Lunacid's trick;
  compute from date — full moon nights are brightest, new-moon nights are the
  spookiest and fog closes 15% tighter).

## 6.3 Collectibles & trinkets

- **Moon Brew bottles (12):** hidden (behind a chimney, in the moonwell, under
  the causeway...). Effect: Part 4.1's woozy wink. Counter in pause menu;
  collecting all 12 gilds Beldam's bottle gold.
- **Trinkets (one per zone, from sleepers):** displayed on the pause menu shelf
  (e.g. Beldam's cork, Nib's tiny telescope, a Curator's dust-cloth, a green
  window-glass shard, the Pale King's cat's bell, Mote's moss button, a sailor's
  knot, Gatewalkers' arch-stone). Pure keepsakes — zero mechanics.

## 6.4 Sleepers & ambient NPCs

All NPC behavior is idle loops + one scripted stir per night (Part 3). Ghost cat
follower: pathfinds by simple follow-at-distance (2m), teleports if >20m,
networked as host-owned transform at 5 Hz. Chickens: wander-graze state machine
(idle/peck/walk/flee-2m-then-forget; optional head-riding).

## 6.5 Night's End & the loop

When the keep brazier is kindled (or at minute 40): camera eases out to a slow
authored dolly (the game literally becomes one of the reference videos — each
kindled zone gets a 6s pan in reference framing), a closing title card ("the moon
sets. the lights hold. rest now."), stats (lights, brews, trinkets, friends), then
back to dusk on the bench — world reset, trinkets and brew-count persist
(localStorage). The night is a loop (MM), and that's stated with affection, not
dread.

## 6.6 Attract mode

90s idle at title (or in-game 3 min): camera detaches into the Night's End dolly
reel with the logo cornered — the game advertises itself exactly like the TikToks
that inspired it.

---

# PART 7 — ASSET PRODUCTION (100% procedural, no external files)

## 7.1 Texture factory (`src/game/art/textures.js`)

Offscreen canvas painter producing hand-painted-style tiles, all 64–128px,
`NearestFilter`, generated at boot (<300ms total, cached):

- `paint(base, opts)` core: flat base fill → 2–3 octaves of low-freq value noise
  splotches (±8% lightness, big soft blobs = brush feel) → sparse darker edge
  strokes → 2px chunky highlight dabs on one light side (painted-light rule:
  light from sky/moon direction) → optional 1px grid jitter to fake texel chunk.
- Recipes needed: cobblestone (stones as voronoi-ish blobs w/ dark grout + moss
  flecks variant), grass/moss (two greens + noise), bark (vertical streaks),
  shingle rows, plaster+timber (village walls), stone block, marble (pale +
  faint veins), carpet (red field + gold border pattern), water (flat blue +
  lighter wavelets rows), sand, foliage canopy (clustered leaf dabs on
  transparent, for alpha-tested cards), window (warm gradient + crossbar),
  window-green variant, sky-gradient LUTs, moon face (circle + painted maria +
  the subtle face), flame sprite sheet (4 frames), particle dots/streaks, runes
  glyph sheet, wood plank, roof moss overlay.
- Every texture must look correct at nearest-filter magnification — check by
  screenshot, not assumption.

## 7.2 Mesh factory (`src/game/art/meshes.js`)

Primitives + `LatheGeometry` + `ExtrudeGeometry` + manual `BufferGeometry`;
everything merged per-zone into ≤6 static draw calls (by material) via
`BufferGeometryUtils.mergeGeometries`; vertex colors baked at build (Part 8.4).

Required builders (parameterized, reused across zones): tree (trunk lathe + 3–5
canopy alpha-card crossings), pine (stacked cones), palm (curved trunk + frond
cards), bench, lamp post (3 styles), lantern (hangable), house (timber-frame box
kit: floors, gables, roof, chimney, sign), tower (cylinder + cone spire),
column (fluted lathe, breakable top), arch, wall/crenellation kit, well, cart,
barrel/crate, mushroom, statue (owl), throne, chandelier (ring + candles),
rune monolith, moonwell basin, causeway segment, rock (deformed icosahedron),
boat, hammock, fence, fingerpost, gargoyle, tortoise shell (for Mote), chicken
(the most load-bearing 200 triangles in the game), cat, ghost (translucent
robe lathe), gnome (Nib), bearded wizard (Beldam + player base mesh).

## 7.3 Audio factory

All audio synthesized in WebAudio at runtime (Part 9) — no audio files.

---

# PART 8 — RENDERING PIPELINE (the retro stack)

## 8.1 Frame flow

Scene → `WebGLRenderTarget` at **480×270** (16:9; letterbox otherwise) with
nearest mag filter → full-screen quad post pass (Part 8.5) → canvas upscaled by
integer factor (CSS `image-rendering: pixelated` as belt-and-braces). Internal res
scale setting: 0.5× / 1× / 1.5× / 2× of 480×270 (default 1×).

## 8.2 Materials & lighting model

- Everything uses `MeshBasicMaterial`-class custom shader (`ShaderMaterial` via
  one shared chunk): color = texture × vertexColor × ambientTint + emissive.
  **No realtime lights in the exterior world at all.** "Lighting" = painted
  textures + baked vertex colors + fog + emissive surfaces.
- Kindled lights: emissive windows/flames + a fake light: radial vertex-color
  warm-up baked into nearby ground/wall vertices at kindle time (precomputed
  per-light vertex weight lists at build; lerped in over 2s — looks like WoW MOCV
  glow, costs nothing per frame).
- Characters: same shader + a single hemisphere term (sky color from above, fog
  color from below) evaluated per-vertex in the vertex shader.

## 8.3 ZoneLight system (`src/game/world/zonelight.js`)

JSON per zone: `{ skyStops[5], fogColor, fogNear, fogFar, ambient, accent,
particles[], audioKey }` (values from Part 2.1). Blend: player position tested
against zone volumes; nearest-2 blend weight; ALL values lerped; sky-dome shader
takes the 5 stops as uniforms (WoW's 5-band gradient); `scene.fog` color always
=== stop[4] (horizon). This rule is asserted in a runtime dev check.

## 8.4 Vertex-color bake (build-time, in code)

At world build: for each merged static mesh vertex — start `#ffffff`, multiply
zone ambient, darken by painted-AO heuristics (distance to ground, under-canopy,
interior-corner approximations via per-builder hints — builders emit AO hints,
e.g. "under eaves" faces), warm-pool weights near each light (stored for kindle
lerp). The Hall interior is 100% vertex-lit (showcase).

## 8.5 Post pass (single shader, all optional stages via uniforms)

Order: color quantize (levels/channel: 32 default) → 4×4 Bayer dither (subtle,
0.5 default strength) → vignette (0.25, warm-shift when "resting") → optional
mode extras (8.6) → final gamma nudge. Rain/wetness: screen-space streak overlay
only in Park.

## 8.6 Authenticity dials (Settings → Video → "Memory")

- **N64 (default):** as above; textures nearest but geometry stable; soft 1px
  horizontal blur pass ("stable but soft").
- **PS1:** + vertex snapping (grid = internal res × 0.5, the Colson snippet) +
  affine UV (mix 0.8) + hard nearest everything ("sharp but unstable").
- **VHS:** N64 + scanlines, chroma bleed 1px offset, tracking wobble every ~7s,
  tape-hiss audio bed +6dB.
- **Clean:** internal res 2×, dither off — "as it appears in memory" (Lunacid's
  default philosophy).

## 8.7 Sky, moon, water, particles

- Sky: inverted dome, 5-stop gradient shader + starfield (instanced points w/
  twinkle hash) + nebula cloud billboards (Gloomspire) + cloud drift layer.
- Moon: 2 quads (face + cross-flare halo, additive), positioned on the night arc;
  face texture from the factory; NEVER occluded by fog (rendered in sky pass —
  Rule 6).
- Water: single plane per body, scrolling wavelet texture + sine vertex ripple +
  fresnel-ish additive moon-streak strip aimed at the moon azimuth.
- Particles: one instanced-quad system with per-system update fns (rain, leaf,
  mote, firefly, smoke, mist card, star, ember, snore-z). Global cap 2,000 quads;
  per-zone budgets in ZoneLight.

---

# PART 9 — AUDIO (all synthesized, WebAudio)

## 9.1 Architecture

`AudioEngine`: master → [music bus, ambience bus, sfx bus] → soft-clip limiter.
Reverb: `ConvolverNode` with procedurally generated impulse (2.5s exponential
noise decay; a longer 4s impulse for the Hall). Tape hiss: looped filtered noise
at -42dB under everything (the lo-fi warmth layer, Rule 12).

## 9.2 Generative dungeon-synth score ("ever changing yet ever the same")

Per zone: key + mode from this table (all minor-adjacent, 50–60 BPM pulse):

| Zone | Key/mode | Base layers → added per kindle |
|---|---|---|
| Park | D dorian | rain-soft pad → + harp ostinato → + flute wisp → + low choir |
| Village | G aeolian | music-box ostinato → + pad → + bassoon-ish bass → + bells |
| Rooftops | A lydian (the one bright mode — starlight) | shimmer pad → + celesta → + choir |
| Ruins | E phrygian | choir pad → + arcane bell → + sub drone → + moonwell chorus |
| Gloomspire | C harmonic-minor hint | organ pad → + pizzicato → + deep bell |
| Hall | F# aeolian | music box → + string pad → + the lullaby stem |
| Mosswood | C# dorian | forest drone → + kalimba ostinato → + owl-call motif |
| Isle | B aeolian → picardy at Night's End | sea pad → + harp → + horn call → full theme |

- Instruments = synth recipes: pad (2 detuned saws → lowpass 800Hz → slow LFO),
  harp/celesta/kalimba (triangle + fast decay envelope + slight detune),
  bell (2 sine partials inharmonic, long decay), choir (3 saws → formant-ish
  bandpass stack), bass (sine + soft square), organ (additive sines).
- Composition engine: each layer is a 4-bar ostinato pattern in the zone's mode,
  generated from seeded random-walk over chord tones (chords cycle i–VI–III–VII
  family), regenerated with variation every 8 bars (Soule's principle: the
  pattern never resolves, never repeats exactly). Kindle count per zone selects
  how many layers are audible (fade 4s). Crossfade zones 6s on travel.
- Night's End: all zones' top layers combine over the dolly reel; final picardy
  third on the title card. This must land emotionally; iterate on it.

## 9.3 SFX list (synthesized)

Footsteps ×5 surfaces (filtered noise bursts, pitch-jittered), kindle channel
(rising shimmer) + completion chime (zone key root+fifth), UI tick/confirm,
bottle pickup "hmm!" (formant blip), snores (filtered noise + sine, comedic),
chicken clucks (bandpass chirp bursts — spend time here, they carry Zone 2),
cat purr (30Hz AM), ghost drift (airy chord), bell toll (big inharmonic bell),
rain/wind/cricket/owl/sea ambience beds per zone, wave-back gargoyle stone
grind, arch bell, earthquake-free — nothing threatening ever.

---

# PART 10 — UI / UX (studio-grade shell)

- **Title screen:** live 3D diorama (the Park at dusk) behind logo; menu:
  Continue Night / New Night / Host Night / Join Night / Settings / Credits.
  Font: bundle an OFL medieval-humanist face via `@fontsource` (e.g. "IM Fell
  English" for headers, system serif fallback; UI body: "Alegreya" or similar) —
  npm-bundled, never fetched at runtime.
- **HUD: none.** Contextual interact prompt (small rune ring + "kindle") fades
  in within 2m. Everything else lives in the pause menu: lights counter, brew
  counter, trinket shelf, room code, controls reference.
- **Settings:** Video (Memory mode, internal res, reduced motion, screen-shake
  off—there is none anyway), Audio (3 sliders + hiss toggle), Controls (remap,
  invert, sensitivity, gamepad), Accessibility (subtitles for sleeper mumbles ON
  by default, photosensitivity-safe [no strobe anywhere — verify], hold-to-toggle
  option for channels). Persist all to localStorage.
- **Flow polish:** every screen transition is a 300ms fog fade; menu sounds from
  the SFX kit; pause doesn't stop the world's idle motion behind a blur-lite
  overlay (dim + desaturate, no gameplay pause needed — it's an ambient game);
  tab-blur mutes audio gracefully (1s fade); resize/DPR handled; error boundary
  with in-fiction message ("the night flickered. reload to rejoin it.") + reload
  button.
- **Meta:** favicon (moon), `<title>`, OG meta + generated OG image (a shot
  saved from the shoot rig), MIT-style LICENSE note for code, in-game credits
  crediting the inspiration honestly ("inspired by the fake-retro ambience
  scene and five games we love").

---

# PART 11 — PERFORMANCE & QUALITY BUDGETS (hard gates)

- 60 FPS on a mid-2020 integrated-GPU laptop profile; measure with a 30s scripted
  walk (Park→Village) in the shoot rig; frame-time p95 ≤ 16.6ms in that capture
  (log via `performance.now()` deltas; write result to PROGRESS.md each judge
  pass).
- ≤120 draw calls / ≤150k visible tris in the heaviest view (Village uphill);
  renderer.info asserted in dev overlay (F3: fps, calls, tris, zone, nightT).
- Zero per-frame allocations in hot paths (reuse vectors); zero console
  errors/warnings; `npm run build` bundle ≤ 1.2MB gzipped JS (three.js included);
  boot-to-title ≤ 3s on cold load (all assets procedural = no network).
- Netlify static deploy must work (existing `netlify.toml`); PeerJS is the only
  runtime network dependency.

---

# PART 12 — MILESTONES, ACCEPTANCE, JUDGE LOOPS

## 12.1 Milestones (each ends with: verify → commit → update PLAN/PROGRESS)

- **M0 — Pipeline proof.** Vite + three entry (`/play` route or replace app
  shell); 480×270 nearest pipeline; ZoneLight sky/fog dome; a cobble plane, one
  lamp, one tree; post pass with quantize+dither; shoot rig working (first
  screenshot saved and REVIEWED). *Accept: screenshot shows the look — chunky
  texels, fog=horizon, warm lamp in cool dark; build passes.*
- **M1 — The Lamplighter.** Character build + procedural animation + controller +
  camera per Part 4; walkable Park graybox. *Accept: 30s capture of movement;
  input latency + feel spec met (log measurements); silhouette reads in fog
  screenshot.*
- **M2 — Kindling + audio core.** Interact system, kindle flow, AudioEngine with
  Park's layer stack responding to kindles; moon on its arc. *Accept: video-frame
  sequence (3 shots: before/during/after kindle) + audible layer add (assert via
  engine state log); moon visibly lower after time-skip debug key.*
- **M3 — World blockout.** All 8 zones + Foglands laid out graybox with correct
  ZoneLights, paths, camera poses in shoot rig; zone lerps. *Accept: 8 zone
  screenshots, each already obeying Rules 1/3/9 at blockout fidelity.*
- **M4 — Art pass I (Park, Village, Rooftops).** Full asset builders + bake for
  zones 1–3, sleepers Beldam/chickens/Nib with idle anims. *Accept: screenshots
  vs reference palette table — hue-match check (sample dominant colors of the
  screenshot programmatically, compare to Part 2.1, ΔE tolerance documented in
  JUDGE.md).*
- **M5 — Art pass II (Ruins, Gloomspire, Hall, Mosswood, Isle)** incl. Hall
  vertex-light showcase, water, nebula. *Accept: same hue-match protocol; the
  full 8-shot reel reviewed side-by-side in JUDGE.md.*
- **M6 — Systems complete.** All cold lights, sleep­er stirs, trinkets, brews,
  ghost cat, gargoyle, Night's End + attract mode, save/persist. *Accept:
  scripted full-night playthrough via debug autopilot (walk waypoints + kindle
  all) completes and logs every beat; stats card screenshot.*
- **M7 — Co-op.** PeerJS host/join, sync, all co-op moments, late join,
  disconnect handling. *Accept: automated two-context test — launch two headless
  browser pages (host + join via code), assert transform sync, a synced kindle,
  a synced emote, late-join snapshot; screenshots from both perspectives.*
- **M8 — Shell & polish.** Title, menus, settings incl. Memory dials, photo
  mode, accessibility, meta, error boundary. *Accept: menu walk screenshot set;
  settings persist across reload (assert); all four Memory modes screenshot.*
- **M9 — JUDGE LOOPS (the overnight heart — see 12.4).**
- **M10 — Ship.** Final build, README with play/host instructions + credits,
  final PROGRESS entry, push, PR per repo workflow.

## 12.2 Definition of Done (any feature)

Implemented → integrated (reachable in the real game, not a demo page) →
verified (evidence) → performant (budgets) → committed → logged.

## 12.3 Time discipline

If a milestone stalls >90 min on one defect: log it, apply scope rules (0.5),
move on, return in M9. PROGRESS.md must never go 30 min without an entry.

## 12.4 The Judge (rubric + loop)

A judge pass = fresh-eyes adversarial review. Protocol:

1. Re-read Part 2 verbatim. Regenerate ALL zone screenshots + the 4 Memory-mode
   shots + a co-op two-view pair. Run the perf capture and the autopilot night.
2. Score 1–10 each dimension, written to JUDGE.md with one-line justification:
   **(a)** palette fidelity vs Part 2.1 (programmatic hue check + eye),
   **(b)** silhouette/composition per shot (leading line? landmark? fog reveal?),
   **(c)** atmosphere (particles/fog/idle motion present and alive in every
   zone), **(d)** character feel (latency, easing, animation charm),
   **(e)** audio (layers respond, loop seamless, Night's End lands),
   **(f)** co-op (sync solid, moments work at 2/3/4), **(g)** performance
   budgets, **(h)** UX shell (menus, settings, a11y), **(i)** stability (console
   clean, error paths), **(j)** the ineffable: "does this screenshot look like
   the reference footage?" — compare directly against the scene descriptions in
   docs/VIBE_BIBLE.md §1.
3. List every defect found, ranked by vibe-damage. Fix top defects. Re-verify
   fixed ones immediately.
4. **Loop condition:** repeat judge passes until (average ≥ 8.5 AND no dimension
   < 7) for TWO CONSECUTIVE passes, or until two consecutive passes yield zero
   new defects and no score improvement. Then proceed to M10. Minimum 3 judge
   passes regardless — the first two always find something.

## 12.5 Anti-patterns the judge must hunt

Grey darkness (Rule 1 violation) · two warm accent types in one zone · fog color
≠ horizon · empty air (no particles) · floating props / z-fighting · texture
seams at nearest filter · audio pops on loop boundaries · animation foot-slide ·
interact prompts visible through walls · remote players janking · any strobe or
fast motion · any HUD element that survived into the world screen · lorem-ipsum
or debug text anywhere.

## 12.6 Final completion checklist (all required, with evidence)

[ ] All 8 zones + Foglands, art-complete, obeying the Constitution (8 shots)
[ ] 37+ cold lights kindle-able; full-night autopilot passes
[ ] All 8 sleepers + stirs + trinkets + 12 brews + ghost cat + gargoyle
[ ] Night's End + attract mode play correctly (logged)
[ ] Co-op: host/join/late-join/disconnect verified 2-context; moments at 2+/all
[ ] 4 Memory modes; settings persist; a11y items present
[ ] Perf budgets met with logged captures; build ≤ 1.2MB gz; console clean
[ ] Title/menu/photo/credits complete; README written
[ ] Judge loop exit condition met (JUDGE.md shows the passes)
[ ] Committed at every milestone; final push + PR done

---

# PART 13 — LEGAL & TONE GUARDRAILS

- Original assets ONLY: the style language of WoW/W101/Zelda/Lunacid/Skyrim is
  studied, but no ripped models, textures, audio, names, or logos; no trademarked
  terms in-game ("Moonlight Sword", "Darkmoor", zone names from those games are
  all off-limits — everything here is already renamed).
- The reference creator's clips inspire mood; do not reproduce their footage.
- The "geeked" wink stays exactly as scoped in 4.1/6.3 — playful, no drug
  depiction beyond a wizard and his mysterious brew, nothing stronger anywhere.
- Cozy-dread means: no horror, no gore, no jump scares, nothing that would
  unsettle a 10-year-old playing at midnight — which is exactly who dreams
  about games like this.

*— end of master document. Light the first lamp.*
