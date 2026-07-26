# MOONREST: ASCENSION — the 10/10 visual, scale & progression overhaul

> **How to use:** paste into a Claude Code session on this repo (auto permission
> mode), or say "read docs/ASCENSION_PASS.md and execute it." Then:
>
> ```
> /goal every ASC- entry in docs/build/features.json passes with evidence,
> docs/build/ASCENSION_JUDGE.md shows two consecutive passing reviews with
> visual-fidelity >= 9.5 and scale-awe >= 9.0 and no category < 8.5, all
> performance gates pass at High preset, npm run build exits 0, and
> docs/build/PROGRESS.md ends with "ASCENSION COMPLETE — SHIP" — or stop
> after 500 turns
> ```
>
> **This document supersedes MASTER_PROMPT.md and PRESTIGE_PASS.md wherever
> they conflict.** Read Part 2 first — it repeals the constraints that are
> currently capping visual quality. The harness rules (state files, work cycle,
> evidence gates, do-not-stop, escape hatches) survive unchanged.
> Ledger prefix `ASC-`. Judge file `docs/build/ASCENSION_JUDGE.md`.

---

# PART 0 — PLAYTEST BLOCKERS (fix before all Part 3+ work)

Second playtest, three blockers reported, all confirmed in screenshots. These
outrank everything else in this document: a beautiful world you fall through
and cannot navigate is not shippable. Ledger prefix `ASC-B`.

What is now working and must not regress: the moon renders large with bloom,
the lantern casts warm light, the village architecture and lit windows read
well, cobblestone and half-timbering look good.

## 0.1 BLOCKER — the player phases through walls; the camera clips inside geometry

Evidence: a playtest screenshot shows the camera *inside* a rooftop, looking at
the underside of roof faces, with the player's hat protruding through the roof.
Reported: "sometimes I phase thru walls."

Fix, in this order:

1. **Continuous (swept) collision, not discrete.** Capsule-cast from the
   previous position to the intended position every frame; resolve at first
   hit; slide along the surface tangent. Never assign a transform without a
   sweep. Fast movement through thin walls is textbook tunneling and will get
   worse when Part 0.2 raises speeds.
2. **Sub-stepping.** If a frame's movement exceeds 0.4 x capsule radius, split
   it into sub-steps.
3. **Collider audit.** Every renderable surface the player can reach needs
   registered collision geometry, built into a per-zone BVH at load. Log any
   mesh over 1m that ships without a collider; the list must be empty.
4. **Camera collision.** Spherecast (radius 0.25m) from the player's head to
   the desired camera position; pull in to first hit minus 0.15m; 0.25s
   recovery ease; near plane <= 0.1. Interiors get a tighter minimum distance
   and ceiling awareness. The camera must never occupy solid geometry.
5. **World boundary.** An invisible, unclimbable boundary; the visible hard
   seam at the world edge (screenshot 1) must be hidden behind terrain, fog,
   or water so the edge of the world is never in frame.

Gate — `scripts/collisioncheck.mjs`: a bot charges every wall, cliff, prop,
door frame, and world edge in every zone from 8 angles at maximum speed, plus
a 5-minute random-walk fuzz per zone. Asserts zero penetrations, zero
out-of-bounds, and zero frames where the camera-to-player ray is obstructed.
Must pass 100%, and reruns after every movement or geometry change.

## 0.2 BLOCKER — movement is too slow

Reported: "ur to slow." Current speeds are realistic, which is exactly the
problem. New values:

- Walk (light analog input): 2.2 m/s.
- **Default run: 5.2 m/s** — what you get from simply pushing the stick, no
  button held. This is the speed the game is tuned around.
- Sprint (hold): 8.0 m/s, with +6 deg FOV, speed streaks in the fog, and the
  robe and beard streaming behind.
- Acceleration to full in 0.15s; deceleration 0.12s with a settle step.
- Jump apex 1.6m, coyote time 6 frames.
- **Glide moves to tier 0.** A limited hold-jump slow-fall is available from
  the first minute; the Mothwing upgrade extends it. Traversal joy must not be
  gated behind 8 lights.
- **Retune the whole ladder** (Part 7.1): tiers at 4 / 12 / 24 / 40 lights
  instead of 8 / 20 / 35 / 50.
- **Lantern fast-travel:** every kindled lantern becomes a waypoint. Hold
  interact on a kindled lantern to travel to any other, via a 2-second
  moth-cloud transition. This fixes slowness and backtracking at once, and it
  makes kindling feel like it pays you back.

Gate: crossing the Park end to end takes <= 25 seconds at default run speed.
Log measured crossing times for every zone in PERFORMANCE_AUDIT.md.

## 0.3 BLOCKER — no idea where to go

Reported: "its hard to know where to go to explore." Fix with layered diegetic
guidance, strongest first. No minimap, no quest markers, no arrows.

1. **Unkindled lights are visible from across the zone.** Every cold light
   carries a faint pulsing ember, readable at 80m, occluded by geometry but
   never lost to fog. You can literally see your objectives as dying embers
   scattered through the dark. This one change fixes most of the problem.
2. **Kindled lights become beacons** — warm bloom visible from far away, so
   the map reads at a glance as "lit" versus "still dark."
3. **The Lantern Listen** (new verb): hold L / LB and the lantern lifts,
   chimes, and a single wisp streaks away toward the nearest unkindled light,
   fading after 3 seconds. Unlimited uses, zero UI. This is the "I'm lost"
   button and it must feel like folklore, not like a quest marker.
4. **Landmarks** visible from each zone entrance and from at least two other
   zones (Part 5.2 scale delivers this).
5. **The path reads as the path** — cobblestone catches moonlight with a
   slight specular and albedo bias over the surrounding terrain, so the road
   is always legible even in deep fog.
6. **Fingerposts** at every fork, pictogram-first, readable at 15m.
7. **The dream fox** (Part 5.3) wanders toward regions you have not visited.

Gate: a fresh-context subagent, given only the control list and no other
documentation, must reach 3 different zones and kindle 5 lights within 10
minutes. Save the transcript to the judge file.

## 0.4 Also visible in these screenshots — fold into the Part 3/4 work

- **Untextured faces.** Large flat lavender planes appear on some walls and
  roofs: missing material or missing UVs. Audit every mesh builder; no face
  ships untextured or unlit.
- **Buildings float and intersect terrain badly.** Seat every structure into
  the heightfield with skirt geometry so nothing hovers or clips.
- **The world edge is visible** as a hard horizon seam. Hide it (0.1.5).
- **Ground level is still nearly empty** in the Park. Part 4.2 density is the
  fix and it is now urgent, not cosmetic.

Nothing in Parts 3 through 10 is marked done while any Part 0 gate is failing.

# PART 1 — THE VERDICT

The owner's judgment of the current build: **"the graphics are like a 2/10, I
need it to be a 10/10"** and **"it looks kinda boring."** Both are correct.
Diagnosis from the playtest screenshot, in order of damage:

1. **The ground is a flat green sheet.** No terrain height, no slope, no
   sculpting. A flat plane is the single loudest "amateur 3D" signal there is.
2. **Nothing is lit.** No shadows, no light falloff, no bloom, no specular, no
   ambient occlusion. Every object floats on the ground because nothing casts
   or receives. This is why it reads flat and cheap.
3. **No scale.** Everything is 1–4m tall and at the same distance. There is no
   landmark, no vertical, nothing enormous, no horizon event. The eye has
   nowhere to go.
4. **Density is near zero.** A dozen props scattered over a football field of
   empty grass. Real environments have thousands of elements.
5. **The moon is absent from frame** — the game's stated protagonist object.
6. **Nothing is alive.** No creatures, no wind, no swaying, no weather motion.
7. **Textures are mush** at 64px with no detail frequency.

None of this is a talent problem. It's a **specification** problem: the
original documents forbade realtime lights, forbade shadows, capped textures at
64–128px, and rendered at 480×270 in pursuit of N64 authenticity. Those rules
produced exactly what you'd expect. They are now repealed.

---

# PART 2 — THE REPEAL (read before touching anything)

## 2.1 CANCELLED — these rules no longer apply anywhere

| Old rule | Source | Status |
|---|---|---|
| "No realtime lights in the exterior world at all" | MASTER 8.2 | **CANCELLED** — see Part 3.1 |
| "No dynamic shadows" | MASTER 2 rule 8 | **CANCELLED** — moonlight casts real shadows |
| "Textures are tiny, 64–128px" | MASTER 2 rule 8 | **CANCELLED** — 512–2048px, see 3.5 |
| "Render at 480×270 and upscale" | MASTER 8.1 | **CANCELLED** — native res, already superseded |
| "MeshBasicMaterial-class, no PBR" | MASTER 8.2 | **CANCELLED** — custom stylized-PBR, see 3.4 |
| "≤120 draw calls / ≤150k tris" | MASTER 11 | **RAISED** — see Part 10 budgets |
| "Lo-fi is warmth / the N64 softness is the comfort blanket" | MASTER 2 rule 12 | **CANCELLED** — the new north star is *painterly and gorgeous*, not *degraded* |

The retro Memory dials (N64/PS1/VHS) survive **only** as optional novelty
filters in Settings. They are never the default, never used for judging,
screenshots, or marketing.

## 2.2 SURVIVING LAW — these are why the game still has a soul

- **The palettes** (MASTER 2.1, measured from the reference footage) — every
  zone keeps its measured hue family. Fidelity goes up; the color identity
  does not change.
- **One dominant hue + near-black + one warm accent per zone.**
- **Fog color equals horizon color** — now implemented as height fog with
  moon-direction inscattering (Part 3.3), which is the same idea done properly.
- **Silhouette-first design; chunky readable shapes.** We are not going
  realistic. We're going *painterly stylized at high fidelity* — the shapes
  stay bold and simple, the LIGHTING gets expensive.
- **Comfy dread, no horror, no combat in the waking world, nobody awake.**
- **Cobblestone paths as leading lines; authored composition (PRESTIGE B.1).**
- **Handcraft rules / no AI tells (PRESTIGE Part P).**
- **All assets still generated in code.** No downloaded models/textures/audio.
  (This is a hard constraint, not a style choice — and it is achievable at
  10/10: see Part 3.5 on procedural texture synthesis at 1024px.)

## 2.3 The new north star

**Reference tier — study these and match their lighting quality:** *Sable*,
*Journey*, *Sky: Children of the Light*, *RiME*, *The Pathless*, *Season*,
*Genshin Impact*'s stylized night lighting, *Kena*'s foliage.

**One-line target:** a hand-painted dark fantasy night that looks like a
modern stylized console game — bloom-soaked lanterns, moonlight raking through
volumetric fog, thousands of grass blades bending in wind, and something
enormous asleep on the horizon.

---

# PART 3 — THE RENDER PIPELINE (the 2→10 work)

Implement with three.js `EffectComposer`. Every item below is a `ASC-` ledger
entry with a before/after screenshot pair. Build them **in this order** — the
first four alone take the game from 2 to ~7.

## 3.1 Lighting rig (do this first)

- **Moonlight:** one `DirectionalLight`, cool color per zone (`#8fa8d8`-family),
  positioned from the moon's actual sky position so light direction and the
  visible moon always agree. **Cascaded shadow maps**: 3 cascades, 2048px each
  (High preset), PCF-soft, bias tuned to kill acne/peter-panning. Shadows are
  the single biggest grounding win — nothing may float again.
- **Ambient:** `HemisphereLight` with sky color = zone's sky band, ground color
  = zone's terrain hue, so everything picks up bounce automatically.
- **Lantern lights:** pooled `PointLight`s (8 on High, 4 on Medium, 0 on Low →
  emissive-only fallback), warm accent color, `distance` ~12m, `decay` 2,
  assigned by nearest-N to camera each frame. The player's lantern-staff always
  owns one. Kindled lights beyond the pool fall back to emissive + baked
  vertex warmth (the old system stays as the LOD tail).
- **Emissive everything:** windows, flames, runes, glints, creature eyes get
  emissive materials feeding the bloom pass.

## 3.2 Post-processing stack (in this exact order)

1. **Tone mapping:** `ACESFilmicToneMapping`, exposure tuned per zone
   (0.8–1.3), lerped on zone transitions.
2. **Selective bloom** (`UnrealBloomPass` on an emissive-only render layer):
   threshold ~0.7, strength 0.6–1.1 per zone, radius 0.5. Half-resolution.
   *This is the single most "expensive-looking" effect in the game* — lanterns,
   the moon, and runes must all bleed light.
3. **Volumetric light shafts:** radial-blur god rays from the moon and from
   strong lanterns through fog. Quarter-res, additive. Mandatory in Mosswood,
   the Hall, and the Foglands.
4. **GTAO/SSAO:** half-res, subtle (intensity ~0.6). Grounds props into
   terrain; the difference is enormous and mostly subconscious.
5. **Depth of field:** gentle bokeh, focus on the player, strong only in photo
   mode and postcard shots.
6. **Color grading:** per-zone 3D LUT generated in code from the measured
   palette (this is how the palettes finally *sing*), plus lift/gamma/gain.
7. **Atmospherics:** vignette (0.2), fine film grain (0.03), chromatic
   aberration at frame edges only (0.15), all subtle.
8. **Anti-aliasing:** SMAA (or TAA if temporal stability holds).

Every effect gets a Settings toggle and a quality-preset default.

## 3.3 Fog, done properly

Replace linear fog with **exponential height fog with inscattering**: density
falls off with altitude (so valleys pool with mist and peaks stay clear), and
fog color blends toward the moon color when looking toward the moon —
so the air itself glows silver on the moon side and stays deep blue away from
it. Add 3–5 layered animated fog card planes at different depths for parallax.
The horizon rule survives: fog color at eye height must equal the sky's
horizon band.

## 3.4 Materials — stylized, not photoreal

One shared shader family, all vertex-color-aware:
- Half-Lambert diffuse (soft wraparound, no harsh terminator) + optional
  2-band toon ramp per material.
- **Rim light** keyed to moon direction — this is what makes stylized night
  scenes read; every character and creature gets it.
- **Fake foliage translucency:** leaves backlit by the moon glow at the edges.
- **Wetness:** cobble/stone in rain zones get a specular lobe + darkened albedo
  + puddle mask; puddles reflect the moon (cheap planar or cubemap).
- **Triplanar blending** on terrain and cliffs so textures never stretch.

## 3.5 Textures — procedural at real resolution

Still generated in code, but grown up: **512–2048px**, multi-octave
(large forms → mid detail → fine grain), painted value structure and AO baked
in, plus generated **normal maps** (derived from height via Sobel) so surfaces
catch moonlight. Mipmaps + anisotropy 8. Texture memory budget: 256MB.
Detail-frequency rule: every material must read correctly at 0.5m, 5m, and 50m.

## 3.6 Sky & the moon

- Sky dome: 5-band gradient (kept) + **layered scrolling cloud planes** (3,
  parallax, alpha-tested, lit by the moon so their edges glow) + starfield with
  twinkle + Milky-Way band.
- **THE MOON:** a real sphere, 1024px procedurally cratered surface with a
  subtle painted face, normal-mapped, occupying **8–15° of the sky** (roughly
  10× a real moon) and up to 35° at the Isle climax. Bloom halo, cross-flare,
  phase from the real lunar cycle. Never fogged. It must be the first thing a
  new player notices.
- **Aurora** (rare seeds + late escalation stages): flowing ribbon shader,
  teal→violet, reflected in water.

## 3.7 Water

Planar-reflection (or SSR-lite) water: animated normal scroll, depth-based
color ramp, foam lines at intersections, moon-streak specular aimed at the
real moon azimuth, subtle vertex swell. The Isle and Gloomspire causeway
become postcard shots because of it.

---

# PART 4 — TERRAIN & DENSITY (the "boring" fix)

## 4.1 Real terrain

Replace flat planes with **sculpted heightfields** per zone: ridges, hollows,
banks, cliff faces, sunken paths. Rules:
- The path is *cut into* the land — banks rise on either side, framing views.
- Every zone has at least 12m of vertical relief and one overlook that reveals
  the next zone.
- Slope-based auto-texturing (grass on flat, rock on steep) with triplanar.
- Terrain LOD by distance; collision from the same heightfield.

## 4.2 Density pass — the numbers are the point

Per zone, instanced (`InstancedMesh`, LOD rings, frustum + distance culled):
- **Grass:** 40,000–80,000 blades within 30m, wind-animated, moon-rim-lit.
- **Ground clutter:** 2,000+ (pebbles, twigs, fallen leaves, roots, bones).
- **Flowers/mushrooms:** 1,500+, the glowing ones emissive (Part 5.4).
- **Foliage:** trees get 3–5 alpha-card canopy layers + trunk detail; 200+
  trees per forest zone with 4 LODs; understory bushes and ferns.
- **Props:** 150+ hand-placed per zone in authored clusters (PRESTIGE B.1).
- **Distant silhouette layer:** parallax cards of the next zone's landmarks.

Acceptance: no screenshot may contain a screen-quarter of undifferentiated
ground (this gate already exists as PRESTIGE AA.4 — now it must pass at this
new density standard).

## 4.3 Wind & motion system

One global wind (direction + gust noise) drives a vertex-shader sway on grass,
foliage, cloth, banners, lanterns, hanging signs, and creature fur. Gusts
travel visibly across fields as waves. Nothing in the world is ever perfectly
still, and nothing moves in sync.

---

# PART 5 — SCALE & MONSTERS (the awe layer)

The owner asked for **scale — monsters and moon**. Deliver both.

## 5.1 The Slumbering (giant creatures as landscape)

Six colossal sleeping beings, each 40–200m, each visible from multiple zones.
They are terrain: you walk on them, their breathing moves the ground under
you, moss and trees grow on their backs.

1. **Mote the Elder** (Mosswood, 60m) — the tortoise you already know is a
   *baby*. His parent is the hill the gate stands on. Kindling the gate makes
   the whole hill breathe once.
2. **The Antlered Sleeper** (Gloaming Park, 45m) — what you thought was a
   dead tree line is a colossal stag lying on its side; its antlers are the
   forest canopy. Lanterns hang from them.
3. **The Drowned Choir** (Isle, 120m) — a leviathan's ribcage arcs out of the
   sea; the "castle tower" stands inside it. It hums the bass note of the
   Isle's music.
4. **The Kneeling Giant** (Gloomspire) — the castle is built on a giant's
   shoulders. Its lowered head is the gatehouse. Its eye opens once per night
   and closes. Nothing else happens. That's the whole point.
5. **The Moth Mother** (Violet Ruins, 80m wingspan) — perched over the ruins,
   wings folded like cathedral vaults, dusting the meadow with glowing scales.
   Full ruins completion makes her shift her wings ONCE, releasing a
   sky-filling cloud of light-moths. Best moment in the game.
6. **The Long Sleeper** (visible from everywhere, ~200m, never reachable) — a
   dragon-scale ridge on the far horizon that is unmistakably breathing.
   Never explained, never approached, always there.

Rules: none are hostile, none are combat, all are safe. Awe only. Each is a
`ASC-` entry with a wide-shot screenshot proving scale against the player.

## 5.2 Megastructure scale

Where the reference footage has a tower, we build a **150m** tower. Gloomspire's
towers triple. The Hall's ceiling vanishes into darkness 40m up. The Isle
switchbacks climb 90m. Every zone gets one "look up" moment and one "look
down" moment.

## 5.3 The bestiary (small creatures, everywhere)

The world must be *alive*. 12+ ambient creature types, all harmless, all
reactive, all procedurally built:
- **Lanternflies** — swarms that orbit kindled lights and follow players.
- **Moss hares** — bolt when approached, watch from a distance, come back.
- **Sky rays** — manta silhouettes drifting through the upper fog, seen from
  the Rooftops and Isle.
- **Hollowbirds** — long-legged waders in the shallows, heads under wings.
- **Grave moths** — big, slow, pale; they land on your hat and stay.
- **Stone snails** — carrying tiny ruins on their shells; move 1cm/minute.
- **Wisp shoals** — schooling lights that part around you.
- **The dream fox** — appears once per night, at distance, watching; leaves
  glowing pawprints that fade in 30s. Following them leads somewhere good.
- Plus: bats, fish, beetles, crows, and the chickens (untouchable, sacred).

## 5.4 Bioluminescence (the escalating trip)

Glow is the game's escalation currency: mushroom rings, veined moss, floating
spores, glowing river channels, blossom trees that shed light petals,
creature eyes. Starts sparse and shy in Stage 1 and takes over the world by
Stage 5 (Part 6).

---

# PART 6 — THE ESCALATION (five stages of the night)

The world does not stay the same. As the lantern grows (Part 7), reality opens
up. Each stage is a **global visual regrade + content unlock**, and the
transition is an authored 8-second moment (the sky changes, the music adds a
tier, the world exhales).

| Stage | Trigger | The world becomes |
|---|---|---|
| **1 — The Quiet Night** | start | Exactly the reference footage: cozy, dark, teal-and-amber, believable. Glow is rare. Beautiful but grounded. |
| **2 — The Waking Air** | lantern tier 2 | Fog thickens and starts to glow; lanternflies appear; bioluminescent mushrooms bloom along paths; the moon grows visibly larger. |
| **3 — The Colors Beneath** | tier 3 | Aurora ignites; the ground veins with light; the Slumbering begin to shift and breathe visibly; the Unseen (wisps, tree faces, footprints) becomes visible to everyone, not just the geeked. |
| **4 — The Sky Opens** | tier 4 | The star field becomes a nebula; sky rays migrate overhead in numbers; floating islands and stone shards lift off the ground; gravity gets *opinions* (petals fall upward in places). |
| **5 — MOONREST** | final brazier | The moon fills a third of the sky and opens its eye. Every light you kindled all night ignites at once across the world. Color goes fully impossible — the psychedelic peak. Lasts 3 minutes, then the night resets. |

Guardrails: escalation never breaks readability (the player, paths, and
interactables stay clearly legible at every stage), never strobes, never
becomes horror. Stage 5 is euphoric, not overwhelming. Reduced-motion and
"calm visuals" settings cap escalation at Stage 3 with all content intact.

---

# PART 7 — PROGRESSION (a real reason to come back)

## 7.1 The Lantern (the spine)

Kindled lights feed your lantern. Tiers unlock **traversal**, which unlocks
**world**:

| Tier | Cost | Ability | Opens |
|---|---|---|---|
| 1 Ember | start | walk, small hop, kindle | the Park and the Old Road |
| 2 **Mothwing** | 8 lights | glide (hold jump: slow fall + air drift) | Rooftops, cliff ledges, the Isle's upper switchbacks |
| 3 **Emberstep** | 20 | dash (ground + air), breaks light-veils | the Undercroft, sealed doors, gap crossings |
| 4 **Moonpull** | 35 | grapple to moon-marked anchors; vertical traversal | the Slumbering's backs, the 150m towers, floating islands |
| 5 **Dreamwalk** | 50 | walk on the Unseen — light bridges, up walls briefly | the sky routes, the Long Sleeper's ridge (finally reachable) |

This makes the world a **light Metroidvania**: on night three you're flying
over places you trudged past on night one. That's the return hook.

## 7.2 Permanent meta (persists across nights)

- **Lantern tiers persist.** You never lose progress; each night starts with
  everything you earned (nights get *more* beautiful and *more* traversable).
- **The Codex** — an in-world sketchbook that auto-fills with drawings of
  creatures seen, Slumbering found, constellations drawn, and vistas
  photographed. It is the collection game. No percentages shown; it just
  gradually fills with beautiful pages.
- **Lantern customization** — glass colors, flame shapes, charms hung from the
  staff, hat and robe variants. Earned from Slumbering, trials, and Codex
  milestones. Visible to co-op friends. This is the cosmetic chase.
- **Zone attunements** — fully kindling a zone permanently changes it: the
  Village keeps its windows lit forever, the Ruins' moonwell never dries. The
  world visibly remembers you across sessions.
- **Nightly seeds** keep layout stable but vary weather, creature spawns,
  brew locations, echoes, and which Slumbering stirs.

## 7.3 The long goal

Reaching Stage 5 with all 8 zones attuned, all 6 Slumbering found, and the
Codex substantially full unlocks **the Dawn** — the one time the sun rises in
this game. It lasts ninety seconds, it is the most beautiful thing in the
build, and then the night returns forever. Never mentioned in any UI.

---

# PART 8 — PERFORMANCE (all of this must actually run)

## 8.1 Quality presets (auto-detected, user-overridable)

| | Low | Medium | High (target) | Ultra |
|---|---|---|---|---|
| Shadows | off | 1 cascade 1024 | 3× 2048 | 4× 2048 |
| Bloom | off | half-res | half-res | full-res |
| God rays | off | off | quarter-res | half-res |
| SSAO | off | off | half-res | half-res |
| Grass | 8k | 25k | 60k | 80k |
| Point lights | 0 | 4 | 8 | 12 |
| DPR cap | 1.0 | 1.0 | 1.5 | 2.0 |

## 8.2 Hard gates (High preset, mid-range 2020 laptop profile)

60 FPS, p95 ≤ 16.6ms in a scripted walk through the densest zone at Stage 4;
≤400 draw calls; ≤900k visible triangles; ≤256MB textures; no GC spikes; boot
to title ≤ 5s; bundle ≤ 2.5MB gzipped; zero console errors.

**Auto-degrade:** if measured FPS drops below 50 for 3 seconds, step the preset
down one and log it. Never let a beautiful frame ship at 30 FPS.

## 8.3 Required techniques

Instancing for all vegetation/clutter; 4-tier LODs on everything above 500
tris; frustum + occlusion culling; merged static geometry per material per
zone; object pooling for particles and lights; texture atlasing; post effects
at reduced resolution; shader compilation warmed at load (no runtime hitches).

---

# PART 9 — THE JUDGE (10/10 or it doesn't ship)

`docs/build/ASCENSION_JUDGE.md`, two consecutive passing reviews required.

**The 10/10 protocol** — each pass, for every zone:
1. Regenerate all zone shots + postcards at 1920×1080, High preset.
2. Regenerate one shot per escalation stage (5 per zone showcase).
3. **The side-by-side test:** place each screenshot beside a described
   reference frame from *Sable* / *Journey* / *Sky* / *Genshin* night scenes.
   Ask: *would a stranger scrolling past believe this is from a funded studio
   game?* Write the honest answer. This is the primary bar.
4. **The awe test:** for each zone, name the moment that makes a player stop
   walking. If there isn't one, that zone fails.

Scored 1–10 with evidence: (1) visual fidelity **≥9.5 required**, (2) scale
awe **≥9.0 required**, (3) lighting quality, (4) density/detail, (5) terrain
composition, (6) creature life, (7) escalation payoff, (8) progression pull,
(9) performance at High, (10) readability at every stage, (11) palette
fidelity to the measured references, (12) handcraft/no-AI-tells.
Ship requires: no category below 8.5, plus the two hard minimums above, plus
all deterministic gates, twice in a row. Plus the competitive fresh-eyes
reviewer subagents, as always.

---

# PART 10 — BUILD ORDER

Do not scatter effort. This order gets the biggest visible wins first:

1. **Lighting rig + shadows** (Part 3.1) — biggest single jump, do it today.
2. **Bloom + tone mapping + LUT grading** (3.2) — the "expensive" look.
3. **Terrain sculpting** (4.1) — kills the flat-sheet problem.
4. **Grass/clutter density + wind** (4.2, 4.3) — kills the empty problem.
5. **The moon at true scale + sky layers** (3.6).
6. **Height fog + god rays** (3.3, 3.2.3) — the atmosphere payoff.
7. **Textures at 512–2048 with normals** (3.5).
8. **Two Slumbering** (Antlered Sleeper, Long Sleeper) — proves scale early.
9. **Bestiary wave 1** (lanternflies, moss hares, grave moths, dream fox).
10. **Lantern tiers 2–3 + gated areas** (Part 7.1).
11. **Escalation stages 1–3** (Part 6).
12. Remaining Slumbering → water/reflections → SSAO/DOF → tiers 4–5 →
    stages 4–5 → Codex → cosmetics → the Dawn.

If time runs out, cut from the bottom of that list. **Never cut** items 1–7 —
they are the entire 2→10 delta.

Morning report per PRESTIGE Part N, plus a before/after screenshot pair for
every zone and the honest answer to the side-by-side test. Final line, only
when every threshold is met: `ASCENSION COMPLETE — SHIP`

---

*It was a diorama. Make it a place — one with something enormous asleep on the
horizon and a moon big enough to fall into.*
