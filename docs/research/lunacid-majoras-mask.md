# Raw research notes — Lunacid, Majora's Mask &amp; retro rendering recipes

Research date: 2026-07-23. Hex palettes are flagged as community-sourced or designer
approximations, not extracted game data.

---

## PART 1 — LUNACID (2023, KIRA LLC / Akuma Kira)

### 1.1 Identity and lineage (pre-Souls FromSoftware)

- First-person dungeon-crawler ARPG, released Oct 30 2023 (Windows) after Early Access
  from March 2022. Developer/publisher KIRA LLC; programmer/designer Akuma Kira (also
  Spooky's Jump Scare Mansion content and Lost in Vivo). Metacritic 82 critic / 8.8 user.
- Explicitly inspired by pre-Souls FromSoftware first-person dungeon crawlers. Kira (RPG
  Spain interview): main inspirations were **King's Field IV (The Ancient City) and
  Shadow Tower Abyss**; he pulls from "paintings/books/movies and games" per level theme.
- Grew out of the MIDNIGHT mode of Lost in Vivo; originally conceived "akin to a
  first-person Castlevania" until Kira encountered King's Field / Shadow Tower.
- Steam blurb: "a lost era of first-person ARPGs," citing King's Field's "meticulous
  design and dense dungeons."
- GDC 2025 interview with Akuma Kira &amp; composer Jarren Crist exists on YouTube.

Concrete borrowings (RPGFan review, kayin.moe essay, wikis):
- Slow deliberate first-person melee ("swipe, backstep, block"); charge-attack system
  replaces both KF's power gauge and Souls stamina — faster than the "slow and
  lumbering" originals.
- Spells learned by equipping rings — nod to FromSoftware's **Eternal Ring**.
- **Lunacy** meter: corruption/insight stat modeled on "world tendency in Demon's Souls,
  Humanity in Dark Souls, and Insight in Bloodborne" — accrual tied to the **real-life
  lunar cycle**.
- The **Moonlight Sword** appears (floor 50, Tower of Abyss): "Made of crystal
  surrounding liquid moonlight, this blade dispels darkness" — homage to the Moonlight
  Greatsword in every mainline King's Field.
- Starting area references Shadow Tower's opening; **Castle Le Fanu** echoes the Castle
  Layer of Shadow Tower Abyss; some plot beats reference Bloodborne.
- Interconnected dense dungeon world, hidden walls, "esoteric puzzles," 75+ weapons, 37
  spells, multiple endings, classes (thief, knight, cleric, vampire...).
- Prequel **Lunacid: Tears of the Moon** (April 2025) was built in **Sword of
  Moonlight**, FromSoftware's official 2000 King's Field construction kit.

Tone divergence (kayin.moe, "Lunacid is Unchained from its Inspiration"):
- "Lunacid is inspired by Fromsoft, but it is not a Fromsoft game... the goals are
  different." KF punishes curiosity; "Lunacid only seeks to punish the careless."
- Exploration feels like "climbing through an abandoned old building."
- Warmth against loneliness: hub Wing's Rest is full of "friends, weird little blorbos
  who care about you"; the ending is "more fitting in Undertale than anything Fromsoft
  would ever make." The moon serpent reads as escape rather than apocalypse.

### 1.2 Setting / story

- "The Great Beast arose from the sea and covered the earth in poison fog." Player is
  cast into the **Great Well**, descending toward "the sleeping Old One" / the Dreamer.
  The opening fog is diegetic.
- Areas: Wing's Rest (hub), Hollow Basin ("cracks of white light streaming from above"),
  The Fetid Mire (sewer/swamp), Sanguine Sea (blood-red sea in a foggy cavern), Accursed
  Tomb (requires carried light), Yosei Forest, Forbidden Archives (library), Castle Le
  Fanu (vampire castle), Laetus Chasm (melancholy cliffside, minimal combat), Sealed
  Ballroom, Boiling Grotto, Tower of Abyss (50 floors), Terminus Prison, Labyrinth of
  Ash, Grave of the Sleeper.
- Register: "dingy catacombs, haunted mausoleums, vampire castles, and fetid sewers,"
  while "lighter areas lean more on an ethereal and alien atmosphere" (RPGFan).

### 1.3 PS1-style rendering techniques

- Engine: **Unity 2020.3.4f1**. Modding API "Lunatic" on GitHub.
- PC Gamer (Kerry Brunskill): "a perfect example of how to do PS1 nostalgia right";
  "Lunacid's simple textures are heavily pixelated and often repeated, background
  details fade into simple silhouettes at a distance that's far too close for modern
  tastes, and wafer thin waterfalls endlessly slide their way into pancake-flat water."
  → Technique translation: low-res tiling nearest-neighbor textures; aggressively short
  fog/draw distance as composition; single-quad scrolling-UV waterfalls into flat water.
- RPGFan: default presentation is "3D PlayStation graphics **as they appear in
  memory**, without all the jagged edges and texture warping" — with optional filters:
  "a crunchier true-to-PS1 filter, a VHS-style filter, and a Vaporwave filter."
  Authenticity is opt-in via post stack.
- Lighting is gameplay: "making a light source required for the darkest areas"; glints
  color-coded (green = navigation, white = items).
- Mixed dimensionality (billboard glints/particles over 3D low-poly environments) —
  weakly sourced, verify against capture.
- Performance signature: 800p / 90 FPS / ~6h battery on Steam Deck OLED.

### 1.4 Lunacid palette (approximations)

- Moonlight/lunar core: near-black blue `#0a0a1e`, deep indigo `#1a1440`, violet
  `#4a3a78`, moonbeam lavender `#8f7fd4`, pale moon `#e8e4ff`, cyan glint `#7fd4d4`.
- Blood register: black-red `#2a0508`, dried blood `#6b0f1a`, arterial `#a4161a`, ember
  `#e5383b`.
- Sickly/poison register: bile green `#3a4a2a`, phosphor `#7a9a3a`, pale fog `#9aa48a`.
- Ethereal/alien register: teal `#2a6f6f`, ice `#bde0fe`, white light shafts `#f8f9fa`.
- Usage rule: near-black ambient base, 1–2 saturated hue accents per area, light
  sources as focal points and navigation language.

### 1.5 Mood / audio

- OST: "a modern reflection of the golden age of **dungeon synth**" (Steam OST page).
  Composers: Jarren Crist, Akuma Kira, ThorHighHeels, AsterVrisk, Jeffrey Nordin.
- Kira: "Dark Fantasy video game music is really unique"; dungeon synth "conveys the
  fantasy world really well."
- RPGFan: Kira contributes "somber melodies," Crist "house or drum &amp; bass,"
  ThorHighHeels "everything from lo-fi hip-hop to strings" — cohering into a whole.
- RPG Site: the soundtrack "really sells the vibes of the game as a waking lucid dream."

---

## PART 2 — THE LEGEND OF ZELDA: MAJORA'S MASK (2000, N64)

### 2.1 Art direction: melancholy apocalypse

- Origin of the dark tone (fullfrontal.moe interview, artist **Takaya Imamura**):
  Yamauchi demanded a Zelda sequel in one year; director **Yoshiaki Koizumi** "came up
  with the idea that the moon was supposed to crash in three days... just with that
  starting point, they naturally went into a darker direction."
- Imamura: "I really wanted to get out of the luminous and colorful atmosphere of Star
  Fox or F-Zero... I like playing with shadows and lightning." Cites Todd McFarlane's
  **Spawn** for the high-contrast shadow approach. Imamura designed the moon's face.
- Iwata Asks: the three-day loop came from Koizumi's "compact game world [played] over
  and over"; a week was too much to track NPC schedules. Aonuma had a nightmare of
  being chased by a Deku and "woke up screaming."
- Zelda Universe: "The relentless passage of time and our inability to stop it weigh
  heavily on Termina and its people, making every region feel different, not just in
  design, but in emotion."
- Neon Observatory: Termina is "a ghostly, strange world facing an apocalyptic fate,"
  "expressionistic imagery" likened to *The Cabinet of Dr. Caligari*; "lost people,
  wandering undead, and unfulfilled lives." Key NPC line: "There are some things that
  you can't change no matter how hard you try."

### 2.2 The moon, the sky, the clock

- The moon looms visibly from nearly everywhere and descends physically across the
  72-hour cycle; by the Final Day it fills the sky.
- **Final Day sky: sickly green in the N64 original** (3DS remake changed it to
  red/purple). At noon of the Final Day the HUD clock becomes a 6-hour countdown;
  earthquakes; bells toll.
- Night play is normalized (unlike most Zeldas); each region has distinct night moods.

### 2.3 Region palettes and mood

- **Clock Town**: warm carnival colors and ticking clocks — festivity as denial.
- **Termina Field**: open green ring; the danger is the sky itself — the moon's face
  over pastoral land is the core dissonance image.
- **Woodfall**: "overgrown swamp, shrouded in a murky bog... surrounded by toxic
  waters" — browns, purples, poison violet water.
- **Snowhead**: "the violent blizzard howls... even at midday, the sky remains a
  lifeless gray" — desaturated whites/grays/ice blues; fog as weather and dread.
- **Great Bay**: murky teal ocean, overcast horizon, polluted waters.
- **Ikana Canyon**: "barren landscape, perpetual twilight, and an eerie silence
  punctuated only by the moans of undead"; "somber, autumnal palette... golden-brown
  hues conflict with the rest of Termina's vibrancy."
- Approx hexes: COLOURlovers "Majora's Mask" community palette `#72fccb #f9f5b6
  #fd97ac #b271cf #4eaefa`; Final-Hours green sky `#8fae6b → #3f4f2f`; Ikana `#a67c3d
  #6e4a1f #c9a227 #3d2b1f`; Snowhead `#c9d6df #8fa3ad #5c6b73`; Woodfall `#4a3f6b
  #5f7346 #2f2a3d` + poison `#7d5ba6`; night purples `#131862 #2e4482 #546bab`.

### 2.4 Fog, draw distance, Expansion Pak

- MM is one of only two games **requiring** the 4MB Expansion Pak (8MB total RDRAM):
  "greater draw distances, more detailed textures, more characters on-screen."
- Design consequence: where OoT used heavy distance haze, MM chooses when fog appears —
  fog becomes semantic (Snowhead blizzard, swamp murk, Ikana gloom) rather than a
  hardware crutch. Long sightlines exist specifically so the moon can always be seen.

### 2.5 Audio identity

- **Clock Town theme** "gets faster and more frantic each day" — same melody,
  escalating tempo = mechanical anxiety.
- **Majora's Theme**: "a slow dirge, unsettling and tense, but with a core of melancholy."
- **Song of Healing**: "incredibly melancholy... a balm"; "accepting that change is
  heartbreaking, but necessary."
- **Elegy of Emptiness**: "funereal," delicate piano resolution.
- **Final Hours**: "a slow, mournful melody... no urgency... the sound of resignation...
  both beautiful and terrifying" — ambient bells, low drones, earthquake rumble.
- Overall: "ominous horns, cymbal clashes, weird dynamics, and dissonant noises"; the
  soundtrack as *kintsugi* — "broken and reassembled" (NintendoLife).

### 2.6 N64 technical characteristics

Hardware (Copetti, RetroReversing, Beyond3D):
- **RSP** (vector coprocessor, 4KB IMEM microcode): transform, projection, clipping,
  **per-vertex lighting**.
- **RDP** (fixed-function rasterizer): texturing, color combiner, blender. The blender
  applies "translucency, anti-aliasing, fog, dithering, and z-buffering" — fog, AA and
  dithering are hardware pipeline stages.
- **TMEM = 4KB** (halved by TLUT when palettized, halved again by mipmaps). Practical
  texture budget ≈ 32x32–64x64 — the cause of the N64's blurry soft-focus materials;
  devs leaned on Gouraud vertex colors with tiny/no textures (Super Mario 64 pattern).
- **3-point bilinear filtering**: interpolates 3 texels (triangular) instead of 4 —
  the characteristic diagonal-smeared filtering unique to N64.
- **Per-pixel z-buffer**, **coverage-based hardware edge AA**. AA + filtering + low res
  + composite video = the trademark N64 blur.
- Output 320x240 or 640x480; 16-bit color common, banding hidden by hardware dither.
- MM runs an upgraded OoT engine; Expansion Pak-mandated for draw distance/actor count.

**N64 look vs PS1 look — fingerprint:**
- PS1: **affine texture warping** (no perspective correction), **no z-buffer** (painter's
  algorithm, sort pop-through), **integer vertex coords** (vertex snapping wobble),
  **nearest-neighbor sampling only**, 15-bit color + aggressive ordered dithering,
  Gouraud vertex lighting, hard edges. Textures could be relatively larger/sharper.
- N64: perspective-correct + z-buffered + subpixel-accurate (no warp, no wobble),
  **3-point filtered blurry tiny textures**, hardware edge AA, hardware fog, hardware
  dither, heavy vertex-color Gouraud.
- One-liners: PS1 = "sharp but unstable." N64 = "stable but soft."

---

## PART 3 — MODERN RECREATION RECIPES (engine-agnostic)

### 3.1 Core PS1 recipe

1. **Low internal render resolution**: 320x240 (or 426x240 / 480x270 for 16:9), upscale
   nearest-neighbor.
2. **Vertex snapping** (the wobble) — clip-space snap to a virtual pixel grid (David
   Colson):
   ```glsl
   vec2 grid = targetResolution.xy * 0.5;
   vec4 snapped = vertInClipSpace;
   snapped.xyz = vertInClipSpace.xyz / vertInClipSpace.w; // to NDC
   snapped.xy = floor(grid * snapped.xy) / grid;          // snap
   snapped.xyz *= vertInClipSpace.w;                      // back to clip
   ```
   Variants: world/object-space snap with tunable density (Retro Shaders Pro); Three.js
   version patches `THREE.ShaderChunk.project_vertex` (Roman Liutikov); R3F jitter via
   `uJitterLevel` + `floor` (Codrops).
3. **Affine texture mapping** (the warp) — either `o.uv = uv * w` in vertex shader and
   `uv / w` in fragment (cancels perspective-correct interpolation), or declare the
   interpolator `noperspective`. Blend factor affine↔correct is a stylization dial;
   late-PS1 games subdivided geometry to hide warp — tessellation is an authenticity dial.
4. **Per-vertex (Gouraud) lighting**; alternatives: flat shading, or texel-aligned
   shading via `ddx`/`ddy` so lighting quantizes to texels.
5. **Color depth reduction**: quantize to 5 bits/channel:
   `floor(color * (n-1) + 0.5) / (n-1)`.
6. **Ordered (Bayer) dithering** to break banding — 4x4 Bayer matrix:
   ```
   1/16 * [ 0  8  2 10
           12  4 14  6
            3 11  1  9
           15  7 13  5 ]
   ```
   Apply in texel-space or screen-space.
7. **Dithered / screen-door transparency**: alpha tested against the Bayer threshold —
   used for "transparency," camera fades, and LOD.
8. **Nearest-neighbor sampling**, tiny textures (32–128px), heavy tiling; clamp texture
   res via mip LOD sampling.
9. **Linear distance fog** with a close far plane:
   ```glsl
   float depth = abs(depthVert.z / depthVert.w);
   fog = 1.0 - clamp((fogMax - depth) / (fogMax - fogMin), 0.0, 1.0);
   color.rgb = mix(color.rgb, fogColor.rgb, fog);
   ```
   Match fog color to skybox/void color so geometry "fades into simple silhouettes"
   (the Lunacid trick).
10. Optional post: CRT downsample/upsample, interlacing, RGB subpixel masks, VHS
    tracking warp.

### 3.2 Core N64 recipe (differences from PS1)

- Keep: low internal res, per-vertex lighting, fog, color-depth + dither.
- Drop: affine warp, vertex snapping, nearest sampling.
- Add:
  - **3-point texture filtering** in the fragment shader (godotshaders "N64 3 Point
    Filtering," CC0; port of GLideN64's version): denormalize UV to texel space, pick
    upper/lower triangle of the texel quad by testing the diagonal, blend 3 corner
    texels with barycentric weights.
  - **Blurry-by-design textures**: cap ~32x32–64x64 with mipmaps; let filtering smear.
  - **Edge softness**: light FXAA-ish AA + subtle horizontal blur (MenacingMecha's
    godot-n64-shader-demo: light AA, horizontal blur, linear mipmap filtering, limited
    color depth, hardware-style dithering, spherical-env-map "chrome," billboard
    sprites, fog to limit draw distance).
  - **Vertex colors everywhere**: bake lighting/ambient gradients into vertex color;
    "white ambient light combined with vertex colors for faked lighting"; prefer
    additive blending over alpha.

### 3.3 Tooling index

- Unity: danielilett **Retro Shaders Pro** (PSX+N64); dsoft20 **psx_retroshader**;
  TotesNotJosh **PS1-3D-Shader**; Ymne22 **PSX-Shaders-for-Unity-Built-in-RP**.
- Godot: **PS1/PSX Visuals GD4 plugin**; godotshaders.com PS1 pages;
  **godot-n64-shader-demo** (MIT); zorochase **Ultimate Retro Shader Collection**.
- Web/Three.js: Roman Liutikov "PS1 style graphics in Three.js"; Codrops "PS1-Inspired
  Jitter Shader with React-Three-Fiber" (also dims diffuse `*= 0.8`); Maxime Heckel
  "The Art of Dithering and Retro Shading for the Web."
- Community: **Haunted PS1** (itch.io collective, Demo Discs since 2020) — de facto
  style council. Canon: "low-poly models, affine texture warping, dithering, jitter,
  low-res textures... shimmering polygons, grainy textures, angular environments, and
  thick fog," in "Unity, Unreal, and Godot using custom shaders and post-processing."

### 3.4 Synthesis hooks

- Both games weaponize a hostile moon as a persistent skybox actor: MM's descending
  face; Lunacid's real-time lunar phases driving Lunacy. **"The moon is UI."**
- Fog duality: PS1-style fog is a *silhouette compositor* (Lunacid); N64 fog is
  *weather and dread* (Snowhead). Both make limitation read as intent.
- Music as clock: MM accelerates Clock Town per day, swaps to ambient resignation;
  Lunacid holds a steady "waking lucid dream." Retro visuals + ambient synth = the
  shared melancholy register.
- Fidelity is opt-in: authentic content, adjustable artifacts (Lunacid's filter stack).

---

## Sources

Lunacid:
- https://en.wikipedia.org/wiki/Lunacid
- https://store.steampowered.com/app/1745510/Lunacid/
- https://www.pcgamer.com/lunacid-brings-fromsoftwares-original-rpg-series-into-the-21st-century/
- https://www.rpgfan.com/review/lunacid/
- https://www.rpgsite.net/review/15221-lunacid-review
- https://rpgspain.com/2024/09/30/interview-kira-lunacid/
- https://kayin.moe/lunacid
- https://www.resetera.com/threads/lunacid-announced-by-kira-lost-in-vivo-a-first-person-dungeon-crawler-inspired-by-shadow-tower-and-king%E2%80%99s-field-update-live-in-ea.484702/
- https://www.youtube.com/watch?v=ueDNFx0v_yw
- https://store.steampowered.com/app/2692630/Lunacid_Original_Soundtrack/ ; https://vgmdb.net/album/135197
- https://lunacid.fandom.com/wiki/Moonlight ; https://kingsfield.fandom.com/wiki/Moonlight_Sword
- https://lunacid.fandom.com/wiki/Category:Areas ; https://steamah.com/lunacid-items-secrets-maps-guide/
- https://www.resetera.com/threads/lunacid-tears-of-the-moon-releases-today-made-with-sword-of-moonlight-making-tool.1162560/
- https://www.pcgamingwiki.com/wiki/Lunacid ; https://github.com/EmpioDavion/LunaticModdingAPI/
- https://bloody-disgusting.com/interviews/3535156/interview-lost-vivo-secret-can-discovered-midnight-came/
- https://www.gamespot.com/articles/move-over-dark-souls-the-from-software-title-inspiring-a-new-wave-of-games-is-kings-field/1100-6507649/

Majora's Mask:
- https://zeldauniverse.net/features/how-atmosphere-shapes-every-region-in-majoras-mask/
- https://fullfrontal.moe/itw-takaya-imamura/
- https://neonobservatory.wordpress.com/2013/12/20/affirming-the-art-the-unique-experience-of-majoras-mask/
- https://en.wikipedia.org/wiki/The_Legend_of_Zelda:_Majora%27s_Mask
- https://iwataasks.nintendo.com/interviews/3ds/majoras-mask-3d/0/0/
- https://zelda.fandom.com/wiki/Final_Day ; https://zelda.fandom.com/wiki/Terminan_Apocalypse
- https://www.nintendolife.com/features/soapbox-music-just-dont-come-spookier-and-sadder-than-zelda-majoras-mask
- https://microgenremusic.com/genres/the-legend-of-zelda-majoras-mask-soundtrack-review/
- https://www.svg.com/1082029/the-only-two-games-that-actually-required-the-n64-expansion-pak/
- https://zeldacentral.com/games/majoras-mask/walkthrough/ikana-canyon/
- https://www.colourlovers.com/palette/1826808/Majoras_Mask ; https://www.color-hex.com/color-palette/4619

N64/PS1 tech + modern recreation:
- https://www.copetti.org/writings/consoles/nintendo-64/
- https://www.retroreversing.com/n64rdp
- https://forum.beyond3d.com/threads/psx-vs-n64-graphical-look.56516/
- https://www.emutalk.net/threads/emulating-nintendo-64-3-sample-bilinear-filtering-using-shaders.54215/
- https://danielilett.com/2026-01-27-article-retro-1-5-1-update/
- https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/
- https://danielilett.com/2020-04-19-tut5-5-urp-dither-transparency/
- https://www.david-colson.com/2021/11/30/ps1-style-renderer.html
- https://romanliutikov.com/blog/ps1-style-graphics-in-threejs
- https://tympanus.net/codrops/2024/09/03/how-to-create-a-ps1-inspired-jitter-shader-with-react-three-fiber/
- https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
- https://www.ronja-tutorials.com/post/042-dithering/
- https://godotshaders.com/shader/n64-3-point-filtering/ ; https://godotshaders.com/shader/ps1-shader/
- https://github.com/MenacingMecha/godot-n64-shader-demo
- https://github.com/dsoft20/psx_retroshader ; https://github.com/Ymne22/PSX-Shaders-for-Unity-Built-in-RP
- https://godotengine.org/asset-library/asset/4687 ; https://zorochase.itch.io/ultimate-retro-shader-collection-for-godot
- https://en.wikipedia.org/wiki/Haunted_PS1 ; https://ijcmr.online/2/article/view/16/19
- https://hackaday.com/2023/09/19/implementing-megatextures-on-real-nintendo-64-hardware/

Caveats: hex values are approximations or community palettes; Lunacid billboard-sprite
usage is weakly sourced; some quotes came via search excerpts where pages were blocked.
