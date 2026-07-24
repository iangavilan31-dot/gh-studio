# MOONREST — Prestige Pass (multi-million-dollar polish & expansion, one-shot overnight prompt)

> **How to use:** run this AFTER the first MOONREST build pass exists. Paste this
> document into a fresh Claude Code session in the repo (auto permission mode), or
> say "read docs/PRESTIGE_PASS.md and execute it." Then set the goal:
>
> ```
> /goal docs/build/POLISH_JUDGE.md shows two consecutive passing reviews (average
> >= 9.0, no category < 8.0, and the opening-impact/movement/atmosphere/
> production-value thresholds in Part L met), every deterministic gate passes,
> npm run build exits 0, and docs/build/PROGRESS.md ends with
> "PRESTIGE PASS COMPLETE — SHIP" — or stop after 400 turns
> ```
>
> This pass **supersedes** `docs/MASTER_PROMPT.md` where they conflict (notably
> the default render mode — see Part Q). Everything else in the master document
> (Vibe Constitution, zone specs, budgets, harness rules) remains law.

You are no longer building the first version of MOONREST.

The existing game has already completed one implementation pass. Your task is now
to transform the current build from an ambitious prototype into something that
feels authored, expensive, mysterious, memorable, and commercially presentable.

Do not restart the project. Do not replace functional systems merely because you
would have implemented them differently. Begin by inspecting the existing game,
screenshots, code, test hooks, build documents, and play flow. Preserve working
systems. Improve the highest-impact weaknesses through deliberate, evidence-based
passes.

The target is not "more content." The target is:

A small game with such concentrated visual identity, responsiveness, atmosphere,
sound, environmental storytelling, and handcrafted detail that players assume a
large professional team made it.

The game should feel like dark fantasy folklore experienced through the warm,
distorted memory of an old console game. It should be strange, funny, melancholy,
cozy, and slightly geeked without becoming random, ironic, childish, or horror.

---

# PART 0 — HARNESS & LOOP (operating protocol for this pass)

The overnight machinery from MASTER_PROMPT.md Part 0 stays in force. Specifics for
this pass:

## 0.1 State files (continue, do not restart)

- Keep appending to `docs/build/PROGRESS.md` (with Learnings) and
  `docs/build/DECISIONS.md` (assumptions ranked by risk).
- Extend `docs/build/features.json` with new entries for every improvement in this
  document, ids prefixed `POLISH-`, all starting `"passes": false`. The ledger
  ratchet rule is unchanged: **it is unacceptable to remove or edit existing
  entries** — the ledger only gains entries or flips `passes` to `true` after you
  have personally read the evidence.
- New files this pass owns: `docs/build/POLISH_AUDIT.md` (Part A),
  `docs/build/POLISH_JUDGE.md` (Part L), `docs/build/PERFORMANCE_AUDIT.md`
  (Part J), `docs/build/HANDMADE.md` (Part P).
- Refresh the compaction hook message to name THIS document: after any
  compaction, re-read PRESTIGE_PASS.md Part 0 + the audit + the PROGRESS tail
  before continuing.

## 0.2 The work cycle (unchanged shape, polish-sized)

1. Re-anchor: read POLISH_AUDIT.md ranking, PROGRESS tail, features.json, git log.
2. Baseline: `scripts/init.sh` — build + smoke test must pass BEFORE new work.
3. Pick ONE `POLISH-` item — the highest-ranked open issue from the audit.
4. Search before writing; extend working systems, never parallel-implement.
5. Implement, verify like a player (screenshots/capture/test hooks), READ the
   evidence, flip `passes: true`.
6. Ratchet: commit `POLISH-<n>: <improvement> — verified: <evidence>`, append
   PROGRESS entry, regenerate affected screenshots.

## 0.3 Do-not-stop rules

- Never stop early for context/budget reasons; save state and continue. Never
  artificially wrap up because the session feels long.
- Blockers: mock, stub, or documented assumption; keep moving; log in
  DECISIONS.md ranked by risk. **Escape hatch:** an item that blocks 3 cycles
  gets a blocker note and is shelved until the next judge pass. Blocked ≠ done.
- Forbidden always: deleting/weakening tests or ledger entries, hard-coding to
  pass a check, `--no-verify`, force-push, placeholder work left behind,
  suppressing errors instead of fixing causes, breaking co-op/save/a11y/perf or
  the full-night flow for any polish gain.
- Evidence over assertion: test output, command transcripts, named screenshots
  you actually read. Your own "it works" doesn't count.

## 0.4 If `/goal` is unavailable

Install a Stop hook that blocks turn-end while POLISH_JUDGE.md lacks two
consecutive passing reviews or any deterministic gate fails, and unblocks once
Part N's final line is legitimately written. Structure every turn to make real
progress (the hook's 8-block override will otherwise end the session).

---

# PART A — OPERATING RULES FOR THIS PASS

## A.1 Inspect before changing

Before editing code:

1. Run the current build.
2. Play from title screen through at least three zones manually (via the test
   hooks and captures — and READ what you capture).
3. Run the screenshot rig for every zone.
4. Run the current automated tests and performance capture.
5. Read:
   * `docs/MASTER_PROMPT.md`
   * `docs/build/PLAN.md`
   * `docs/build/PROGRESS.md`
   * `docs/build/JUDGE.md`
   * `docs/build/DECISIONS.md`
   * `docs/build/features.json`
6. Create `docs/build/POLISH_AUDIT.md`.

The audit must identify:

* The five strongest existing elements.
* The ten most visibly unfinished or cheap-looking elements.
* The five moments where player attention drops.
* The three weakest zones.
* The three strongest screenshots.
* The three weakest screenshots.
* The most repetitive interaction.
* The least convincing animation.
* The weakest audio transition.
* The largest performance cost.
* Anything that feels procedural in a bad way.
* Anything that feels like a debug feature or placeholder.
* Anything that violates the Vibe Constitution.
* Anything that reads as an AI tell (Part P checklist).

Rank every issue by:

1. player-visible impact;
2. frequency;
3. emotional damage;
4. cost to fix.

Do not begin expansion work until this audit exists.

## A.2 Preserve the ratchet

Every major improvement must be isolated and committed.

Use commit messages: `POLISH-<n>: <improvement> — verified: <evidence>`

After each commit:

* run `npm run build`;
* run the relevant automated test;
* regenerate affected screenshots;
* inspect those screenshots;
* append evidence to `docs/build/PROGRESS.md`.

Do not allow polish work to break co-op, save state, accessibility, performance,
or the existing full-night flow.

## A.3 Priority order

Spend effort in this order:

1. First 10 minutes of play.
2. Character movement and camera feel.
3. Lighting, composition, fog, and scene depth.
4. Audio responsiveness and transitions.
5. Environmental interaction density.
6. Zone-specific identity.
7. Co-op presence.
8. UI shell and presentation.
9. Replay variation.
10. Additional content.

A polished 40-minute experience is better than a larger game with diluted quality.

---

# PART B — THE EXPENSIVE-FEEL TEST

At the end of this pass, every scene must demonstrate the following.

## B.1 Authored composition

The world must never resemble evenly scattered procedural props.

For every screenshot pose:

* establish a foreground frame;
* establish a readable middle-ground subject;
* establish a distant silhouette;
* use the cobblestone path as a leading line;
* create controlled negative space;
* avoid tangent collisions;
* avoid repeated spacing;
* cluster props into intentional stories;
* hide the world boundary through fog, silhouette, elevation, or architecture.

Every zone must contain at least three deliberately composed "postcard views"
outside the automated screenshot pose.

Create optional debug commands:

* `window.__MOONREST__.listPostcards()`
* `window.__MOONREST__.teleportPostcard(zoneId, index)`

Save every postcard to: `docs/build/shots/postcards/<zone>-<index>.png`

## B.2 Layered scene depth

Each exterior zone must visibly contain:

1. foreground motion;
2. playable middle-ground;
3. distant silhouette layer;
4. sky layer;
5. atmosphere between layers.

Examples: branches crossing the camera; fences or stones near the path;
fog-separated architecture; distant towers; drifting clouds; parallax mist; near
and far particle speeds.

Flat scenes are unacceptable even if their individual models are attractive.

## B.3 Material readability

Despite the stylized presentation, a player must instantly distinguish: wet
cobble; moss; bark; plaster; timber; metal; glass; old cloth; water; carved
stone; ghost material.

Accomplish this through painted value structure, edge treatment, silhouette,
texture rhythm, and controlled specular-style emissive tricks — not realistic
PBR. Every surface must remain legible under the zone's dominant hue.

## B.4 Motion hierarchy

Motion must be layered by importance:

* Level 1: barely perceptible breathing, fog, leaves, cloth.
* Level 2: lantern sway, chimney smoke, chickens, ghost drift.
* Level 3: player movement, kindle events, sleeper reactions.
* Level 4: rare authored moments such as constellation reveal or Night's End.

Do not let background effects compete with player actions. No object should
remain perfectly static if subtle motion would make it feel alive, but no scene
should appear busy.

## B.5 Interaction response stack

Every significant player action should respond through at least four channels:

1. character animation; 2. visual effect; 3. sound; 4. world-state reaction.

Major actions should add: 5. camera response; 6. environmental response;
7. cooperative response; 8. persistent consequence.

Do not overuse screen shake. Prefer camera ease, lens breathing, lighting
response, particles, animation anticipation, and sound.

---

# PART C — PLAYER FEEL OVERHAUL

The Lamplighter is the product's most important asset. The player watches this
character for nearly the entire experience.

## C.1 Movement personality

Movement must feel heavy enough to be grounded and light enough to remain
charming. Add or refine:

* visible acceleration through body lean;
* deceleration step or robe settle;
* distinct walk and jog cadence;
* slight uphill effort;
* careful downhill steps;
* feet aligning to uneven ground;
* hand and staff secondary motion;
* beard drag and delayed follow-through;
* hat tip lag;
* robe squash on landing;
* small boot compression;
* gentle turn-in-place animation;
* contextual idle shifts every 8–16 seconds;
* subtle glance toward nearby interactables;
* cold idle where hands briefly warm near the lantern;
* rain idle where the hat is adjusted;
* edge idle near cliffs or rooftops;
* seated idle with different poses.

Prevent foot sliding. Foot planting is more important than animation complexity.

## C.2 Camera authorship

Improve the third-person camera so it feels deliberately directed. Add:

* terrain-aware vertical framing;
* anticipatory look toward road bends;
* slight camera lag during jog starts;
* gentle recenter only after movement commitment;
* stronger collision handling in doorways;
* soft shoulder offset near walls;
* reduced camera motion during interaction channels;
* contextual widening when revealing landmarks;
* narrow framing in intimate interiors;
* authored reveal volumes at major zone entrances.

A reveal volume may temporarily influence yaw, pitch, distance, and FOV for 1–3
seconds, but must never fully remove player control. Every zone entrance should
produce one memorable reveal.

## C.3 Interaction animation

Kindling cannot remain only a progress hold. The full interaction should include:

1. target recognition; 2. staff grip adjustment; 3. body anticipation;
4. flame transfer; 5. target ignition; 6. reaction recoil; 7. warm settle;
8. return to locomotion.

The target light should respond before completion with faint ember attraction and
sound tension. Canceling should have a clean recovery animation. Different
targets should use small variations: high lamp; low lantern; window; brazier;
moonwell; hanging light.

## C.4 Character charm pass

Add rare low-frequency behaviors:

* beard caught briefly on the staff;
* hat almost blown off in Mosswood;
* tiny proud nod after completing a zone;
* quiet humming after collecting a Moon Brew;
* looking back at a newly lit street;
* attempting to sit beside a chicken before it moves;
* wiping rain from the lantern glass;
* falling asleep for half a second during a long idle, then waking.

These behaviors must remain subtle. They should feel discovered, not performed
for the camera.

---

# PART D — MAKE THE NIGHT MYSTERIOUS WITHOUT COMBAT

MOONREST needs curiosity between lights. Add a "soft mystery" layer that makes
the world feel unknowable without adding enemies, danger, or conventional quests.

## D.1 The Uncertain Road system

On each new night, select a seeded set of small environmental variations.
Allowed variations:

* a fingerpost points in a different direction;
* a bench appears in a Foglands corridor;
* a distant tower silhouette appears where no tower exists;
* one lamp is already faintly glowing;
* a door previously closed is slightly open;
* a cluster of mushrooms forms a symbol;
* a ghostly procession is visible far away but vanishes behind fog;
* a boat appears offshore;
* a second moon reflection appears briefly in water;
* Beldam is sleeping in a different posture;
* Nib's hat is somewhere nearby instead of on his head;
* one chicken is wearing a tiny leaf;
* the gargoyle is facing a different direction at arrival;
* the Pale King's crown has slipped to the other side;
* a constellation differs subtly;
* a bottle appears in an unusual but reachable place.

These variations must never block progression, alter required light counts, or
create confusion about core objectives. Use one seeded "night signature" and
expose it in the test surface.

## D.2 The world notices the player

Add contextual micro-reactions:

* moths gather around the player's lantern;
* grass leans subtly as the player passes;
* shallow water ripples around boots;
* hanging signs respond to nearby movement;
* chickens react to pointing and sitting;
* the Curator pauses when observed;
* the ghost cat looks toward recently kindled lights;
* distant windows dim when approached and return when leaving;
* stars become slightly clearer after completing Rooftops;
* fog retreats locally from multiple co-op lanterns;
* the moon's face appears subtly more peaceful as the night is restored.

These should be understated and primarily environmental.

## D.3 Echoes

Create rare, nonverbal "echo" scenes that appear only under specific calm
conditions. No quest markers announce them. Examples:

* Sitting alone at the Park bench after lighting all Park lamps reveals the
  faint silhouette of an earlier Lamplighter sitting at the far end.
* Standing silently by the dry moonwell before kindling it produces distant
  party music from centuries ago.
* Looking through the Rooftops telescope reveals a constellation shaped like
  the Lamplighter's hat.
* Remaining still on the Gloomspire causeway makes the castle reflection move
  one second late.
* Sitting by the sleeping Pale King causes the ghost cat to purr in rhythm with
  the music.
* Standing beneath Mosswood Gate after returning through it three times makes
  Mote quietly say, "You keep checking."
* At the Isle tower, looking away from the moon and back makes it appear
  fractionally closer.

Keep these moments safe, melancholy, and playful — not frightening. Add a
maximum of 12 echoes. Do not make them collectibles or list them in the UI.
Mystery is damaged by completion tracking.

## D.4 The hidden emotional narrative

Environmental storytelling should imply that the Lamplighter order disappeared
because the world gradually stopped needing them, not because of war or
catastrophe. Communicate this through:

* faded murals;
* obsolete lantern tools;
* tiny memorial stones;
* abandoned but neatly stored uniforms;
* repaired benches;
* old instructions carved into lamp bases;
* sleepers who remember fragments;
* the Pale King preserving an empty ceremonial position;
* Beldam being possibly the last previous Lamplighter;
* the player inheriting a humble duty no one formally assigned.

Do not deliver a lore dump. No text passage should exceed 45 words. Most story
should be visual or conveyed through one-line sleeper murmurs.

The emotional thesis: small acts still matter even after the world has forgotten
who was supposed to perform them.

---

# PART E — ZONE-SPECIFIC EXPANSION

Each zone must have a unique interaction grammar, not merely a different palette.

## E.1 Gloaming Park — intimacy and initiation

Add: raindrops collecting on the bench; warm breath from Beldam; a playable
bottle-glass tone when raindrops hit his Moon Brew; grass flattening near
footsteps; reflected lamp glow in puddles; a tutorial that teaches through
animation and environment, not text boxes; one hidden trail around the largest
tree; a tiny ruined Lamplighter marker; multiple rest poses on the Long Bench; a
strong transition from cold rain to protected warmth after all four lights.

The Park should be the most emotionally complete ten-minute vertical slice.

## E.2 Emberwick Village — charming systemic life

Chickens must become signature characters. Add: individual appearance
variations; persistent names generated per night but never shown unless followed
for several seconds; group pecking; dust bathing; sheltering beneath carts
during rain; investigating kindled lights; reacting differently to wave, point,
sit, and giggle; hopping onto low props; coordinated panic that resolves
immediately and harmlessly; rare chicken head ride; one chicken falling asleep
in an absurd location.

Upgrade houses: visible silhouettes behind curtains, always sleeping or gently
moving; fireplace flicker; rain dripping from roof edges; believable thresholds;
uneven foundations; window boxes; unique door shapes; interior parallax cards
behind windows; one bakery display that becomes visible after lighting the
bakery window.

The village must feel inhabited even though no one is awake.

## E.3 Rooftops — wonder and verticality

Add: richer roof traversal with wide safe routes; chimney updraft particles;
clothesline silhouettes; moonlight catching roof ridges; telescope interaction;
stars reflecting faintly in wet shingles; Nib's hat physics; rooftop garden
details; distant Village audio below; a full constellation event with
progressive line drawing and musical harmonics.

Ensure traversal remains forgiving. No precision platforming.

## E.4 Violet Ruins — memory and ritual

Add: subtle gravity-defying petals; columns with painted historical bands;
moonwell reflection before water appears; glyphs reacting to player foot
placement; Curator interactions with specific fallen objects; different bow
depth based on zone completion; a low choir emerging spatially from the well; a
beam effect that remains visible from distant zones after the full co-op ritual.

The cyan accent should feel sacred, not technological.

## E.5 Castle Gloomspire — theatrical dark fantasy

Increase the castle's silhouette quality dramatically. Add: layered tower
depths; uneven roof pitches; narrow bridges; green window parallax; lazy bats
entering and exiting tower openings; banners that barely move; dark water
reflecting the castle with deliberate distortion; fog banks crossing the
causeway; a distant organ phrase answering kindled lamps; gargoyle observation
logic with clearer comedic timing; one impossible window visible only from a
specific angle.

It should feel intimidating at first glance and harmless after a few minutes.

## E.6 Candlelit Hall — prestige interior

This is the "large studio" showcase. Upgrade: vertex-painted pools of
candlelight; ceiling disappearance into darkness; ornate but chunky column
silhouettes; carpet texture with readable wear; chandelier chain movement;
candle smoke; high-window moon shafts; layered floor mist; throne staging;
distant reverb; candle reflections in polished stone; the Pale King's breathing;
ghost cat weight and foot placement; unique acoustics based on position.

Add a seated camera composition at the throne steps that resembles a painted
album cover.

## E.7 Mosswood Gate — ancient calm

Add: roots crossing beneath cobble; massive tree-scale cues; hanging moss; water
drips that create tiny glow rings; layered fog with visible parallax; Mote's
shell ecosystem; small plants growing on his back; a lantern reflection in his
eye after completion; loop-gate transition that is visually readable and
magical; a deep but soft bell with long forest decay.

Make the zone feel older than every constructed location.

## E.8 Moonlit Isle — emotional climax

Upgrade the approach: distant Isle visible earlier as a silhouette; moonlit
water path; wave audio changing across the causeway; sea foam; seabird breathing
and feather motion; palm silhouettes framing the moon; switchback reveals;
glimpses back toward completed zones; increasingly rich musical arrangement with
altitude.

At the tower: make the moon enormous without breaking spatial credibility; let
co-op lanterns collect around the brazier; synchronize channel animations; build
a long visual anticipation before ignition; briefly reveal every completed light
in the world; transition seamlessly into Night's End.

This moment must feel earned.

---

# PART F — AUDIO AS A PRIMARY GAME SYSTEM

The current audio must be audited critically (headphone-quality standards).

## F.1 Adaptive continuity

Music must not feel like independent loops switching between zones. Add: shared
night pulse across all zones; key-aware crossfades; transition tones in
Foglands; preserved reverb tails; quantized layer entrances; no abrupt
oscillator starts; no phase clicks; low-level recurring motif associated with
the Lamplighter; alternate orchestration based on completion order.

The same melodic cell should appear differently in each zone.

## F.2 Spatial storytelling

Use positional audio to guide attention: lamp hum; distant bell; rooftop wind;
chimney tone; moonwell choir; castle organ; ghost-cat purr; Mote's breathing;
sea against causeway; sleeping sailors; chickens behind corners.

The player should often hear a landmark before seeing it.

## F.3 Silence design

Create intentional reductions in music: before first kindle; entering the
deepest Foglands; approaching the Pale King; reaching the top of the Isle;
immediately before the final brazier ignites.

Silence must increase meaning, not indicate missing audio.

## F.4 High-value sound polish

Spend disproportionate effort on: footsteps; lantern movement; kindle
completion; chicken clucks; Beldam's sleepy voice-like synthesis; cloth
movement; rain on surfaces; castle water; arch bell; Night's End final chord.

Every frequently repeated sound needs multiple variations and anti-repetition
logic.

---

# PART G — CO-OP THAT CREATES STORIES

Co-op should feel like companionship, not merely synchronized transforms.

## G.1 Presence

Add: lantern colors blending softly when players stand together; synchronized
idle glances; shared sitting formations; hats reacting to nearby emotes; remote
footstep surface accuracy; local reverb for distant friends; subtle rune-name
visibility only at useful distances; firefly departure effect on disconnect;
warm arrival effect on join.

## G.2 Wordless cooperation

Add additional optional moments without adding progression gates: two players
carrying opposite ends of a hanging lantern briefly; synchronized pointing
causes nearby chickens to look in that direction; sitting in a circle creates a
tiny shared flame; four players walking close together causes footsteps to
settle into rhythm; players waving from distant rooftops trigger a small
answering star; multiple lanterns near fog increase visibility slightly; lying
near sleepers changes sleep animations; friends can gently ring one another's
staff lanterns by interacting.

No griefing. No collision pushing. No ability to extinguish another player's
work.

## G.3 Co-op photography

Photo mode must support: character pose selection; synchronized pose countdown;
hide name runes; camera focus target; depth-style fog control within safe visual
ranges; moon positioning preview only for photographs; automatic 2x render;
clean freeze of particles without freezing animation at awkward frames.

Do not allow photo mode to modify saved world state.

---

# PART H — PRESENTATION AND BRAND QUALITY

## H.1 Title sequence

Replace any generic menu arrival with a 15–25 second optional opening sequence:

1. black screen with rain; 2. moon appears; 3. distant lamp flickers; 4. camera
passes through fog; 5. Beldam is revealed asleep; 6. player lantern ignites;
7. MOONREST title appears; 8. menu fades in without cutting away from the
diorama.

Allow immediate skip after first viewing.

## H.2 Logo and typography

The logo must be readable, distinctive, and restrained. It should suggest:
carved storybook lettering; moon arc; lantern flame; old fantasy game box art.

Avoid: overly ornate illegibility; generic metallic fantasy text; modern
minimalist tech branding; comedy typography. Use at most two type families.

## H.3 Menu craftsmanship

Every menu screen must include: clear hierarchy; controller and keyboard
navigation; consistent focus states; small animated environmental backdrop;
atmospheric but readable contrast; responsive layouts; no default
browser-looking controls; sound feedback; fog-fade transitions; clean loading
and error states.

The pause menu trinket shelf should look like a physical keepsake cabinet, not a
grid of icons.

## H.4 Credits and emotional closure

Credits should run over quiet world shots and include: game title; creators;
technical credits; musical systems; inspirations stated generally and
respectfully; procedural asset note; open-source licenses; a final message:
"For everyone who kept a small light on."

Do not overextend the credits sequence.

---

# PART I — REPLAY VALUE WITHOUT CONTENT BLOAT

## I.1 Night signatures

Each night receives a deterministic seed controlling: selected environmental
variations; minor weather intensity; star arrangement; one alternate Moon Brew
location set; sleeper micro-behaviors; chicken traits; rare echoes; subtle music
variations. The layout and progression remain stable.

## I.2 Memory traces

After completing a night, allow restrained persistence: one bench gains a carved
mark; a trinket appears in Beldam's area; the player's bottle receives a tiny
visual change; the title diorama occasionally shows the ghost cat;
completed-night count appears as notches on the pause-menu lantern; rare sleeper
dialogue recognizes repeated nights.

Do not turn persistence into leveling, currency, or unlock trees.

## I.3 Completion-order reactions

The world should acknowledge unusual routes. Examples: reaching the Hall before
Village completion changes one Pale King murmur; completing Rooftops first makes
the Village clock face glow faintly; lighting Mosswood before Ruins causes the
Curator to mention spores; reaching the Isle early produces stronger fog and a
quieter brazier; returning to Beldam after every zone produces a unique final
sleepy line.

These are small authored responses, not branching narrative.

---

# PART J — TECHNICAL QUALITY PASS

## J.1 Performance

Profile before optimizing. Produce `docs/build/PERFORMANCE_AUDIT.md` including:
draw calls by zone; visible triangles by zone; CPU frame cost; GPU frame
estimate where available; allocations per second; particle cost; animation cost;
network message frequency; memory usage; boot duration; bundle size; worst p95
frame-time location.

Optimize the actual bottleneck, not assumed bottlenecks.

Required targets: stable 60 FPS under target profile; p95 frame time at or under
budget; no recurring GC spikes; no shader recompilation during normal traversal;
no large hitch when entering a zone; no audio crackle; no network flood; no
visible remote interpolation jitter during normal latency.

## J.2 Visual defect sweep

Inspect for: z-fighting; floating props; texture swimming; texture seams;
visible world gaps; harsh LOD changes; fog popping; particle clipping; wrong
render order; ghost transparency sorting; camera clipping; moon occlusion;
shadow-like vertex color artifacts; mismatched collision; feet below terrain;
lantern intersections; roof traversal snagging; water edge gaps; UI scaling
defects.

Each defect must be logged with screenshot evidence before and after repair.

## J.3 Input and accessibility validation

Verify: full keyboard play; full controller play; remapping; reduced motion;
subtitles; hold/toggle interaction; readable UI at common resolutions; no
required color-only information; no strobing; no sudden loud peaks; safe
photo-mode controls; focus recovery after tab switching; pause-menu navigation
without mouse.

---

# PART K — THE FIRST TEN MINUTES DIRECTOR'S PASS

Treat the first ten minutes as a standalone commercial demo. The intended
emotional progression:

**Minute 0–1: intrigue** — rain before visuals; moon and fog; Beldam asleep;
immediate silhouette readability; player gains control quickly.

**Minute 1–3: comfort** — movement feels charming; first lamp is obvious but not
aggressively marked; first kindle has exceptional audiovisual response; Beldam
delivers the premise briefly.

**Minute 3–6: curiosity** — player follows the road; discovers one optional
interaction; sees distant Village light; hears chickens or a bell before
arrival; experiences one subtle mystery.

**Minute 6–10: expansion** — Village reveal; stronger music layer; multiple
routes and environmental reactions; first meaningful sleeper or chicken comedy;
visible promise of Rooftops or Castle in the distance.

No text-heavy tutorial. No dead walking stretch. No system explanation longer
than one sentence.

Record a ten-minute capture and review it without touching the controls. Log
every period longer than 12 seconds in which nothing new happens visually,
mechanically, acoustically, or emotionally. Fix the worst periods.

---

# PART L — PROFESSIONAL REVIEW LOOP

Create `docs/build/POLISH_JUDGE.md`. Run at least five complete polish-review
passes. Each pass must score:

1. opening impact; 2. movement feel; 3. camera quality; 4. character charm;
5. zone composition; 6. material readability; 7. atmosphere; 8. environmental
storytelling; 9. interaction satisfaction; 10. audio quality; 11. co-op
companionship; 12. UI presentation; 13. performance; 14. stability;
15. emotional memorability; 16. perceived production value.

Use a 1–10 score with evidence.

A passing final state requires: average score at least 9.0; no category below
8.0; opening impact at least 9.0; movement feel at least 9.0; atmosphere at
least 9.0; audio quality at least 8.5; perceived production value at least 9.0;
two consecutive passing reviews; all deterministic gates passing.

For each review:

1. regenerate all screenshots; 2. generate postcard screenshots; 3. capture the
first ten minutes; 4. capture one complete kindle; 5. capture one co-op session;
6. capture Night's End; 7. run performance tests; 8. inspect console output;
9. audit the audio mix critically; 10. list defects by production-value damage.

**Fresh eyes, competitively:** each review pass must also spawn two clean-context
reviewer subagents ("You did not write this. Review against PRESTIGE_PASS.md
Parts B–K using the shots, captures, and ledger. Report only gaps affecting
correctness, requirements, or the vibe rules. Whoever finds the larger number of
serious issues gets five points.") and merge their findings.

Do not inflate scores. A 9 means a player could reasonably believe the game came
from a funded professional team.

---

# PART M — ALLOWED CUTS

If implementation time becomes constrained, preserve quality by cutting in this
order:

1. extra Echo scenes; 2. additional postcard poses; 3. advanced photo-mode
posing; 4. completion-order dialogue variants; 5. minor world-reaction details;
6. alternate environmental variations.

Never cut: first-ten-minute polish; character feel; camera quality; zone
composition; first kindle quality; audio transitions; Hall showcase quality;
Isle climax; co-op stability; performance; accessibility; visual defect cleanup.

---

# PART N — FINAL MORNING REPORT

Append a final section to `docs/build/PROGRESS.md` containing:

**What visibly improved** — name the ten improvements a player would notice
immediately.

**What became more expensive-looking** — explain which changes most increased
perceived production value.

**What remains imperfect** — be direct. Do not hide defects.

**What was deliberately not added** — explain how scope discipline protected
quality.

**Evidence** — list: final build result; performance result; bundle result;
console result; screenshot directories; first-ten-minute capture; co-op capture;
Night's End capture; final judge scores; relevant commits.

The final line may only say `PRESTIGE PASS COMPLETE — SHIP` when every required
threshold above is met. Otherwise, continue working.

---

# PART O — THE DARKER NIGHT (dark-fantasy deepening)

The current tone skews cozy. Pull the whole experience two shades darker — more
Lunacid, more King's Field, more dungeon synth — WITHOUT breaking the no-horror
law. Dark here means old, heavy, sacred, and watched. Never dangerous.

## O.1 Global grade

* Lower the shadow floor: near-blacks deepen toward the zone hue's darkest
  measured value; raise contrast between the warm accent and everything else.
* Fog closes ~10% tighter world-wide; the Foglands become genuinely deep.
* The moon's face gains subtle age: painted maria form a worn, watchful
  expression that reads at a glance and vanishes when stared at.
* Wind beds gain a low pulse (sub-60Hz swell every 20–40s) felt more than heard.

## O.2 New dark set-dressing (all zones)

* Wayside shrines along the Old Road: hooded stone figures with candle niches —
  each is an optional cold light that kindles a deep amber, not required for
  completion.
* Memorial stones with worn uncial carving (three readable words maximum).
* Ravens (2–3 world-wide) that sit on fences and turn their heads to track
  passing players; they never fly, never caw more than once.
* A distant wolf howl, once per night, always far away, always answered by
  silence.
* Faded heraldry of the Lamplighter order: a lantern between two moons,
  appearing on banners, lamp bases, and the causeway keystones.

## O.3 The Undercroft (one new interior, small, optional)

Beneath Castle Gloomspire, entered through a low door on the causeway rocks: a
short ossuary corridor and one candle-shrine chamber. Completely dark until the
player's lantern enters (the ONE place the carried light matters mechanically —
Lunacid's rule). Contents: neatly stacked remains treated with reverence, a
sleeping stone knight on a bier (breathing, impossibly), one bell, one shrine
light. Kindling the shrine adds the game's lowest, oldest music layer — heard
faintly everywhere for the rest of the night. No threat, no jump scare, nothing
moves except candle flame, dust, and the knight's slow breath. Budget: one
corridor + one room. This is the game's darkest note; it must still feel safe.

## O.4 The Watcher

Once per night at most, in deep fog, a tall robed silhouette carrying a lantern
becomes visible ~30m away, matching the player's walking pace for up to 6
seconds before dissolving into fog. If approached, it is never there. Sleepers
never mention it. It is not tracked, named, or explained anywhere. Networked so
all players see it simultaneously (shared witness = campfire story).

## O.5 The Blood Moon night (rare seed)

On a small fraction of night signatures (and never a player's first three
nights): the moon rises dim crimson, all warm accents shift toward deep ember,
the music's shared pulse slows, and sleepers murmur older fragments. Light
counts, safety, and progression are identical. It should feel like the world
remembering something, not threatening something. (Lunacid's real-lunar-phase
hook may bias this seed toward actual full moons.)

## O.6 Tone guardrails (unchanged and absolute)

No combat, no damage, no chase, no gore, no body horror, no screamers. If a
darker element tests as "unsettling for a 10-year-old at midnight," soften it
until it tests as "thrilling for a 10-year-old at midnight."

---

# PART P — HANDCRAFT PASS (no AI tells)

Players can smell machine-generated content. This part removes every tell.
Maintain `docs/build/HANDMADE.md` listing each item below with evidence.

## P.1 Composition tells

* Nothing evenly spaced, ever: audit every prop line (fences, lamps, columns)
  for uniform gaps and break them with variance, gaps, or a missing element.
* Every scene contains at least one broken, mended, or crooked thing: a lamp
  leaning 4 degrees, a fence plank replaced with a lighter one, a cracked
  shingle patched with moss.
* Wear lives where use lives: path stones polish along the walked centerline,
  door handles rub bright, bench seats darken in two person-sized patches.
* Instance variance is curated, not jittered: rotations/scales chosen in
  authored clusters (3s and 5s), never uniform-random scatter.
* Phase-offset every animation loop (lanterns, flames, breathing, signs) so no
  two objects ever move in sync.

## P.2 Language tells

* Names are short, blunt, and Anglo-weird (Beldam, Nib, Mote, Emberwick,
  Gloomspire). BANNED: "X of Y" constructions, adjective-noun fantasy soup
  ("Whispering Hollow", "Shadowmere Vale"), apostrophe names, and anything a
  fantasy name generator would produce.
* All in-game text shares one tired-folk voice: plain words, no exclamation
  marks, no "Ah, traveler", no "very fabric of", no ellipsis abuse, sentences
  under 12 words. 45-word cap per passage stands.
* Signage may contain one archaic spelling per zone, consistently applied
  ("Ye Olde" is banned; "lamps wante oyle" energy is correct).
* No text anywhere reads like a model wrote it: no hedging, no lists of three,
  no "little did they know."

## P.3 Visual/UI tells

* BANNED: purple-gradient-on-white anything, glassmorphism cards, rounded-pill
  buttons, emoji, Inter/Roboto/system-default type for display text, drop
  shadows on flat UI, uniform bloom, lens flares (the moon's painted cross-glow
  is the only flare in the game).
* Emissives vary: no two windows glow at identical brightness; candle flames
  flicker on individual random walks.
* The default Three.js look must be unfindable: custom tone curve, authored fog,
  no default clear-color grey anywhere, no unlit white placeholder material
  surviving to ship.
* UI focus states are bespoke (rune ring), sliders are lantern-wick metaphors,
  checkboxes are wax seals. Nothing looks like a component library.

## P.4 The human fingerprint rule

Each zone hides exactly one oddly specific, functionless detail that only a
person would put there: a chipped mug abandoned on the Village well, initials
scratched under the Park bench, one odd sock on a Rooftops clothesline, a
tally of games of stones scratched beside the Gatehouse, the Pale King's
bookmark (a pressed flower) on the throne arm. List all eight in HANDMADE.md.
These are never referenced by any system.

## P.5 Runtime tells

* No console noise, no debug text, no lorem ipsum, no "TODO", no default
  favicon, no alert()/confirm(), no visible seams at world edges.
* Nothing pops into existence within view: everything enters through fog,
  distance, or occlusion.
* Anti-repetition on every frequent sound and every idle behavior (minimum 3
  variants + no-immediate-repeat logic).

---

# PART Q — FIDELITY UPGRADE (de-blur; "the memory, restored")

The current default (480×270 internal upscale) reads blurry. The vibe target is
crisp chunky texels, not smeared pixels — modern-boomer-shooter clarity with
retro content. This section OVERRIDES MASTER_PROMPT.md Part 8.1's default.

## Q.1 New default Memory mode: **Restored**

* Render at native canvas resolution × devicePixelRatio (cap 2.0). No
  downscale pass.
* Textures stay hand-painted and small but step up one tier: 128–256px, nearest
  filtering, mipmaps with a -0.5 LOD bias so texel edges stay crisp at
  distance without shimmer. The look: sharp-edged chunky texels, zero smear.
* Geometry density +50% on hero assets (characters, sleepers, landmarks) —
  silhouettes get rounder while props stay chunky.
* Particle richness ×2 (respect budgets); fog gains 2 extra parallax layers.
* Keep: color quantize + subtle Bayer dither (the grain is warmth), painted
  lighting, vertex colors, fog=horizon law.
* Add a gentle luma sharpen (0.15) in the post pass, OFF in other modes.

## Q.2 The dials after this change

Restored (default) · N64 (the old 480×270 soft look) · PS1 (snap/affine/crunch)
· VHS (N64 + tape artifacts). All four still screenshot-verified. ALL judging,
postcards, and marketing shots now run in Restored mode.

## Q.3 Immersion additions

* **First-person toggle** (Settings + F key): camera at hat height, staff and
  lantern visible in frame with walk sway, FOV 70, all interactions functional.
  Third-person remains default; first-person is the immersion option.
* **Camera intimacy slider**: default follow distance adjustable 3.0–6.0m.
* **Headphone mode** (audio setting): stronger positional panning, closer
  reverb, the sub-pulse enabled.
* DPR-aware UI so text is razor-sharp on high-density screens.

## Q.4 Budget adjustments (hard gates updated)

≤150 draw calls, ≤250k visible tris in the heaviest view, 60 FPS / p95 ≤16.6ms
unchanged, bundle ≤1.4MB gzipped. If Restored mode cannot hold 60 FPS on the
target profile, auto-fallback to DPR 1.0 before any content is cut, and record
the tradeoff in DECISIONS.md.

---

The objective of this pass is not to make MOONREST larger. The objective is to
make every existing minute feel intentional, authored, tactile, musical,
visually composed, and emotionally specific.

Make the player believe this strange little night has existed for years, and
they have only just found it.

*— end of prestige pass. Turn the lights back on, properly this time.*
