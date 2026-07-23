# VIBE BIBLE — Retro Dark-Fantasy Ambience Remake

Deep-research design document for remaking the @ashenmoon89-style ambient game world.
Pillars: **World of Warcraft · Wizard101 · Lunacid · The Legend of Zelda: Majora's Mask ·
The Elder Scrolls V: Skyrim** — dark fantasy, "geeked wizard" energy, comfy dread.

> Hex values marked **[measured]** were extracted programmatically from the reference
> videos. Values marked **[approx]** are designer approximations from research, not
> data-mined game files.

---

## 1. What we're remaking

Two 20-second vertical (576x1024, 24fps) TikTok clips by **@ashenmoon89** — an anonymous
creator in the "fake retro game ambience" scene. Neither clip is footage of a real game:
they are ambient dioramas rendered in an N64-era style. No HUD, no player, no UI — each
clip is 4 scenes, ~4 seconds each, slow one-directional camera moves over static sets
with idle animation only (particles, mist, water shimmer, a breathing character).

The remake target is therefore not "clone a game" but **build the game these videos
pretend to be**: an explorable world with this exact mood.

### Video 1 — wilderness, sleeping creatures

| # | Scene | Contents | Dominant palette [measured] |
|---|-------|----------|------------------------------|
| 1 | Geeked wizard on the bench (~0–7s) | Bearded wizard/gnome in purple robe dozing on a park bench in a night forest, blue bottle in lap; rain begins; mossy teal ground, pixel-textured trees, fog | `#3d5865 #203b45 #221b1a #172730 #16161e #292a2c #5a8a7b #39404e` |
| 2 | Garden gnome on the roof (~7–8.5s) | Classic red-hat garden gnome asleep on a mossy roof beside a pine, deep cobalt starry sky | `#0406a0 #05013e #090766 #1d4635 #4f7460 #70a595 #2d172a #454c48` |
| 3 | Moonlit island keep (~8.5–12s) | Crenellated stone tower on a jungle cliff island, palm trees, shimmering sea, bright moon w/ cross glow | `#233638 #264651 #44637a #1d2847 #171a3c #88aebc #374c70 #22375c` |
| 4 | Violet elven ruins (~12–16s) | Broken vine-wrapped white columns, blue-tiled roofs, glowing cyan rune stone, purple flower meadow, magenta sky — WoW night-elf ruins coded | `#38343a #c888d2 #594c60 #8956a8 #50365b #322832 #593f6f #b56ec0` |

### Video 2 — WoW-architecture civilization at night

| # | Scene | Contents | Dominant palette [measured] |
|---|-------|----------|------------------------------|
| 1 | Night village (~0–5s) | Half-timbered WoW-human-town street (Goldshire energy), warm windows, lamp posts, chickens, indigo starry sky | `#111b19 #070913 #2907a6 #30383b #070367 #53605d #0e0a3d #26233e` |
| 2 | Green-lit haunted castle (~5–8.5s) | Multi-towered castle, every window glowing toxic green, purple nebula clouds, causeway over water, dark red door — Wizard101 Darkmoor / Scholomance energy | `#13111c #0d0a11 #23212f #4b14ac #6c4c5b #a9877c #1f1330 #53287c` |
| 3 | Throne hall (~8.5–11.5s) | Candle chandeliers, red ornate carpet + emerald runner, floor mist, stairs to a dark throne — Karazhan energy | `#18321f #781814 #17191e #15141c #271f20 #464c30 #8d8a55 #473628` |
| 4 | Foggy forest gate (~11.5–16.5s) | Massive mossy trees over a green-lit cobblestone path, hanging orange lanterns, stone arch, thick ground fog — Duskwood energy | `#315943 #15292a #244035 #111e1d #060c0c #19372a #0a1914 #508b66` |

### The formula (measured across all 8 scenes)

1. **One dominant hue family per scene** + near-black shadows. Never desaturated
   black-on-black; darkness is always a saturated cool color.
2. **Exactly one warm accent** per scene — window light, lantern, bottle, carpet,
   candle. Warmth is scarce, therefore precious.
3. **A particle or mist layer** — rain, stars, motes, ground fog, water shimmer.
4. **A slow one-directional camera move** (~4s per scene), usually along a
   cobblestone path (leading line in 5 of 8 scenes).
5. **Nobody is awake.** Characters sleep or are absent; lit windows imply life.
   Loneliness + coziness at once.

---

## 2. Pillar 1 — World of Warcraft (2004): the world kit

### Art-direction rules (sourced from Blizzard artists)

- **"Over-the-top, over-proportioned, and really colorful"** (Samwise Didier). Big
  shoulders, big hands, oversized props; comic exaggeration is house style.
- **Silhouette-first**: vanilla character meshes are ~1,000–2,500 tris (naked human
  ≈1,000; fully geared ≈6,000). Form lives in the silhouette, detail lives in the
  texture.
- **Hand-painted everything**: diffuse-only textures, mostly ≤256×256, no normal/spec
  maps. Lighting, AO and wear are *painted in* — the texture painter is the lighting
  artist. Consolidate high-frequency detail into low-frequency chunks (paint 2 chunky
  nails, not 4 small ones — Matt McDaid).
- **One-artist consistency** (Gary Platner): everything must look "like it was done by
  the same guy."
- **Timeless over cutting-edge** (Chris Robinson) — the reason 2004 art still reads
  beautifully in a 2026 TikTok.

### The killer mechanism: per-zone sky + fog scripting

Vanilla WoW's mood engine is the `Light.dbc` system: each zone is a sphere with
keyframed time-of-day colors — 5 sky gradient bands + a fog color, where **fog color =
horizon/background-mountain color**. Short draw distance therefore reads as atmosphere,
not limitation. Interiors (Ironforge, Undercity) are lit purely by baked per-vertex
colors (MOCV). Both tricks port directly to Three.js (see §8).

### The night-elf ruins kit (video 1 scene 4's DNA)

Dire Maul / Eldre'Thalas / Azshara: Highborne city ~12,000 years old, "ruins stand
strong because of an ancient crafting technique that bound arcane energy within the
stone." Motifs: broken fluted white-marble columns, verdigris-teal metal trim,
crescent-moon and owl iconography, moonwells, glowing arcane runes, purple crystals,
vines and roots splitting pavement, ghosts of the original owners. Mood: *"the party
ended 10,000 years ago."*

Palette [approx]: twilight purple `#2E2450 #4B3B6E`, horizon rose `#B586B0`, marble
`#D8D5CE #B8B2A6`, verdigris `#3E8E8B #56B3A9`, arcane violet `#8E3FD0 #B14FE0 #C77DFF`,
moonwell `#BFEAF5`, moss `#5B7442 #7A9457`, night-elf tree purple `#6E4A9E #9B6BC7`.

---

## 3. Pillar 2 — Wizard101 (2008): dark-but-friendly

KingsIsle's stated influences: Dragonlance, Discworld, Narnia, Dark Crystal "with a
more whimsical, comical flair." Mantra: **"big power comes in small packages."**

### How a kids' game does dark fantasy (the rulebook for our tone)

1. **Darkness is a place you visit from a bright hub, never the baseline** — Nightside
   hides behind a waterfall off the sunny Commons; Darkmoor sits at the end of the
   Spiral.
2. **Horror is affectionate pastiche** of the public-domain monster canon — the Darkmoor
   design team cites Dracula, Universal Monsters, Castlevania, Ravenloft. Reads as
   Halloween, not trauma.
3. **Monsters have jobs, manners, puns, and politics** (the Parliament of Night;
   card-suit noble houses; hunchbacked comic-relief professor Dworgyn).
4. **No black-black**: darkness is blue/violet, always punctured by saturated glows —
   moon, candles, ghost-green, spell colors.
5. **Melancholy is allowed, horror is resolved with warmth** (Malistaire's grief arc).
6. School color pairs code everything (Fire red/orange, Ice blue/white, Storm
   purple/yellow, Death black/white, etc.) — total palette discipline.

Nightside palette [approx]: indigo `#1B2440 #241B36`, pale moon `#DDE6F5`, ghost green
`#77E67A`, jack-o-lantern `#F49B2C`. Darkmoor: fog `#5A6273`, slate `#39415A`,
silhouette black `#14121C`, vampiric red `#7E1F2B`, ghost-fire cyan `#58D8C4`, candle
amber `#E8A13C`. Video 2's green-windowed castle is this exact recipe.

---

## 4. Pillar 3 — Lunacid (2023): the modern blueprint

The single most instructive pillar — a 2023 solo-dev game that already did "playable
version of this vibe," lineage-pure: inspired by **King's Field IV and Shadow Tower
Abyss** (pre-Souls FromSoftware); its prequel was literally built in FromSoftware's own
*Sword of Moonlight* King's Field construction kit.

- **Premise**: poison fog covers the earth; you descend the Great Well toward "the
  sleeping Old One." Fog is diegetic from frame one.
- **Rendering** (Unity): default look is "PS1 graphics **as they appear in memory**" —
  clean rasterization of PS1-style content — with **opt-in** crunch filters
  (true-to-PS1, VHS, Vaporwave). Pixelated tiling textures; "background details fade
  into simple silhouettes at a distance far too close for modern tastes" (PC Gamer);
  single-quad waterfalls sliding into flat water planes.
- **Lighting is gameplay**: darkest areas require carried light; glint colors are a
  navigation language (green = route, white = item).
- **The moon is systemic**: the Lunacy corruption stat tracks the *real-world lunar
  phase* (Demon's Souls world tendency × Bloodborne insight). The Moonlight Sword
  appears: "made of crystal surrounding liquid moonlight, this blade dispels darkness."
- **Tone divergence from FromSoft** (Kayin): "Lunacid only seeks to punish the
  careless"; the hub is full of "weird little blorbos who care about you." Exploration
  feels like "climbing through an abandoned old building." Melancholy + safety = our
  comfy dread, playable.
- **OST**: "a modern reflection of the golden age of **dungeon synth**" (official),
  spanning eerie ambient to drum &amp; bass, cohering into "a waking lucid dream."

Palette [approx]: lunar `#0a0a1e #1a1440 #4a3a78 #8f7fd4 #e8e4ff`, cyan glint
`#7fd4d4`, blood `#2a0508 #6b0f1a #a4161a`, poison `#3a4a2a #7a9a3a #9aa48a`, ethereal
teal/ice `#2a6f6f #bde0fe`. Rule: near-black base, 1–2 saturated accents per area,
light sources as focal points.

---

## 5. Pillar 4 — Majora's Mask (2000): melancholy apocalypse

- The dark tone came from one constraint: **"the moon was supposed to crash in three
  days"** (Koizumi) — a one-year dev deadline transmuted into cosmic dread. Artist
  Takaya Imamura (who designed the moon's face) wanted out of "luminous and colorful"
  Nintendo style, citing Todd McFarlane's *Spawn* for high-contrast shadow.
- **The moon is UI**: visible from nearly everywhere, physically descending across the
  72-hour loop. Final Day sky on N64 is **sickly green**. At noon of the Final Day the
  clock becomes a 6-hour countdown; earthquakes; bells toll.
- **Fog is semantic, not just technical**: MM requires the Expansion Pak (8MB) so long
  sightlines exist *specifically so the moon can always be seen* — fog then appears
  only as weather and dread (Snowhead blizzard, Woodfall murk, Ikana gloom).
- **Region palettes**: Clock Town warm carnival (festivity as denial) → Woodfall poison
  violet/brown → Snowhead lifeless grey-white → Great Bay murky teal → Ikana somber
  autumn gold-brown ("perpetual twilight… moans of undead").
- **Music as clock**: Clock Town's theme accelerates each day; the last 6 hours get
  "Final Hours" — "a slow, mournful melody… no urgency… the sound of resignation."
  Song of Healing: "accepting that change is heartbreaking, but necessary."

[approx] Final-Hours green sky `#8fae6b→#3f4f2f`, Ikana autumn `#a67c3d #6e4a1f
#c9a227 #3d2b1f`, Snowhead `#c9d6df #8fa3ad #5c6b73`, Woodfall `#4a3f6b #5f7346
#7d5ba6`, night purples `#131862 #2e4482 #546bab`.

---

## 6. Pillar 5 — Skyrim (2011): cozy dread at scale

- Art direction (Matt Carofano): **"less Renn-fest and more biker bar"** — grounded
  Nordic dark fantasy; film references *Dragonslayer* (1981) and *Reign of Fire*
  (2002) for "realism and grittiness." A deliberately "lonely, wintry world."
- **Palette philosophy**: muted, desaturated, cold — greys, slate blues, birch whites,
  dead-grass gold — so firelight and magical glows are the *only* saturated accents.
  This is the mechanical basis of "cozy": warmth is scarce, therefore precious.
- Night motifs: random **auroras** (teal/green, violet variants) over two moons;
  **standing stones** with cyan constellation glows; black-roofed barrows; valley fog
  and god rays. (The rune stone in video 1 scene 4 is as much Skyrim standing-stone as
  WoW.)
- Audio (Jeremy Soule): "a companion to the player." Exploration cues = **layered
  ostinatos, "ever changing yet ever the same"**, open-ended harmonic phrases that
  never resolve (the dread residue), heavy reverb. Disc 4 of the OST is 42+ min of
  beatless "Skyrim Atmospheres" — the ancestor of the 10-hour ambience video.

Night palette [approx]: zenith `#0B1626`, horizon `#1E3A5F`, cloud `#3E5570`, aurora
teal `#35D0C0` / green `#4EF0A0` / violet `#7A5FD0`, moonlit stone `#8A919B`, snow
`#AEBFD4`, firelight `#FFB45E #D98E3A`. Winterhold community palette: `#E6ECEC #B0B0B2
#54605E #77909F #A4B4BB`.

---

## 7. The internet aesthetic this lives in

- **Fake retro game ambience**: short looping "footage of a game that never existed" —
  Blender scenes + PSX/N64 shaders + ambient audio + second-person nostalgia captions.
  The product is a **memory of a game no one ever played** (anemoia — nostalgia for a
  time you never experienced). Documented creators: Hoolopee, 98DEMAKE; @ashenmoon89
  is an anonymous small creator in this scene (unverifiable identity — itself typical).
- **Wizardposting / the geeked wizard**: traced meme lineage — "Pondering My Orb"
  (2021) → David B. Mattingly wizard-art captioning → TikTok wizards "smoking za"
  (2022) → "Shadow Wizard Money Gang." "Geeked" = high/euphoric. Video 1's wizard with
  his bottle on the bench IS this meme rendered as a diorama. Wizardcore canonical
  palette: black, grey, brown, dark red, purple, navy, green.
- **Dreamcore / weirdcore**: soft nostalgic-surreal vs. uncanny-disorienting; both
  built on liminal spaces (familiar places, empty of people). Our scenes are liminal
  by rule 5 (nobody's awake).
- **HauntedPS1**: the low-res horror dev collective (Demo Discs since 2020) — the
  style council for retro-shader conventions. Doctrine: fog and missing polygons
  outsource the imagery to the player's imagination — *limitation as atmosphere*.
- **Comfy dread**: the shared emotional core — a safe vantage point onto something
  vast, old, and indifferent. A campfire with the dark pressing in.

### Music direction: dungeon synth

Lo-fi fantasy synth born as ambient side projects of the early-90s black-metal scene
(Mortiis, Burzum's *Dauði Baldrs*); revived on Bandcamp in the 2010s (Erang, Fief,
Thangorodrim). "The sound of the ancient crypt… primitive, necro, lo-fi, forgotten."
It is **fantasy-game music made outside any game — the title screen of a dungeon that
doesn't exist** — which is why it pairs perfectly with fake-game ambience. Subgenres:
**winter synth** (the Skyrim-adjacent one) and **comfy synth** (Fief, Hole Dweller —
comfy dread as a genre). Lunacid's OST is officially dungeon synth; Soule's ostinato
principle ("ever changing yet ever the same") is the same loop philosophy. Tape hiss =
the audio version of the pixelation filter.

---

## 8. Rendering cookbook (how to build the look)

### N64 vs PS1 fingerprint — know which crunch you're making

| | PS1 — "sharp but unstable" | N64 — "stable but soft" |
|---|---|---|
| Texture sampling | Nearest-neighbor only (crunchy) | 3-point bilinear (diagonal smear) |
| Texture size | Relatively larger possible | ~32–64px (4KB TMEM) — blurry by design |
| Geometry | Vertex snapping wobble, affine texture warp | Perspective-correct, subpixel-stable |
| Depth | No z-buffer (sort popping) | Per-pixel z-buffer |
| Edges | Hard, jagged | Hardware edge AA (soft silhouettes) |
| Color | 15-bit + aggressive ordered dither | 16/32-bit + subtle dither |

The reference videos are mostly **N64-mode** (stable geometry, chunky-but-filtered
textures) with modern "clean rasterization" à la Lunacid's default look. Recommended:
author N64-style content, make artifacts **opt-in dials** (Lunacid's pattern).

### The recipe (Three.js, fits this repo's React/Vite stack)

1. **Low internal resolution**: render to a ~480×270 target, upscale nearest-neighbor.
2. **Tiny textures**: 32–128px, `NearestFilter` (PS1 crunch) or 3-point filter shader
   (N64 smear; GLSL ports exist, CC0, from GLideN64).
3. **Vertex lighting / baked vertex colors**: `MeshLambertMaterial`-class shading or
   vertex-color-only unlit materials (the WoW MOCV interior trick).
4. **Fog = horizon**: `THREE.Fog` with **fog color equal to sky-horizon color** per
   scene (the Light.dbc trick). Short far plane; background silhouettes fade in close.
5. **Per-scene palette scripting**: a small JSON "Light.dbc" of our own — each scene
   defines sky gradient stops, fog color, ambient tint, accent color.
6. **Particles**: point sprites for rain/stars/motes; scrolling-UV single quads for
   waterfalls/water shimmer (the Lunacid waterfall).
7. **Optional crunch dials** (post pass): color quantize `floor(c*(n-1)+0.5)/(n-1)` +
   4×4 Bayer dither; optional vertex snap `floor(grid*ndc.xy)/grid` and affine UV
   (`uv*w` then `/w`) for PS1 mode; CRT/VHS overlay last.
8. **Camera**: slow dolly/orbit rigs per scene, ~0.5 m/s, one direction, looped.

Reference implementations: Roman Liutikov "PS1 style graphics in Three.js" (patches
`project_vertex`), Codrops PS1 jitter shader (R3F), Maxime Heckel "The Art of
Dithering and Retro Shading for the Web," MenacingMecha's godot-n64-shader-demo (MIT)
for the N64 feature list, danielilett's Retro Shaders Pro articles for parameter
ranges.

---

## 9. What the remake becomes

**Phase 1 — The Ambience (faithful remake).** 8 explorable dioramas from §1, first
person, walk-only, one warm accent each, dungeon-synth loop per scene. This is the
videos, playable. (Scene 1: you can sit on the bench next to the wizard.)

**Phase 2 — The Night Walk (a game emerges).** Connect the dioramas with cobblestone
paths through fog (the leading-line motif). One mechanic: **light** — carry a lantern;
lighting a scene's warm accent (window, lantern, candelabra) "completes" it (Lunacid's
light-as-gameplay + W101's darkness-you-visit). The moon slowly descends all session
(MM's clock); finishing before moonset is the soft win state.

**Phase 3 — The Geeked Wizard (tone lock).** NPCs are sleeping mythic beings — the
wizard, the gnome — who half-wake and mumble one line each (W101 rule: monsters have
manners; Lunacid rule: blorbos who care). No combat, no fail state. Comfy dread only.

### Legal guardrails

- Style is imitable; **assets are not**. Scene 4 of video 1 and most of video 2
  imitate (or possibly rip) WoW/Wizard101 architecture — we model *original* assets in
  the documented style language, never extract game files.
- @ashenmoon89's clips guide mood; we don't reproduce their footage frame-for-frame.
- Named palettes/quotes here are cited research; hex approximations are our own.

---

## 10. Sources (abridged)

Full source lists live in the research notes. Key primary references:

- Blizzard art: Samwise Didier (GamingTrend), Matt McDaid six pillars (80.lv), Gary
  Platner (Wowhead), wowdev.wiki (`WMO/MOCV`, `DB/Light`, `BLP`, ADT), GDC Vault
  "The Universe of World of Warcraft."
- KingsIsle: Todd Coleman (Engadget/Massively 2008), Darkmoor design blog
  (kingsisleblog 2014), official Darkmoor world site, Wizard101 Central wiki.
- Lunacid: Steam, RPGFan review, RPG Spain Kira interview, kayin.moe essay, PC Gamer
  (Kerry Brunskill), VGMdb.
- Majora's Mask: fullfrontal.moe Imamura interview, Iwata Asks (MM3D), Zelda Universe
  region-atmosphere feature, Zelda Wiki "Final Day," NintendoLife music soapbox,
  Copetti N64 architecture, RetroReversing RDP.
- Skyrim: Inverse Carofano interview (2025), Game Informer "Art of Skyrim" (2011),
  Skyrim soundtrack (Wikipedia), USU ostinato analysis, UESP.
- Scene/music: sabukaru "Artificial Nostalgia," AV Club demake feature, Know Your Meme
  (wizardposting, geeked, Potion Seller), Wikipedia (Weirdcore, Haunted PS1, Dungeon
  synth, Mallsoft), dungeon-synth.neocities.org.
- Shader recipes: david-colson.com PS1 renderer, danielilett.com retro shader series,
  romanliutikov.com Three.js PS1, tympanus.net Codrops R3F jitter, maximeheckel.com
  dithering, godotshaders.com 3-point filtering, MenacingMecha godot-n64-shader-demo.
