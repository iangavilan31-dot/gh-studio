# MOONREST — Asset Acquisition & Integration Guide

Companion to `docs/DIRECTION.md`. The owner acquires; the agent integrates.
The agent must never attempt to purchase, sign up, scrape, or bypass any store.

---

# PART 0 — WHY BROWSER (and why that's not the ceiling)

The platform choice is deliberate and it drives everything below.

**Why three.js in a browser:**
- **The agent is far more effective here.** This project is built by an
  autonomous coding agent. In a text-based JS codebase it can read every file,
  write every system, run the game, screenshot it, measure the screenshot, and
  iterate — the whole `composecheck` loop in `DIRECTION.md` depends on that.
  In Unity, scene layout, lighting, and asset placement happen in a GUI over
  binary/YAML files an agent cannot meaningfully author. The renderer would be
  better and the iteration loop would be dead.
- **Co-op is the point.** Send a link, friends play in five seconds, no
  install. That is the entire "playing with the homies" use case.
- **Free hosting, instant deploys, no store, no build pipeline.**

**What the browser actually costs:** roughly one tier of raw fidelity. No
heavy compute shaders, tighter VRAM, download size matters, and performance
sits below a native build.

**Why that doesn't matter here:** the locked style (`DIRECTION.md` Part 1 —
Shadow of the Colossus / ICO / Ashen / Journey) is built from big simple
forms, scarce lights, and heavy atmosphere. That is *exactly* the kind of
beauty WebGL delivers well. The style that would have needed a native engine is
painterly photorealism — the one we did not pick. The platform and the art
direction are matched on purpose.

**If that ever changes:** Godot 4 is the realistic escape hatch, because its
scene files are text and an agent can author them. Unity is not, for the reason
above. Revisit only if the browser is proven to be the binding constraint —
right now it is not. Nothing in the current screenshots is limited by WebGL;
they are limited by lighting, terrain, scale, and composition, all of which are
free.

---

# PART 1 — THE HARD CONSTRAINTS (read before buying anything)

MOONREST is a **browser** game built on **three.js**. That imposes rules that
disqualify most of what's on Unity's asset store:

| Constraint | Value | Why |
|---|---|---|
| Model format | **glTF / GLB only** | Native three.js. FBX/OBJ are convertible; `.unitypackage` and `.uasset` are a trap — Unity/Unreal materials do not survive the trip. |
| Total model budget | **≤ 40 MB** shipped (Draco-compressed) | It downloads over the network before anyone plays. |
| Texture budget | **≤ 256 MB** VRAM, source ≤ 1024px | Browser VRAM and mobile. |
| Poly budget | 2k–20k tris per prop, 4 LODs on anything ≥ 500 tris | 60 FPS with four players. |
| Style | Simple broad forms, hand-painted-style albedo, minimal surface noise | `DIRECTION.md` Part 1 — big-form atmospheric dark. |

**A 1.2 GB photoreal Unity pack fails every row of this table.** Bought
assets are only worth it when they arrive as glTF, low-poly, and stylized.

---

# PART 2 — THE CORRECTED SHOPPING LIST

The style locked in `DIRECTION.md` (Shadow of the Colossus / ICO / Ashen) needs
**few, enormous, simple** shapes. That makes it the cheapest style to source.
Most of what this game needs is free.

## Tier 0 — free, take all of these first (≈ $0)

| Source | What to get | License | Format |
|---|---|---|---|
| **Quaternius** (quaternius.com) | Ultimate Modular Ruins, Stylized Nature, Medieval packs | CC0 | glTF ✅ |
| **KayKit** (kaylousberg.itch.io) | Dungeon Remastered, Medieval Builder, Halloween | CC0 / cheap | glTF ✅ |
| **Kenney** (kenney.nl) | Nature Kit, Castle Kit, Graveyard Kit | CC0 | glTF ✅ |
| **Poly Haven** (polyhaven.com) | 2–3 night/dusk HDRIs (2K) for image-based lighting | CC0 | HDR ✅ |
| **Blockade Labs free tier** | Skyboxes, 5 free credits (already available) | check ToS | PNG ✅ |
| **Tripo3D free credits** | Hero props, 200 credits (already available) | check ToS | glTF ✅ |

This tier alone covers most of the game. Start here, integrate it, look at the
screenshots, and only then decide whether anything still needs buying.

## The spending rule: free first, always

**Do not buy anything until the free pass has run and been judged.** Assets are
the last 20% of the visual gap, not the first 80%. Everything currently wrong
with the build — nothing is lit, the terrain is flat, there is no scale, there
is no composition — is fixed with code, math, and light, at zero cost. A $500
asset library dropped into an unlit flat world still looks like an unlit flat
world.

Sequence: run `DIRECTION.md` with Tier 0 only → judge the screenshots against
the Part 11 gates → *then* identify the specific remaining gap ("the hero trees
still look procedural", "the architecture reads generic") → buy only the thing
that closes that named gap. Record every purchase decision, and the screenshot
that justified it, in `DECISIONS.md`.

## Tier 1 — spend only if Tier 0 leaves a visible gap (≈ $40–70)

| Item | Cost | Notes |
|---|---|---|
| **Blockade Labs paid month** | ~$15–20 | Only if the free credits run out or the free tier's license/resolution is insufficient. Skyboxes are the highest-value purchase in this game — the sky is half of every frame in this style. |
| **Tripo3D or Meshy paid month** | ~$20 | Only if 200 free credits don't cover the 10 hero props in Part 4. |
| **Synty POLYGON pack** (syntystore.com, **not** the Unity Store listing) | ~$20–40 on sale | Buy from Synty's own store so you get **FBX**, which converts cleanly to glTF. Their Unity Asset Store listings ship `.unitypackage`. Good candidates: *Dungeon Realms*, *Fantasy Kingdom*. Must be re-graded hard — Synty ships bright and cheerful and will fight the mood at default colors. |

## Never buy

Photoreal/photogrammetry packs · anything over ~200 MB · anything sold only as
`.unitypackage` or `.uasset` · anything whose screenshots look like a different
game than `DIRECTION.md` describes.

---

# PART 2.5 — BLENDER AS THE ASSET FACTORY (free, and the largest single win)

Blender is free and fully scriptable from Python with **no GUI** — the agent
can drive it headlessly. It is not just a converter; it is how this project
manufactures professional-grade assets for $0. Build `tools/` scripts and an
`npm run bake` / `npm run assets` pipeline. In priority order:

**1. Lightmap + AO baking (the biggest quality jump available at any price).**
Bake the moon, warm anchors, bounce light, and ambient occlusion into
lightmaps on a second UV channel for all static geometry; sample them at
runtime. A mostly-static night world gets near-offline-render lighting for
almost zero frame cost. For a static scene, **baked light beats realtime GI** —
which is precisely why an engine swap buys less than it appears to (Part 2.6).

**2. High-to-low normal map baking.** Sculpt or procedurally generate a
high-poly version (subdivide + displace + noise), bake its detail into a normal
map, apply to a low-poly mesh. This is how commercial assets get their
surface quality, and it costs nothing. Weathered stone, bark, and eroded
statues all come from here.

**3. Procedural hero-asset generation.** The gnarled trees, ruined columns,
cliff forms, and colossal statues can be *built* in Blender via Python — curve
+ skin modifiers for twisted trunks, boolean + displace for damaged stone,
remesh and bevel for readable silhouettes, geometry nodes for scatter. This is
strictly better than code-generated primitives in three.js, and it removes most
of the reason to buy or AI-generate props at all.

**4. Decimation and LOD generation.** Automatic 4-tier LODs from any source
mesh, including anything downloaded or AI-generated.

**5. Impostor billboards.** Render distant trees/architecture to textured
cards from 8 angles — how the reference painting's background reads, and near
free at runtime.

**6. Format conversion and cleanup.** FBX/OBJ → GLB, UV repair, scale
normalization, material stripping before palette re-grading.

Treat this pipeline as mandatory infrastructure, ahead of any purchase.

---

# PART 2.6 — ON SWITCHING ENGINES (Godot 4)

Godot is the only engine worth considering here — its `.tscn` scene files are
text, so an agent can genuinely author them, which Unity's cannot be. The
question is real, and the answer is *not yet*, for three specific reasons:

1. **Godot's renderer advantage does not survive web export.** The features
   that make Godot 4 look better than three.js out of the box — SDFGI,
   volumetric fog, screen-space effects — belong to the **Forward+** renderer,
   which is desktop-only. Web export uses the **Compatibility** renderer
   (OpenGL ES 3.0 / WebGL2), which is broadly the tier three.js already
   targets. Switching engines but staying in the browser buys very little.
2. **So the real fork is browser vs desktop, not Godot vs three.js.** Godot is
   only a meaningful upgrade if the game becomes a downloaded desktop build —
   which costs the instant-link co-op that is the reason this game exists.
3. **Baked lighting closes most of the gap anyway.** MOONREST is a static
   world at night with a handful of lights. Realtime GI solves a problem this
   game does not have. Part 2.5's baking pipeline delivers comparable results
   in the browser.

Add to that a full rewrite of working collision, netcode, audio, and gameplay
systems, and the trade is bad *today*.

**Revisit if and only if:** the DIRECTION pass ships with baked lighting and
the screenshots still fail the Part 11 gates, **and** the owner decides a
desktop download is acceptable. In that case the migration is Godot 4
Forward+, desktop-first, with Blender assets carrying over unchanged — which
is the other reason to build the Blender pipeline now: it is engine-agnostic
insurance.

---

# PART 3 — SKYBOX PROMPTS (paste into Blockade Labs)

Recommended style preset: a painterly/fantasy style, **not** photorealistic.
Blockade generates a full 360° sphere including ground — the agent masks the
lower hemisphere and blends it into the real terrain, so **prompt for sky
only** and ignore whatever ground it invents.

Add to every prompt: `no ground detail, no buildings, no text, no watermark`.
Negative text field: `sun, daylight, people, text, watermark, buildings`.

| Zone | Prompt |
|---|---|
| **Gloaming Park** | `night sky over a dark forest, heavy teal-blue clouds with breaks of deep navy, one enormous pale moon low behind thin cloud, cold moonlight rimming the cloud edges, faint stars, melancholy, painterly fantasy` |
| **Emberwick Village** | `deep indigo starry night sky, scattered dark clouds drifting low, dense faint stars, cold blue-violet gradient to a darker zenith, quiet medieval winter night, painterly` |
| **Rooftops** | `cobalt blue night sky packed with stars, visible milky way band arcing overhead, very few clouds, deep and clear, a sense of enormous height, painterly fantasy` |
| **Violet Ruins** | `magenta and violet twilight sky, purple storm clouds lit from within, dying light at the horizon, ancient and mournful, no sun visible, painterly fantasy` |
| **Castle Gloomspire** | `black night sky with deep purple nebula clouds, cold and ominous, scattered stars behind the haze, faint green glow near the horizon, dark fantasy, painterly` |
| **Mosswood Gate** | `nearly black night sky seen through a thick canopy gap, dark blue-green haze, very few stars, heavy mist in the upper air, ancient forest, painterly` |
| **Moonlit Isle** | `moonlit night sky over open sea, enormous bright moon with a soft halo, silver-blue clouds streaked across the horizon, cold and vast, painterly fantasy` |
| **Foglands** | `featureless deep blue-grey night fog filling the whole sky, no stars, no moon, soft luminous haze, oppressive and quiet, painterly` |

Download at the highest resolution the tier allows. Save as
`public/assets/skies/<zone>.png` (or `.hdr` if offered — prefer HDR).

---

# PART 4 — HERO PROP PROMPTS (paste into Tripo3D / Meshy)

Use the **game-ready / smart-topology** mode, not the high-detail 2M-poly mode.
Append to every prompt: `low poly game asset, clean topology, stylized,
hand painted texture, simple broad forms, no small surface detail, neutral
grey stone` — the agent re-grades everything into the locked palette anyway,
so ask for neutral color and simple shapes.

1. `colossal ancient dead tree, thick twisted gnarled trunk, massive exposed roots, bare asymmetric branches, hollow, bark like carved stone`
2. `enormous fallen statue head lying on its side, weathered stone, serene closed eyes, cracked, half buried`
3. `ruined stone archway, crumbling keystone, ivy, one side collapsed, ancient`
4. `cluster of broken stone columns, fluted, snapped at different heights, weathered`
5. `ancient stone shrine with a lantern niche, small carved roof, moss, worn glyphs`
6. `tall standing stone monolith with carved spiral glyphs, weathered, leaning slightly`
7. `colossal seated statue, robed figure, hands on knees, eroded featureless face, mountain scale`
8. `old wooden park bench, worn planks, iron frame, one broken slat`
9. `medieval iron street lantern on a tall post, glass panes, hanging arm`
10. `stone waymarker fingerpost at a crossroads, worn carved arrow, lichen`

Save GLB files to `public/assets/models/hero/<name>.glb`. They will arrive
far too heavy — the agent decimates and re-textures them (Part 6).

---

# PART 5 — WHERE FILES GO

```
public/assets/
  skies/          <zone>.png|.hdr        — Blockade skyboxes
  hdri/           *.hdr                  — Poly Haven, environment lighting
  models/
    hero/         *.glb                  — AI-generated hero props
    kit/          *.glb                  — modular architecture (Quaternius/KayKit/Synty)
    nature/       *.glb                  — trees, rocks, foliage
  LICENSES.md                            — REQUIRED, see Part 7
```

Anything the owner has not supplied yet: the agent keeps its existing
procedural stand-in and moves on. **Work never blocks on a purchase.**

---

# PART 6 — AGENT INTEGRATION RULES

For every third-party asset, before it ships:

1. **Convert** to GLB (FBX → glTF via headless Blender in `tools/`; never
   attempt to open `.unitypackage`/`.uasset` — reject those assets outright and
   log it in `DECISIONS.md`).
2. **Decimate** to the Part 1 poly budget; generate 4 LODs.
3. **Re-texture into the palette.** Strip the source material; re-author albedo
   into `DIRECTION.md` Part 7 colors at ≤1024px with minimal noise. No pack
   asset ever ships at its default color.
4. **Re-scale to the scale law** (`DIRECTION.md` Part 3). A pack "ruined
   column" is human-scale; ours is 20–40m.
5. **Bevel** hard edges so they catch moonlight.
6. **Draco-compress**; verify the total shipped model payload stays ≤ 40 MB.
7. **Bake** into the zone lightmaps (`DIRECTION.md` Part 10.3).
8. **Record the license** in `public/assets/LICENSES.md`.
9. Run `composecheck.mjs` — a beautiful asset that breaks the composition
   metrics is a regression, not an improvement.

---

# PART 7 — LICENSE DISCIPLINE (non-negotiable)

`public/assets/LICENSES.md` records, for every asset: source URL, author,
license name, date acquired, and where it's used. Rules:

- CC0 / public domain: fine anywhere, attribution still recorded.
- CC-BY: fine, **attribution must appear in the in-game credits**.
- Store licenses (Synty, Unity EULA): usable in the game; **never redistribute
  the raw source files** — commit only the processed GLBs, and if the license
  forbids even that in a public repo, keep them out of git (`.gitignore`) and
  document the acquisition step in the README instead.
- **AI-generated assets:** record the tool, the prompt, and the tier's
  commercial-use terms. Free tiers sometimes restrict commercial use — if the
  game is ever monetized, these must be re-checked or regenerated on a paid
  tier. Flag any uncertainty in `DECISIONS.md` rather than assuming.
- Never use assets ripped from other games, ever, regardless of source.

---

*Buy little. Regrade everything. The lighting is what costs nothing and does
the most.*

---

# PART 8 — VERIFIED CATALOG & LICENSE CORRECTIONS

Licenses below were verified by fetching the actual license pages and, in
several cases, by downloading and parsing the binaries. **This part corrects
earlier recommendations in this document.**

## 8.1 🔴 CORRECTIONS to Part 2's shopping list

**Blockade Labs Skybox AI — withdrawn as the #1 recommendation.** The free tier
outputs **CC-BY-NC** (non-commercial), and more seriously, the ToS grants
Blockade a **perpetual license to your generations and permission to train on
them — on paid tiers too**. Use Poly Haven's `_puresky` HDRIs instead: CC0, no
strings, and better suited to a game background anyway.

**Tripo3D — withdrawn.** Its free/Basic tier **explicitly forbids commercial
use**. Use **Meshy** instead, whose free tier *is* CC-BY and permits commercial
use and selling with credit.

**Net effect: the recommended spend drops to roughly $0–40.** The free tier is
now genuinely sufficient; buy only against a named gap after the free pass.

## 8.2 ⭐ The single highest-leverage art move

**KayKit, Kenney and Quaternius each use one small gradient atlas per pack**
(KayKit a 1024² that downscales to 128² with no visible loss; Kenney a single
`colormap.png`). **Swap that one atlas for a shared desaturated, high-contrast
dark-fantasy ramp and every model in every pack shifts to your palette at
once.**

That is how you get an Ashen or Death's Door look out of Kenney geometry, and
it does more for coherence than any individual asset choice. Do this before
judging whether a pack "fits."

## 8.3 The ranked free sources

**1. KayKit** (kaylousberg.itch.io) — **CC0, ships GLB natively**, one atlas per
pack. Verified by parsing the binaries: `Skeleton_Warrior.glb` carries **95
animation clips** including `Skeletons_Awaken_Floor`, `Skeletons_Awaken_Standing`
and `Death_C_Skeletons_Resurrect` — literally the Souls-like undead vocabulary.
`Knight.glb` has **76 clips at 3.66 MB**, including `Sit_Floor_Down/Idle/StandUp`
and `Lie_Down/Idle/StandUp` — which MOONREST needs for its sleepers and bench
moments. **Adventurers and Skeletons share one rig and clip-naming scheme**, so
clips retarget between them for free. Free packs cover dungeon, forest, medieval
buildings, and **gravestones + mausoleums** (Halloween Bits). `Rogue_Hooded` is
the hooded-figure archetype.

**2. Quaternius** — CC0, the largest volume of on-brief stylized geometry.
- **Ultimate Animated Animals** (glTF): Deer, **Stag**, Fox, Wolf, Horse and 7
  more, 12+ clips each. **The single highest-value creature grab for this
  project** — the Antlered Sleeper's smaller cousins in one CC0 download.
- **Universal Animation Library 1+2**: ~**250 CC0 humanoid clips as GLB** on a
  universal rig — the reason you never have to depend on Mixamo.
- Medieval Village MegaKit (300+), Stylized Nature MegaKit (110+ including dead
  trees), Fantasy Props MegaKit (200+ on only 4 texture sets).
- ⚠ Format varies per pack — newer MegaKits ship glTF, older ones are FBX/OBJ
  only. Prefer the itch.io downloads.

**3. Poly Haven** — CC0 **with an explicit redistribution grant**. Hand-made,
explicitly **no generative AI** — the cleanest provenance available. Its
**`lighting` category (29 models)** is the best free warm-light prop set that
exists: `Lantern_01`, `wooden_lantern_01`, `lantern_chandelier_01`,
`Chandelier_01/02/03`, `brass_candleholders`, `vintage_oil_lamp`,
`caged_hanging_light`, `street_lamp_01/02`. Also `large_castle_door`,
`large_iron_gate`, and dead-tree/root/cliff scans. Textures ship a packed
**`arm` map** = glTF's `occlusionRoughnessMetallic` layout, one fetch instead of
three, plus a ready `gltf` export.

**4. ambientCG** — CC0, 2,004 materials. Ships **both `NormalGL` and
`NormalDX`** — take GL. Holds **pure star-field HDRIs Poly Haven lacks**
(`NightSkyHDRI001–016`, with `002` a Milky Way). ⚠ Ships `.exr`, so use
`EXRLoader`, not `RGBELoader`.

**5. Kenney** — CC0 with no strings at all. **Verified from inside the zips:
every 3D pack ships parallel `Models/GLB format/` trees** — GLB is first-class,
contradicting the common "Kenney is OBJ-only" claim. Graveyard Kit (90 files:
ghost/skeleton/keeper, crypts, coffins, altars), Nature Kit (330), Fantasy Town
Kit (160), Castle Kit (75).

**6. Sonniss #GameAudioGDC** (gdc.sonniss.com) — **200GB+ across 10 annual
bundles**, and the best license terms in this whole document: worldwide,
perpetual, royalty-free, unlimited projects, for life, **no attribution**,
explicitly covering games. 96k/24-bit. Only limits: don't resell the sounds
as-is, and **no AI/ML training**.

**7. Eric Matyas / soundimage.org** — free commercial, **ships OGG** (web-ready),
with Fantasy 1–13 and Dark/Ominous pages. Explicitly not AI-generated. ⚠
Attribution is strict and must appear in an actual credits **screen**.

## 8.4 🔴 Sources that are disqualified

| Source | Why |
|---|---|
| **Poliigon** | *"You can't use our assets in… games where the users have direct or indirect access to the assets"* — a three.js build serves raw files over HTTP. Fails on its face. |
| **Textures.com** | ToS forbids releasing content or derivatives **under any open-source license**, and bars distributing PBR materials as part of a 3D scene at all. |
| **Blockade Labs free tier** | CC-BY-NC, plus a perpetual license to your generations and training rights. |
| **Tripo free tier** | No commercial use. (Meshy's free tier is fine.) |
| **BBC Sound Effects Archive** | Non-commercial only. |
| **Ready Player Me** | **Dead** — Netflix acquisition, all developer APIs offline January 2026. |
| **FreePD, Adobe Fuse, iHDRI.com, 3dmodelscc0.com** | Dead or hijacked. iHDRI now serves casino spam; 3dmodelscc0 redirects elsewhere — yet both are still listed as live in popular "awesome" indexes. |
| **CC-BY-SA / GPL art** (Veloren, Luanti, several Blender splash files) | Share-alike propagates to your derivative art. |
| **three.js `examples/models`** | ⚠ three.js is MIT but **the example art is not covered by it.** `Soldier.glb` / `Michelle.glb` / `Xbot.glb` are Mixamo-derived; Flamingo/Parrot/Stork/Horse have **no published license anywhere**. Only `RobotExpressive` is genuinely CC0. |
| **Sketchfab IP laundering** | Verified CC-BY-tagged rips in the wild (Dark Souls, Metroid, TF2, Fortnite models). **An uploader's CC tag cannot launder third-party copyright** — vet by author, not badge. |

**The through-line: because a browser game serves downloadable `.glb` files,
restrict yourself to CC0 and CC-BY.** Every EULA-bound source (Synty, Fab,
TurboSquid, Unity Asset Store, Poliigon, BlenderKit Royalty-Free) has
redistribution or "embedded-only" language that a plain web deployment sits
awkwardly against.

## 8.5 Practical three.js notes

- **File size:** KayKit characters are 3.6–4.9 MB because 76–95 clips are baked
  in. **Extract the 6–10 clips you actually use into one shared animation GLB**;
  `gltf-transform` then typically takes these under 500 KB.
- **Two animation topologies:** Kenney's Graveyard Kit, Cube Pets and Blocky
  Characters report `skins: 0` — node-hierarchy transforms, **no GPU skinning**,
  so they instance far more cheaply. Use them for crowds and flocks.
- **Pick one rig family and stay inside it.** Cross-family retargeting is where
  the time goes.
- **Ship 1K or 2K HDRIs, never 4K+** (1k ≈ 1.7 MB, 4k ≈ 27 MB). **Split the
  roles:** a 512/1K HDR purely for image-based lighting, plus a separate
  compressed LDR equirect for the visible background. Night skies have low
  dynamic range anyway — the HDR range only matters around the moon.
- **Use the `_puresky` variants** as `scene.background` so your terrain isn't
  fighting a photographed foreground.
- **Start `CREDITS.md` on day one.** Kevin MacLeod, Eric Matyas, ZapSplat and
  Sketchfab CC-BY assets all mandate *specific wording*, and Matyas requires an
  in-game credits screen. Sketchfab CC-BY often requires crediting **two**
  parties (modeller and rigger).
- **Structural note on Sketchfab:** CC0 there is overwhelmingly **museum
  photogrammetry**, while CC-BY is **actual game art**. If you refuse
  attribution you lose the useful half of the platform. Decide early.

## 8.6 Where the free ecosystem has nothing — build these

| Need | Reality |
|---|---|
| **The colossal sleepers** | **Nothing free is colossus-scale.** Expect to author them — which is correct anyway; they're the assets that must be original. |
| **Lantern / brazier stylized pack** | No strong free pack. Best available is Poly Haven's photoreal lighting category (decimate + regrade) plus KayKit Dungeon torches. Expect to kitbash. |
| **Cliffs and large boulders** | The weakest category. Poly Haven scans need decimation; Fertile Soil's terrain kits are untextured OBJ. |
| **Crows, ravens, owls — animated, CC0** | **Do not exist.** CC-BY only (WildPoly3D has a 638-tri Owl and a 1,280-tri Crow; warrenblyth has a 469-tri American Crow). Accept attribution or model them. |
| **Moths** | Thin — recolour a butterfly (ffish.asia's CC0 *Pieris rapae*). |
| **Wisps and spirits** | Best done as **three.js particles and shaders, not meshes.** |
