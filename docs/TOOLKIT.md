# MOONREST — TOOLKIT

Verified libraries, techniques and traps. **The build agent reads this before
writing any rendering or physics code.** Everything was verified 2026-07-26
against npm, GitHub, and three.js source. Baseline: **three.js r185**.

Companion to `DIRECTION.md` (art law) and `FINAL_PASS.md` (build order).
**Where this file and any other doc disagree on a technical detail, this wins.**

---

# 0. INSTALL THESE, IN THIS ORDER

```bash
npm i three@0.185.1                       # PIN EXACTLY — see §1.1
npm i @dimforge/rapier3d-compat@0.19.3    # 1. structurally fixes wall-phasing
npm i three-mesh-bvh@0.9.13               # 2. camera occlusion, ground probes, picking
npm i postprocessing@6.39.3 n8ao@2.0.0    # 3. the entire "looks good" delta
npm i three-custom-shader-material@6.4.0  # 4. custom shaders that KEEP three's lighting
npm i lil-gui@0.21.0 stats.js@0.17.0      # 5. cannot art-direct a night scene blind
npm i simplex-noise@4.0.3 alea@1.0.1      # 6. seeded, reproducible world
npm i vite-plugin-glsl@1.6.1              # 7. .glsl files with #include
npm i -D @gltf-transform/cli@4.4.2        # 8. biggest perf win per hour spent
# when vegetation lands:
npm i @three.ez/instanced-mesh@0.3.16     # pin — pre-1.0, but correct for trees/props
```

Rapier is first because it fixes a **bug**, not a look. Everything else is
polish on a game you currently cannot walk around in.

---

# 1. STACK DECISIONS

## 1.1 Pin three to **0.185.1 exactly**

`postprocessing`'s peer range is `three: >= 0.168.0 < 0.186.0`. **You are one
release from a peer break.** Do not upgrade to r186 until that widens.

## 1.2 Stay on `WebGLRenderer`. Do NOT adopt WebGPU/TSL.

An earlier draft recommended `WebGPURenderer` for its built-in TSL height fog.
**Deeper verification reversed that call:**

1. **`pmndrs/postprocessing` does not run under `WebGPURenderer`** — you would
   lose `SelectiveBloomEffect` and `GodRaysEffect`, the two highest-value
   effects for a night game. This alone decides it.
2. `three-custom-shader-material` doesn't work there either (it patches WebGL
   chunk strings).
3. **TSL is actively breaking** — r185 itself changed vertex-displacement
   semantics (`positionLocal` → `positionGeometry`), invalidating every
   grass-wind tutorial written before it. ~16 TSL/WebGPU breaking changes in six
   releases.
4. WebGPU reach ~82%, and the misses are awkward: **Firefox desktop ships
   nothing by default**; Safari only from 26.0 and flagged *partial*.

Keep shaders in separate `.glsl` files so a future port is mechanical.

## 1.3 The color pipeline — set this before lighting anything

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;        // ← tone map in the EFFECT chain
new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });  // ← NOT 8-bit
material.dithering = true;                          // on every large gradient surface
```

**These three are non-negotiable and each fails silently:**

- **8-bit composer buffers** requantize on every ping-pong → banding and
  crushed blacks that no amount of tuning fixes. Dark scenes are exactly where
  this shows.
- **Tone mapping on the renderer *and* in the chain** = double tone mapping =
  washed out. The single most common mistake.
- **`material.dithering`** defaults `false`; it shifts each channel differently
  so the pattern is imperceptible. Cost ≈ 0. Without it every sky and ground
  gradient bands.

**Use AgX tone mapping** (`ToneMappingMode.AGX`). ACESFilmic lifts and
desaturates shadows and skews moonlight-blue toward cyan — it flattens exactly
the mid-dark range this game lives in. AgX has the best shadow rolloff and hue
preservation at low luminance. It reads slightly flat, **which is correct** —
restore contrast in the LUT. Exposure 0.6–1.0, and **never crank exposure to
fix darkness — raise light intensities instead**, or you amplify quantization
noise in the range you're protecting.

---

# 2. COLLISION — the wall-phasing fix

**Root cause:** discrete movement + depenetration. When a frame's motion ends
past a wall, the pushout resolves the wrong way. **Substepping is a
probabilistic patch, not a fix** — at 40 m/s with a 100ms hitch, a 5-substep
solver still moves 80cm per step and any thinner wall is gone.

## 2.1 Rapier `KinematicCharacterController` — the structural fix

`@dimforge/rapier3d-compat@0.19.3` · Apache-2.0 · 5,568★ · active

Verified in the Rust source: `computeColliderMovement` calls
`cast_shape(... max_time_of_impact: translation_dist)` and clamps to the hit
TOI. **It shape-casts the entire desired translation every call — it cannot
tunnel at any speed, with no substepping.**

Configuration rather than code you debug: `enableAutostep(maxHeight, minWidth,
includeDynamic)`, `enableSnapToGround(dist)`, `setMaxSlopeClimbAngle`,
`setMinSlopeSlideAngle`, `setOffset` (skin width — must not be zero), and
`setNormalNudgeFactor` (whose docstring is literally the fix for "character
sticks on walls").

**Critical: use `TriMeshFlags.FIX_INTERNAL_EDGES` on static level geometry** or
the capsule catches on shared interior triangle edges while sliding across a
floor. This is the #2 complaint after tunneling.

Start from the official example `physics_rapier_character_controller` — but
copy the *pattern*, not `examples/jsm/physics/RapierPhysics.js`, which
CDN-pins rapier 0.17.3.

⚠️ `dimforge/rapier.js` was **archived 2026-07-12** and folded into the rapier
monorepo. Every older tutorial points at the dead repo; the character
controller code is byte-identical across the move.

**Terrain collision: use `ColliderDesc.heightfield(...)`**, not trimesh — O(1)
lookup, a fraction of the memory, no internal-edge pathology. Watch
row/column-major ordering (the classic transposed-terrain bug).

## 2.2 `three-mesh-bvh@0.9.13` — everything else

MIT · 3,433★ · active. Different job from Rapier, and they compose well:
**fast raycasts against your actual render meshes** for camera occlusion,
ground probes, mouse picking, AI line-of-sight.

```js
THREE.Mesh.prototype.raycast = acceleratedRaycast;
raycaster.firstHitOnly = true;   // several× faster
```

⚠️ **API renames in 0.9.x that every tutorial gets wrong:** `MeshBVHHelper` →
**`BVHHelper`**, `maxLeafSize` → **`targetLeafSize`**.

⚠️ Its own `characterMovement.js` example is **discrete depenetration**, not
swept — good code to read, not a tunneling fix.

**Camera collision:** sphere-cast (radius 0.2–0.3, **not a bare ray** — a ray
lets the frustum clip through corners) from head toward the desired position,
place at `hit.distance - 0.1`, and **spring asymmetrically: snap in
immediately, ease out at 5–10 u/s.**

## 2.3 Do not use

`cannon-es` (npm frozen 2022, **no capsule primitive at all**), `ammo.js`
(three pins a 2020 commit), `Sketchbook` (built on dead cannon.js). `ecctrl` is
R3F-only, but **steal its floating-capsule spring-damper idea**
(`floatHeight 0.2, springK 80, dampingC 6`) for stair and slope feel.

---

# 3. POST-PROCESSING

`postprocessing@6.39.3` (pmndrs) · Zlib · active. Its `EffectPass` **merges N
effects into one compound shader**; three's built-in `EffectComposer` does a
fullscreen pass + blit per effect. Built-in also **has no GodRays and no
SelectiveBloom** — the two effects that define this look.

**Official effect order:** SMAA → SSAO → DoF → CA → Bloom → God Rays →
Vignette → **Tone Mapping → LUT** → Noise. Convolution effects (SMAA, Bloom,
DoF, GodRays) each need their own `EffectPass`; the rest merge into one.

**Bloom — the night trap:** default `luminanceThreshold: 1.0` means nothing in
a dark scene exceeds it and bloom looks broken. Fix by making emitters genuinely
HDR (`emissiveIntensity` 2–10), then threshold 0.6–0.9, `luminanceSmoothing`
0.2–0.4, `mipmapBlur: true`, `radius` 0.6–0.85. **Never set threshold to 0** —
that's the "everything glows, blacks fog up" failure. Use
**`SelectiveBloomEffect` + `Selection`** so only lanterns, runes and eyes glow.

**AO:** `n8ao@2.0.0` (CC0/ISC, no upper peer bound). Use `N8AOPostPass`;
**`aoTones`** quantizes AO into discrete bands — made for this art direction.
`halfRes` Ultra beats full-res Performance.

**God rays:** `three-good-godrays@0.12.0` raymarches **through the shadow map** —
real moonbeams through trees, works off-screen. ⚠️ **Two flags: license is
NOASSERTION, and peer caps at `<= 0.182.0`.** Resolve both before shipping, or
fall back to pmndrs `GodRaysEffect` (screen-space, breaks when the light leaves
frame — fine for lanterns, wrong for the moon) or large soft additive
billboards, which is what most stylized games actually ship.

**AA:** `SMAAEffect` at `SMAAPreset.ULTRA`. There is no good TAA on WebGL —
`TAARenderPass` only converges with a static camera.

**LUT is where "dark fantasy" actually happens.** `LUT3DEffect` +
`LUTCubeLoader`, **≥32³** (16³ bands in dark gradients), **enable
`tetrahedralInterpolation`**, place **after** tone mapping. Grade a screenshot
in Resolve → export `.cube` → crush shadows toward blue-cyan, warm the torch
highlights, desaturate mids.

**Dead despite star counts:** `realism-effects`, `screen-space-reflections`
(archived). **Do not build on `postprocessing` v7** — beta ~2 years, unmoved.

---

# 4. LIGHTING

Forward materials evaluate **every active light per fragment** with no
per-object culling; degradation starts around 30–50 point lights. The rig:

1. **1 × `DirectionalLight`** (the moon) — the **only** shadow caster. CSM
   ships in core: `three/addons/csm/CSM.js`, `mode: 'practical'`,
   `cascades: 3`, `shadowMapSize: 2048`. Call `setupMaterial()` per material.
2. **1 × `HemisphereLight`** — the ambient floor that stops shadows reaching
   pure black. Cannot cast shadows; essentially free.
3. **Single-digit `PointLight`s** for near lanterns, `castShadow = false`.
4. **Everything else is emissive with no light attached.**

**Free wins:**
- **`renderer.shadowMap.autoUpdate = false`**, set `needsUpdate = true` only
  when something moves. For a static world with one moon this is close to free
  shadows. Biggest cheap win available.
- **`renderer.compileAsync(scene, camera)`** to warm shader programs before
  gameplay — often the single biggest perceived-stutter fix.
- `shadow.normalBias` 0.02–0.05 fixes foliage acne far better than
  `shadow.bias`.

⚠️ **`PCFSoftShadowMap` is deprecated as of r186** — write `PCFShadowMap` now.

## 4.1 The governing rule

**"Make it feel dark, but don't actually make it dark."** Corollaries:
never apply flat ambient to all shadows (only *some* should reach zero —
contrast reads as night, not absolute darkness); **never bake darkness into
albedo**; avoid pure blue+orange, add a third accent hue.

## 4.2 Tinted shade — never black

The single most transferable line from `brunosimon/infinite-world`:

```glsl
vec3 shadeColor = baseColor * vec3(0.0, 0.5, 0.7);   // shade goes CYAN/BLUE
return mix(baseColor, shadeColor, sunShade);          // sunShade = dot(N,-L)*0.5+0.5
```

**Black shadows are the #1 thing that makes a night scene read as "broken
renderer" rather than "moonlight."** Make this deep blue/violet for MOONREST.

## 4.3 Rim light — the readability mechanism

```glsl
float rim = pow(max(0.0, 1.0 - dot(normalize(-vPos), normal)), rimPower);
```
Bias toward the moon (`* saturate(dot(N, -lightDir))`) so it reads as backlight,
not a glow shell. In near-black scenes this is not a flourish.

## 4.4 Baked lightmaps — highest quality per frame cost

⚠️ **The attribute is `uv1`, NOT `uv2`.** Modern three selects UV sets
per-texture via `texture.channel = 1`. glTF `TEXCOORD_1` maps automatically.
Every older tutorial gets this wrong and it fails silently.

AO touches **indirect light only** (`reflectedLight.indirectDiffuse *= ao`) —
correct here, since it darkens the hemisphere floor without double-darkening
moonlight. Lightmap **adds to irradiance**, so it stacks with the hemisphere
light; tune the pair together.

Options: Blender Cycles bake → glTF (primary, see `ASSETS.md`); **vertex-color
AO** (no UVs at all, often sufficient for low-poly — **try this first**);
`three/addons/misc/ProgressiveLightMap.js` for runtime accumulation without a
DCC round-trip.

**Contact/blob shadows are non-negotiable** — in a dark scene the real shadow
is often invisible, and a soft ellipse is what stops everything floating.

---

# 5. FOG — THE PRIMARY SCALE TOOL

Íñigo Quilez: *"Without fog it's not easy to tell the scale of the terrain.
With fog we immediately understand the size."* **Fog is a scale instrument.**

```glsl
// height fog — density a*exp(-b*y), analytically integrated
float fogAmount = (a/b) * exp(-ro.y*b) * (1.0 - exp(-t*rd.y*b)) / rd.y;

// inscattering — fog shifts toward the moon when you look at it
float m = max(dot(rd, moonDir), 0.0);
vec3  fogColor = mix(nightBlue, moonPale, pow(m, 16.0));   // 16–32 = tight halo
```

Height fog costs one extra divide and delivers the whole "valleys drown in
mist, towers stand clear" read. Implement via `three-custom-shader-material`,
not fragile `onBeforeCompile` chunk patching.

⚠️ **Built-in fog does not affect the skybox** — match `scene.background` to
the fog color or heavy fog gives a fogged world under a crisp sky.

## 5.1 Sky-render-target fog — the best trick found

From `infinite-world` (study-only license — **reimplement, don't copy**):
render the sky into a **separate render target at 0.1× resolution**, then in
every material sample it by screen UV and mix toward it:

```glsl
vec3 fogColor = texture2D(uFogTexture, screenUv).rgb;
float fogIntensity = 1.0 - exp(-uFogIntensity * uFogIntensity * depth * depth);
return mix(baseColor, fogColor, fogIntensity);
```

**The fog color IS the sky behind that exact pixel** — distant geometry
dissolves into the true sky gradient, moon glow and all, instead of a flat
constant. Costs one 0.1× render target. For a night game this is worth more
than any post-processing pass.

## 5.2 Fog behind silhouettes

Left 4 Dead added **light-colored fog** specifically because playtesters
couldn't read shapes against dark backgrounds — explicitly less realistic, but
*"it meant playtesters could see attackers in the distance."* A slightly
lighter fog band at mid-distance turns every foreground object into a legible
silhouette. Cheapest readability fix in a dark game.

---

# 6. TERRAIN

**The decision that constrains everything: bake heights on the CPU. Do not
displace only in the vertex shader** — the CPU would have no idea where the
ground is, raycasts hit the undisplaced plane, and bounding volumes go wrong.

Architecture: author a heightmap offline → load into a `Float32Array` →
CPU-displace **chunked** `PlaneGeometry` (free per-chunk frustum culling,
per-chunk `computeVertexNormals()`) → **collision = analytic bilinear sampling
of that same array** (O(1), no allocation, surface normal free via central
differences). The array is the source of truth; mesh and collider both derive
from it.

**The shaping knob that matters most** (from `infinite-world`):
```js
elevation = Math.pow(Math.abs(elevation), power) * Math.sign(elevation)
```
That power curve is what turns noise mush into ridges and plateaus.

**LOD seams: use skirts, not stitching.** Duplicate each chunk's border
vertices pushed **down 15 units** to form a vertical apron; cracks between
different-LOD neighbours hide behind it. Compute normals from an "overflow"
grid one row/column larger so edge lighting doesn't seam.

**Skip LOD terrain libraries for v1** — at night, heavy fog collapses the far
field into silhouette, which is the exact thing LOD exists to solve. Spend the
budget on the near field.

**Triplanar** (stops stretched cliff textures) via
`three-custom-shader-material`, writing **`csm_DiffuseColor`** (not
`csm_FragColor`, which bypasses lighting). Costs 3× texture fetches —
**mitigate by blending it in only on slopes**: `smoothstep(0.6, 0.85, 1.0 - n.y)`.
Normal maps are the hard part; read Ben Golus, *Normal Mapping for a Triplanar
Shader*. Use **height-based blending, not linear `mix()`** — linear gives muddy
50/50 mush.

**Noise:** `simplex-noise@4.0.3` + `alea@1.0.1` for a **seeded, reproducible**
world (terrain and grass scatter must agree across reloads). Avoid `noisejs`
(npm frozen since 2013).

⚠️ **Gaea Community is free but marked ✗ for commercial use.** Blender's ANT
Landscape is GPL, free, and commercially unrestricted — use that.

---

# 7. VEGETATION

## 7.1 Grass — per-blade geometry, not alpha cards

Decisive for **this** art direction: at night albedo barely registers; what the
player sees is **silhouette edge + rim**. Alpha cards blur into mush in
silhouette and their edges **crawl badly against a bright moonlit sky** — the
exact worst case. Blade geometry gives crisp silhouettes, is fully opaque
(early-Z works, no sorting, no alpha-test shimmer), and costs ~7–15 verts.

**Start from `simondevyoutube/Quick_Grass` (MIT, shippable)** — implements the
Ghost of Tsushima GDC approach: per-blade tapered geometry, tiled LOD rings,
vertex wind, and **view-dependent blade widening** so distant blades don't
flicker to sub-pixel noise.

Ideas worth stealing from `infinite-world` (reimplement — study-only license):
- **Infinite grass via modulo** in the vertex shader — a fixed 40k budget that
  never grows, recentred on the player each frame.
- **Distance falloff by scaling blades to zero, not alpha-fading** — no
  blending, no sorting, no popping.
- **`tipness` free from the vertex ID**: `step(2.0, mod(float(gl_VertexID)+1.0, 3.0))`
  — only the tip moves, so the blade *bends* rather than slides.
- **The terrain shader recomputes the identical grass attenuation and blends
  the same two colours**, so ground and grass match exactly at the draw
  boundary and the transition is invisible. This is the trick.

**Night-grass lighting model** (no repo gives you this):
- **Wrapped diffuse** `saturate((dot(N,L) + 0.5) / 1.5)` so blades facing away
  aren't black.
- **Back-scatter** `pow(saturate(dot(V,-L)), p)` — grass is thin, the moon
  behind it should glow *through*. **This is the effect that sells the scene.**
- Rim tinted moon-blue, strongest at tips; vertical dark-base→light-tip
  gradient. Keep albedo near-black and let rim + back-scatter do the work.

## 7.2 Trees and props

**`dgreenheck/ez-tree`** (MIT, active) — procedural trees, exports GLB, and
`generateLODs()` bakes every level into the file. **Use as a build-time asset
generator, not a runtime dependency.** Dead/gnarled presets are exactly
dark-fantasy silhouette material. ⚠️ Avoid `proctree.js` — no license file.

**`@three.ez/instanced-mesh@0.3.16`** (MIT, very active, pin it) for trees and
props: raw `InstancedMesh` culls as **one** bounding sphere, so a world-spanning
instance is *never* culled. This adds per-instance frustum culling, BVH
raycast, LOD, and **`addShadowLOD()`** — cheaper geometry in the shadow pass,
the standout feature when one moon light shadows all vegetation.

Use **plain chunked `InstancedMesh` for grass** (one geometry, no per-instance
uniforms, no shadows — the extra features are wasted).

## 7.3 Foliage rules

- **Alpha test (`alphaTest = 0.5, transparent = false`), never alpha blend.**
- **`castShadow = false` on all grass** — the shadow pass alone kills you and
  self-shadowing is invisible at night.
- Shadow pass must run the same alpha test or you get solid-quad shadows → set
  `customDepthMaterial`.
- **Wind: layer three frequencies** — slow world-space gust field (whole
  regions lean together; this sells scale), mid per-plant sway, high per-blade
  flutter. **Never phase-offset by `instanceIndex`** — grid ordering produces
  marching waves; hash the world position. **Bend around the base, don't
  translate**, or blades stretch.
- **Scatter:** Poisson disk for trees/rocks; stratified jitter grid for grass.
  Drive both from the **same slope/altitude/noise masks as the terrain splat
  weights** so grass appears exactly where the grass texture is — highest-value
  coherence trick available.

---

# 8. WATER, SKY, SHADERS

**Water: write a custom material.** `Water.js` is normal-map-only Blinn-Phong
and costs a full extra scene render; `Water2.js` costs two. **Neither does
foam, shorelines, or geometric waves** — the three things this target lives on.
⚠️ `Water.js` defaults `fog: false`, so water visually detaches from the scene.

**The high-value technique — depth-based shoreline foam:** render the scene
without water into an RT with a `DepthTexture` (⚠️ **MSAA and depthTexture are
incompatible on WebGL2 — `samples: 0`**), then:
```glsl
float shore = 1.0 - smoothstep(0.0, uFoamDistance, sceneZ - waterZ);
float foam  = step(shore - noise*0.25, uFoamCutoff);   // hard edge = stylized
```
One `shore` value drives foam mask + opacity ramp + shallow/deep colour lerp,
and gives soft intersection alpha free. **Two foam bands** at different cutoffs
read far better than one. Add 3–5 summed Gerstner waves with a crest term as a
second foam mask.

**Sky: don't use a physical model.** Core `Sky.js` is Preetham and is
**structurally broken below the horizon** — no moon, no stars. Build instead: a
hand-authored gradient dome (**`dithering = true`** — this is exactly the smooth
dark gradient that bands) + a **real star field from the Yale Bright Star
Catalogue** (public domain, ~9,110 stars to mag 6.5; RA/Dec → spherical, size
from magnitude, colour from B−V — real constellations are worth it for a "look
up" beat) + a billboard moon in the bloom `Selection` + the directional light
aimed from it. Anti-shimmer: clip sub-pixel points offscreen rather than
drawing them (`if (gl_PointSize < 0.5) gl_Position = vec4(2.0);`).

Palette from `infinite-world`'s night sky, a good starting point:
`uColorNightLow #004794`, `uColorNightHigh #001624`.

**Clouds:** drei `<Cloud>` is billboard-based, cheap, and reads stylized —
genuinely good here. ⚠️ It hotlinks a CDN texture by default; self-host.

**Shader authoring:** `three-custom-shader-material@6.4.0` is the backbone —
terrain triplanar, grass wind, water and height fog all route through it while
keeping three's lighting, shadows, fog and tone mapping.

⚠️ **Vertex-displaced geometry needs matching depth materials or its shadows
won't match its silhouette.** Attach three CSM instances sharing one uniforms
object: the material, plus `customDepthMaterial` (`MeshDepthMaterial`, for
directional/spot) and `customDistanceMaterial` (`MeshDistanceMaterial`, **for
point lights — the one everyone forgets**).

⚠️ `csm_Roughness`/`csm_Metalness`/`csm_AO`/`csm_Emissive` are **silent no-ops
unless the base material has the corresponding map slot populated** — assign a
1×1 white texture to `roughnessMap` for procedural roughness. `csm_Bump` was
removed in 6.4.0; use `csm_FragNormal`.

---

# 9. 🚨 LICENSE TRAPS

| Thing | Problem |
|---|---|
| **lygia** | **Prosperity Public License 3.0.0 — 30-day commercial trial only.** The most-recommended GLSL library on the web and a genuine commercial trap. **Use `stegu/webgl-noise` (MIT) instead** — vendor the `.glsl` files with their header. |
| **Shadertoy ports** | Default **CC BY-NC-SA — non-commercial.** Verify per shader. |
| **`brunosimon/infinite-world`** | **No LICENSE file → all rights reserved. STUDY ONLY.** Reimplement from understanding; do not copy code. Same for `my-room-in-3d`, `proctree.js`, `spacejack/terra`. |
| **`three-good-godrays`** | License NOASSERTION. Resolve before shipping. |
| **Sketchfab `by-nd`** | **Blocks distributing modified models** — fatal, since you'll decimate everything. Filter to CC0. |
| **itch.io** | Licenses are creator-declared and unverified. Read every pack page. |
| **Sonniss GDC bundles** | Free and commercial-safe for the game, but **bans AI/ML training** and redistribution of raw files. |
| **Freesound** | Mixes CC0, CC-BY, **CC-BY-NC** and legacy Sampling+. **Always apply the CC0 filter.** |
| **Incompetech** | CC-BY — attribution mandatory, not drop-in. |
| **FreePD.com** | **Permanently closed in 2025.** Dead source. |
| **Gaea Community** | Free tier marked ✗ commercial. |
| **Blockade Labs free tier** | Check current commercial terms per tier. |

---

# 10. VERIFIED CC0 ASSET SOURCES (zero attribution, commercial-safe)

| Source | Contents | Notes |
|---|---|---|
| **Poly Haven** | 980 HDRIs · 785 textures · 521 models | *"You do not need to give credit."* ⚠️ The site is a JS SPA — **scrape via `api.polyhaven.com`**, e.g. `/assets?t=hdris&c=night` (59 night HDRIs). Every HDRI ships .hdr + .exr at 1k–16k. **Use 2k .hdr.** |
| **ambientCG** | 2,004 materials · 2,872 models · 416 HDRIs | CC0. API: `/api/v2/full_json?type=Material&category=Rock`. **Use 1K/2K JPG.** |
| **Quaternius** | Stylized low-poly packs | CC0. ⭐ **Ultimate Modular Ruins + Ultimate Stylized Nature + Modular Dungeons** is basically the whole dark-fantasy kit in one style. |
| **Kenney** | Nature Kit (330), Graveyard Kit (90), Castle Kit, Fantasy Town Kit | CC0, only restriction is the logo. ⚠️ `medieval-town-kit` is a 404 — it's **fantasy-town-kit**. |
| **KayKit** (kaylousberg.itch.io) | Dungeon Pack (200+), **Skeletons**, Forest Nature, Character Animations | CC0, *"no attribution required."* **Ships glTF**, single 1024² gradient atlas — extremely three.js-friendly. Go through itch.io; the .com pages are JS-rendered. |
| **Kenney Audio** | RPG Audio (50), Impact Sounds (130) | CC0 — covers footsteps/foley/UI with zero legal work. |
| **Freesound** | 377,947 CC0 sounds | **Filter:** `/search/?f=license%3A%22Creative+Commons+0%22` |

## Recommended night HDRIs (all CC0, real slugs)

`kloppenheim_02_puresky` (sky-only, crisp stars + moonlight bloom) ·
`moonlit_golf` · `rogland_moonlit_night` · `narrow_moonlit_road` ·
`dikhololo_night` (Milky Way, the classic) · `moonless_golf` (most-downloaded
night HDRI on the site) · `kloppenheim_04` (**fog/mist over field** — great for
volumetrics) · `courtyard_night` (brick, lamp — village fit).

**Pattern: a `_puresky` as `scene.background`, a full-ground night HDRI as
`scene.environment`.** Tune `scene.environmentIntensity` rather than
pre-darkening the HDR — keeps precision.

---

# 11. PERFORMANCE

**`@gltf-transform/cli@4.4.2`** is the biggest win per hour spent:
```bash
gltf-transform inspect in.glb                       # find the bottleneck first
gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp
```
`join` (draw-call reduction) and `instance` are the two most underused.

**Prefer meshopt over Draco** for geometry — much faster decode, and its
`simplify()` is your build-time LOD generator. **KTX2/Basis is the real texture
win** — GPU-resident compressed textures cut VRAM 4–8×; WebP only shrinks the
download.

Other traps: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` (uncapped
DPR on a 3× phone is a 9× fill-rate bill); `antialias: false` when
post-processing; share materials aggressively (program explosion); keep foliage
opaque via alpha test to avoid transparency sorting.

**Profiling:** `renderer.info.render.{calls, triangles}`, `stats.js`, and
**Spector.js** for frame capture. There is no GPU timestamp API on
`WebGLRenderer`.

---

# 12. ARCHITECTURE & WORKFLOW

**Vanilla three.js for the game canvas, React for menus/HUD.** Every
great-looking reference project (`infinite-world`, `Quick_Grass`,
`Quick_3D_RPG`, `Sketchbook`) is vanilla. R3F's reconciler sits in the hot path
of a simulation, and per-frame allocation inside `useFrame` feeds the GC, which
reads as stutter. Mount a plain three.js module that owns its own
`requestAnimationFrame` loop into a canvas ref; render React UI above it.

**Copy `infinite-world`'s State/View split** — simulation separate from
rendering, singleton managers, explicit update order. ~50 lines of architecture
that scales fine for this genre. **Skip ECS** — premature for a game whose
entity count is low and whose per-entity craft is high.

**`lil-gui` on day one, not later.** Wire every colour, fog density, bloom
threshold, exposure and light intensity into folders. **Dialling a night
palette is a hundred micro-adjustments**; working without live sliders will
cost more time than anything else on this list.

**Text:** `troika-three-text` for world-space diegetic text (SDF, stays crisp
at any angle). **HUD in React DOM over the canvas** — flexbox, real text
rendering, accessibility, hot reload, all free. ⚠️ `three-mesh-ui` is
unmaintained since 2023; don't adopt.

**Audio:** Howler for music/ambience/UI, `THREE.PositionalAudio` only for
genuinely spatial diegetic sources. For adaptive ambience run 3–4 looping stems
simultaneously at different gains and cross-fade the gains — cheaper and more
robust than stitching clips.

**Stale — do not build on:** Theatre.js (2 years), `three-mesh-ui`,
`three-landscape` (3 years), `felixpalmer/lod-terrain` (8 years),
`realism-effects`, `screen-space-reflections`, `glslify` (4 years — use
`vite-plugin-glsl`).

---

# 13. PROJECTS WORTH STUDYING

| Project | License | Why |
|---|---|---|
| `simondevyoutube/Quick_Grass` | **MIT** | Ghost of Tsushima grass. **Shippable.** |
| `thebenezer/FluffyGrass` | **MIT** | Chunked instancing to ~1M blades; stylized non-PBR shadow-colour lerp |
| `brunosimon/infinite-world` | **none — study only** | Closest single reference to this target: sky-RT fog, tinted shade, modulo grass, quadtree terrain |
| `dgreenheck/ez-tree` | **MIT** | Procedural trees + LOD export |
| `swift502/Sketchbook` | **MIT** | Character state machine (ignore its dead physics) |
| "A forest of octahedral impostors" (three.js discourse) | — | End-to-end blueprint: 200k trees, mobile-capable |

**Official examples are the best technique reference:** `webgl_shadowmap_csm`,
`webgl_shadowmap_progressive`, `webgl_postprocessing_unreal_bloom_selective`,
`webgl_postprocessing_3dlut`, `webgl_batch_lod_bvh`, `games_fps`,
`physics_rapier_character_controller`.

**Maxime Heckel's blog** is the best long-form three.js shader writing
available — volumetric lighting, raymarching, render targets.

---

# 14. ART DIRECTION, FROM PRIMARY SOURCES

From developer interviews, GDC talks and technical postmortems. These are the
techniques the actual teams described, ranked by look-per-unit-work.

## 14.1 Scene boxes — author light per-zone, not per-light ⭐ highest leverage

Shadow of the Colossus placed **trigger volumes across the whole map**, each
carrying exposure, bloom amount, fog colour and tint. Crossing a boundary
**lerps between two volumes' parameters** — that is the entire "dynamic tone
mapping," no histogram, no eye-adaptation sim.

Lead programmer Sugiyama, on the cost: *"The downside… is that the time taken
on the production side to set the boxes up is very high."* Worth it: one
artist-facing struct gives you SotC's whole tonal range at zero realtime
lighting cost. **Build this system first.**

## 14.2 Bloom masked by the silhouette, computed at 64×64

SotC's pseudo-HDR, verbatim from the technical article:

1. Composite foreground over distance **using the Z-buffer as a mask**.
2. Generate a separate image of that mask.
3. **Reduce to 64×64 with a bilinear filter.**
4. **Blend in the previous frame's result** at a per-scene-box percentage.
5. Expand back up bilinear → *"the distant view starts bleeding out from the
   shape of the foreground."*

**The bloom is driven by a silhouette mask, not a luminance threshold** — which
is why Wander reads as a dark cutout with light eating his edges. The
previous-frame blend gives you eye adaptation *and* afterglow for free. The
afterglow was originally **an accidental artifact of step 4 that they
parameterised and shipped**.

## 14.3 Journey: no dynamic shadows at all

Art director Matt Nava: *"Journey had no automatic shadows. I painted them all
by hand. The shadow texture was not hi-res. To get the iconic sunset columns to
cast sharp shadows, **I made sure that they aligned with the pixel grid of the
texture**."*

He didn't fight the low resolution — he aligned the geometry to its texel grid
so low-res became *crispness* instead of mush. If you must have one dynamic
shadow, make it a blob under the player.

## 14.4 The glitter shader (sand, snow, water, magic)

```glsl
vec3 G = normalize(texture2D(uGlitterTex, uv).rgb * 2.0 - 1.0); // random grain normal
vec3 R = reflect(L, G);
float RdotV = max(0.0, dot(R, V));
if (RdotV > uThreshold) return vec3(0.0);
return (1.0 - RdotV) * uGlitterColor;   // output MUST exceed 1.0 so bloom halos it
```

Three rules: threshold **hard** so glitter is rare; output **above 1.0** or
bloom can't smear it (a normal map can never exceed 1, which is why normal
mapping alone can't do this); use `reflect()` **not raw noise**, or the sparkle
crawls between frames.

## 14.5 Rim light is a readability device, not a beauty device

Journey's stated purpose for its Fresnel rim: **stop dunes from disappearing
into the horizon.** Same reason it matters here — it separates silhouettes from
backgrounds and does the work AO and GI otherwise would.

## 14.6 Don't write a toon shader

**RiME and Season independently reached the same conclusion.** RiME's technical
artist: *"the game's visuals are not cel-shaded, but an adaptation of UE4's PBR
materials."* The stylised read comes from *"maintain[ing] the noise frequency as
low as possible by implementing big masses of colour."*

Season's reason is decisive: cel-shading *"gets rid of many details, but you
don't have control over which details you get rid of."* Their formula:
**realistic geometry, illustrative texturing.**

**Use PBR with low-frequency colour masses + restrained texture detail + good
light.** Far fewer edge cases than NPR, and it's the cheaper path.

## 14.7 Ban pure black; tint shadows with local colour

RiME's rule, from Sorolla: *"a light that embraces it all with pastel colors,
**where black does not exist**."* Season tints shadows by nearby colour,
*"mimicking traditional painting techniques."* Costs one lerp and instantly
reads painted rather than rendered.

Season's honest failure, worth knowing: *"Having no secondary or bounce light
proved to be a bit of an issue and made some volumes harder to read in areas
covered in shadows."* This is what baked lightmaps (§4.4) buy you.

## 14.8 Sable's distance-faded outlines — one parameter, two problems

Outlines fade opacity with distance, which mimics comic line-weight falloff
**and** *"disguises objects as they fade in,"* killing LOD pop-in. Their
layered fix for flat-shading's lost depth cues: **lighting/shadows → distance
fog (*"really, really key"*, per-biome) → outlines.**

Also: Sable holds character animation for **5 frames (~12fps) while the world
and camera run at 60**. Nearly free performance that reads as hand-drawn — but
only works because the camera stays smooth.

## 14.9 Breath of the Wild's triangle rule — free level design

*"Using triangles carries out 2 objectives — gives players a choice as to
whether to go straight over the triangle, or around; and it obscures the
player's view."*

- **Large triangles** → landmarks and wayfinders.
- **Medium** → block the view so content reveals progressively.
- **Small** → tempo and texture.
- **Rectangles** → *total* concealment (surprise), where triangles give partial
  reveal (curiosity).
- **Irregular peaks/divots marked hidden rewards** — players followed it without
  consciously noticing.

Works at any scale. Also from BotW: artists started with **200+ exposed
parameters and cut to ~50 essentials**, then got 1,440 distinct looks from
time × weather combinations. Two or three orthogonal axes make a small world
feel far larger.

And the permission slip, from art director Takizawa: *"injecting humor into the
visual shorthand helps players forgive the break from reality."* **Comedy is
the lubricant that lets you cheat.**

## 14.10 Scoping doctrine — emptiness is a budget strategy

**Sable's "islands of content":** they set the game in a desert *because they
knew they couldn't detail an open world at that scale*. Concentrate authored
detail in nodes; let the space between *"breathe."* The emptiness is
simultaneously the aesthetic and the budget plan.

**SotC's LOD doctrine:** distant terrain decimated to 1/30–1/100, but *"we
usually try and spread it around the landmark which represents that area"* —
**spend the polygon budget on the silhouette that identifies a place.** And
**colossi are exempt from LOD entirely**: the thing the game is about keeps
full fidelity at any distance. Pick your one or two exempt objects.

**Ueda's subtraction rule:** *"If something felt unfinished or lacking, then
I'd remove it."* Note the inversion — unfinished means *remove*, not *finish*.
ICO's shadow enemies exist because detailed warriors were too expensive **and**
too visually noisy; a pure-black silhouette was cheaper, more readable, and
became the theme.

**Tunic's counter-warning**, the trap in the other direction: *"If you go too
detailed, it doesn't look like Tunic anymore, and if it's not detailed enough,
it doesn't look like a finished thing."* Find that band early and hold it.

## 14.11 Two free tricks

**Motion blur buys framerate forgiveness.** SotC shipped with 15–60fps variance
and *designed around it*: *"the motion blur helps to smooth over this, and the
player's sensation of frame rate changes is held down to a minimum."* In a
browser, where frame times are unpredictable, this is disproportionately
valuable.

**Facelessness deletes an entire discipline.** Ashen's characters have no faces
— framed as a co-op design choice, but it also removes facial rigs,
blendshapes, lipsync, face texturing, and all uncanny-valley risk.

## 14.12 Cheap shading hacks worth stealing

- **"Fairy shader"** (SotC's fake subsurface): when the light is behind an
  object and the camera faces it, push the rim toward white with a simple
  anisotropic term. Strength is **designer-selected per situation**, not
  physical. Makes characters read as flesh rather than plastic.
- **Shells + fins** for fur and grass: 3–6 extruded shell layers *plus*
  perpendicular fin quads. *"The layered fur shells are easily visible at a
  sharp viewing angle, and the extra hair fins are equally visible at the
  opposite angle"* — the two techniques' failure modes are orthogonal, so they
  cover each other. SotC reused the identical system for grass. ⚠️ Watch fill
  rate; this is the one technique here that costs real overdraw.
- **Shadow proxy meshes at 1/40th poly count**, and make the face proxy a solid
  blob so it never self-shadows — *"it would look visually unpleasing."*
- **Camera motion blur on the world but never on the character** — *"the
  character would become too blurred and vague, which… hinders gameplay."*

## 14.13 The process lesson

Ueda **prototyped every effect himself in LightWave first**, then handed it to a
programmer. The article's closing thesis: the stylisation *"wasn't just
something to show off the technology… this was something that was planned from
the design side to create a consistent visual look."*

Decide the look, then implement it. Not the reverse.

---

# 15. ANIMATION, TEXT & UI

## 15.1 ⚠️ three.js docs URLs changed in r185

The old `threejs.org/docs/#api/en/...` scheme is **dead** — r185 replaced
hand-written docs with JSDoc-generated pages, and old deep links **silently
fail** (the SPA shell still returns 200). New scheme:
`https://threejs.org/docs/pages/<Name>.html`, with a `module-` prefix for
addons (`module-SkeletonUtils.html`). Machine-readable `docs/llms.txt` and
`docs/llms-full.txt` now ship in the repo.

## 15.2 Mixamo — alive, free, but archive your evidence

Verified today: mixamo.com is up, the auto-rigger is intact in the shipped app
bundle, and FBX download options are unchanged. **No discontinuation notice
exists** — the sunset banner in the app is for **Adobe Aero**, a different
product, and is easy to misread. Adobe Fuse, by contrast, is genuinely dead.

⚠️ **The licensing thinness is real.** The commercial-use grant rests on an FAQ
page whose own byline reads *"Last updated on Sep 14, 2021"*, and the footer's
Terms link points to Adobe's **generic** ToU, not a bespoke asset license. On
download day, archive a PDF of the FAQ licensing sentence, the URL, the date,
and your Adobe account ID. Ten minutes, and it's the difference between "we had
a license" and "we think we did."

Also: **biped humanoids only** (no quadrupeds or winged creatures), and Mixamo
stores **only the last uploaded character** — save rigs locally. Download once,
commit the files; do not build a pipeline that assumes Mixamo exists at build
time.

## 15.3 Additive blending — the highest-leverage animation feature

```js
THREE.AnimationUtils.makeClipAdditive( clip );   // mutates in place, then:
mixer.clipAction( clip );                        // picks up AdditiveAnimationBlendMode
```

Layer additive clips over a normal locomotion base — `wounded_lean`,
`head_look`, `shiver`, `torch_carry`, `two_handed_grip`. Each costs one extra
action at a tunable weight and **multiplies apparent animation count without
new full-body clips.** Exactly what a small team needs.

**Keep additive layers out of the state machine.** Drive their weights from
continuous game values (health → lean, cold → shiver, aim → head look) with
lerps in the frame loop. That's what stops state explosion.

## 15.4 Crossfade footguns

`A.crossFadeTo(B, d)` fades **A out, B in**; `B.crossFadeFrom(A, d)` does the
same thing. Both require the incoming action to be `.play()`ed. **Pass
`warp = true` for locomotion blends** or walk→run foot-slides.

From three's own example comment: *"animationAction.crossFadeTo() disables its
start action and sets the start action's weight to zero"* — you must
`setEffectiveWeight()` and re-enable before reusing an action. Write a helper.

One-shot recipe: `reset()` → `setLoop(LoopOnce, 1)` → `clampWhenFinished = true`
→ `crossFadeFrom(prev, 0.2, true)` → `play()`, with a mixer `'finished'`
listener to return to idle — **and remove that listener on exit**, or you get
duplicate transitions. That is the classic bug.

`mixer.timeScale = 0` is the cheapest global pause for a menu.

## 15.5 Retargeting — `SkeletonUtils`, no dependency needed

`retarget()` and `retargetClip()` are in-tree and actively maintained; the API
gained `localOffsets`/`hipPosition`/`hipInfluence` recently, so **any tutorial
older than ~2024 is wrong**. Key options for Mixamo sources:

```js
{ hip: 'mixamorigHips',
  hipInfluence: new THREE.Vector3(0, 1, 0),  // strips horizontal root motion
  scale: 1 / targetModel.scene.scale.y,
  names: { mixamorigHips: 'mixamorigHips', /* … */ } }
```

⚠️ **The mixer root must be the `SkinnedMesh` itself**, not the model group —
getting this wrong is a silent no-op. And use **`SkeletonUtils.clone()`**, never
`object.clone()`, to spawn multiple skinned characters, or bones won't bind.

If every character comes from Mixamo with matching `mixamorig*` hierarchies,
you may not need retargeting at all — just share clips.

## 15.6 State machines — hand-roll it

**No maintained three.js animation-FSM library exists.** The pattern is ~80
lines: a state registry, `SetState(name)` that calls `prevState.Exit()` then
`new State().Enter(prevState)`, and a re-entry guard. **Passing the previous
state into `Enter` is the whole trick** — it's what lets the new state look up
the outgoing action and crossfade from it.

Keep FSM state in a plain class instance held in a ref; never re-render React
on an animation transition. Escalate to XState only if status-effect
combinations become genuinely combinatorial.

⚠️ drei's `useAnimations` has a latent cleanup bug — it passes an
`AnimationAction` where `uncacheAction` expects an `AnimationClip`, so the
uncache silently no-ops and the mixer cache grows as entities spawn and
despawn. Call `mixer.uncacheRoot(root)` yourself on despawn.

## 15.7 Text and UI

**HUD → plain React DOM overlay**, a *sibling* of the canvas, `pointer-events:
none` on the container with `auto` only on interactive widgets. Zero draw
calls, crisp at any DPI, real flexbox, accessibility and i18n for free. Put
game state in a store outside React and subscribe with **transient updates**
writing straight to refs, so a health tick never re-renders the scene graph.

**World-space text → `troika-three-text`** (via drei's `<Text>`). SDF-based,
one draw call per label, generated in a worker, resolution-independent — and
crucially it **patches three's materials, so text receives your lighting, fog,
shadows and post-processing.** Carved runes actually catch the torchlight.
Use `outlineWidth`/`outlineColor` for legibility against dark backgrounds,
pre-warm with the `characters` prop, and tune `sdfGlyphSize` (default 64).
Scales to hundreds of labels; DOM approaches do not.

**Interactive world-anchored prompts → drei `<Html>`**, sparingly, in the low
tens. Its `occlude` prop is the thing raw `CSS2DRenderer` structurally cannot
do: `occlude={[levelRef]}` raycasts (cheap, explicit), `occlude="blending"`
renders an invisible depth-writing plane so the element hides behind geometry
convincingly. Use `onOcclude` to fade rather than pop.

⚠️ **`CSS2DRenderer`/`CSS3DRenderer` have no depth participation at all** — a
label on an enemy behind a wall renders *through* the wall, and both require
100% browser zoom. DOM text also never receives your bloom or colour grade, so
it visually detaches from a moody scene.

💀 **`three-mesh-ui` is abandoned** — npm frozen 2023-03-24, repo untouched
since 2023-12-03, with a three-compatibility bug open since r153 and no
deprecation banner to warn you. For in-scene 3D panels use
**`@react-three/uikit`** (Yoga flexbox, MIT, actively maintained).

## 15.8 Cheap character polish

`@pixiv/three-vrm` as a whole is the wrong fit — it's a format library whose
headline feature is an anime cel shader. But **`@pixiv/three-vrm-springbone`
standalone** gives secondary jiggle physics for cloaks, hair, belts and chains,
which is a large cheap win for dark-fantasy character feel. Or write a verlet
bone-chain solver (~150 lines) that runs after `mixer.update()`.
