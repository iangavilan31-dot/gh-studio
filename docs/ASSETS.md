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
