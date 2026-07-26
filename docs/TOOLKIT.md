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

---

# 16. ENVIRONMENT ART CRAFT

## 16.1 The three laws of believable placement

**Entropy does the placing, not you.** *"Dirt, rust, and destruction are not
textures; they are the result of events."* Water flows **down** and pools in low
spots — moss and staining form there. Dust settles on **horizontal** surfaces
only. Wind polishes exposed corners; sheltered corners collect debris. Scuffs go
**where hands touch**.

⚠️ **The corridor rule amateurs invert:** the **centre** of a path is worn and
polished from footfall; the **edges** are dirtier because cleaners miss them.
Most beginners do the opposite, or apply uniform grunge.

**Functional connectivity.** Every object must answer: how was it brought here,
how is it maintained, where does the power go? *"Believability is born not in
polygons, but in answers to 'How does this work?'"*

**From particular to general.** *"A chair isn't just standing there, it's pulled
back, someone was sitting there."* Props are placed by **usage logic, not grid
alignment.**

## 16.2 Clustering — and the spotted-dog rule

Anthony Vaccaro (Principal Environment Artist, Naughty Dog): *"Clumping assets
and creating negative space enhances your details and can lead the eye to your
objective."* But — **"always vary the size and distance of your detail clumping
or that will also just become evenly clumped noise like a spotted dog."**
**Even clumping is as bad as even scatter.**

*"The negative space in a sea of detail is what actually draws the player in —
it's the* lack *of detail."*

**Fractal placement:** place one element, then duplicate → shrink → rotate →
offset → repeat smaller. Works for rocks, trees, debris, crates alike.

**Rule of odds (3/5/7)** — odd groups can't resolve into pairs, so the eye
builds a hierarchy. **Triangle rule** — three objects at three heights and
depths. **Size hierarchy in every group** — large, medium and small present
within each of primary/secondary/tertiary tiers.

**The 70/30 rule:** *"At least 70% of your artwork as flat, filler, or negative
space. Leaving blank resting spaces can be as powerful as detailing."*

## 16.3 Story pockets

Stage **one dominant narrative prop + two supporting hints per room-sized
volume**. *"The story must survive a glance"* — players scan at walking speed,
they don't study.

Write the backstory **before** dressing. One artist stalled 3+ months in
blockout until he invented the backstory, after which every placement decision
became automatic. **Story is a blockout prerequisite, not a polish garnish.**

## 16.4 Value first, colour second

Block **light / mid / dark** in greyscale, lock the values, then swap greys for
hues. *"If it doesn't read desaturated, colour won't save it."*

**"Muddy" is a shape problem, not a colour problem.** It means forms aren't
readable — fix by increasing separation between value plateaus and hardening
boundaries, **not** by cranking saturation. Muddy midtones come from blending
every transition with a soft brush and from picking shadows by pulling the same
hue down in lightness (grey sludge).

**Never shade by lowering lightness on the same hue.** Shift along the wheel:
lit areas shift *toward* the light's hue, shadows shift *away* (toward ambient
blue-violet). **Saturation peaks in the midtones** — highlights desaturate
toward the light, deep shadows toward ambient.

**Build dark → light.** Adding white kills chroma; layering light over dark
preserves it.

## 16.5 Edge highlighting — the signature stylized move

**Lighten the base colour along convex edges.** Duplicate the base layer,
lighten, mask with a curvature map, tune contrast. Run it in **both albedo and
roughness**. Interior cracks must be **secondary** — edge highlights are the
loudest event in the texture. Avoid perfectly straight highlight lines; break,
taper and skip them. On trim sheets, bake the highlight into the strip so the
whole kit inherits it free.

## 16.6 Roughness and albedo discipline

**0.5 roughness is the worst possible value** — *"too shiny to read as matte and
too rough to read as reflective."* A scene built near 0.5 makes stone and
concrete look identical. Push every surface to its real value: concrete 0.8+,
polished metal 0.1, fabric 0.9.

**Albedo band: 50–243 sRGB.** Nothing absorbs 100% or reflects 100%; ~4%
dielectric specular alone accounts for roughly sRGB 50, so "pure black albedo"
is physically unreachable and reads as a dead void. Stylized work legitimately
runs **higher roughness than reality** so colour survives instead of being
washed out by specular.

**Material contrast is set dressing:** *"The beauty comes when you have a
reflective puddle on rough concrete, or a shiny polished shield laying on old
rotten wood."*

## 16.7 Foliage — the cardboard-cutout fix

⚠️ **This is the single biggest reason amateur foliage looks flat.** Default
flat-plane normals make every leaf card light as a plane — half the canopy goes
black and the plane structure shows as hard facets.

**Fix: transfer vertex normals from an enclosing sphere** (trees, bushes),
**dome** (small bushes), or **straight up** (grass). The canopy then lights as
**one mass** with a smooth terminator. With a dome, undersides catch light
instead of crushing to black. Do it with Blender's Data Transfer / Normal Edit
modifier — and if importing to an engine, make sure the importer **preserves
custom normals** rather than recomputing them.

Other card craft: **cut cards tight to the alpha** (every transparent pixel is
overdraw); vary **big / medium / small** card sizes (big = mass, small = edge
silhouette); twist and bend cards so they never read flat when orbited; keep
albedo bright enough that shadowed foliage never crushes to black.

## 16.8 Trees

**The broccoli tree** — one blobby hemisphere on a straight stick — comes from
uniform card distribution, no sub-clusters, no sky holes, no trunk taper, and
all branches at the same angle.

**Fix:** canopy as **3–7 discrete clusters separated by sky holes**; varied
cluster sizes; asymmetric mass (heavier toward light); trunk with taper, curl,
lean and a **root flare** (without it, it's a pole in the ground); branch angles
that widen further down the trunk.

**Study the winter silhouette** — you cannot invent real branching from a
leafed-out photo.

## 16.9 Forests — the botany amateurs get backwards

- **Trunk density beats canopy density.** *"We reach our desired canopy density
  long before our desired trunk density. So what can you do? **Add trunks
  without canopies.**"* Dead bare trees are far cheaper (no leaf cards) and *"a
  large percentage of the trees in a real forest are dead with no leaves."*
  **This is the cheapest way to make a forest feel dense.**
- **The forest EDGE is the densest, bushiest part** (light hits the side wall);
  the interior is comparatively **open**. Getting this backwards — dense
  interior, clean edge — is a classic tell.
- **Tall grass under a closed canopy is a giveaway.** Real forest floor is
  litter, duff, deep moss, ferns and bare needle mat. Light is the limiting
  resource down there.
- **Nurse logs:** seedling density is ~4.6× higher on fallen logs than on soil.
  Put saplings, moss and fungi *on* logs and stumps, not evenly scattered.
- **Small plants grow at large plants' bases** — conveniently hiding the ugly
  trunk-to-ground intersection.
- **Lower trunks deserve extra texel density** — players look at eye level and
  slightly down.
- **Decide water first.** *"If you get to the end of a forest hike without
  seeing any water, it was probably a boring hike."*

## 16.10 Grass grounding checklist

1. Sink the clump base 2–5 cm below the surface.
2. **Darken the base** with vertex AO — a fake contact shadow.
3. **Blend base colour toward the terrain colour.**
4. Add a **ground-clutter transition layer** — leaf litter, twigs, pebbles,
   moss, dead flattened grass.
5. Never place single blades — build **clumps of 5–20**.
6. **Voronoi clumping** (Ghost of Tsushima): group blades into clumps sharing
   height, bend and colour so the field reads patchy rather than statistically
   uniform. This is the named fix for "carpet grass."

## 16.11 The green-mush cure

Diagnose in order: uniform hue → uniform value → uniform density → **no macro
variation** (variation only at 1–2m, never at 20–100m) → no non-green elements
→ no atmosphere.

Fixes, most effective first: **force the understory dark** (bright canopy top
over dark base reads as mass instantly); author 2–3 hue targets per biome and
lerp by world-position noise; place **1–3 oversized hero trees** per view as
anchors; add clearings and sky holes; add dead/brown elements; push
atmospheric perspective (distant trees cooler, bluer, lower contrast); break
with non-green (rock, dirt, water, trunks, mist); add drifting particles for
**parallax**, which the eye reads as depth.

## 16.12 Readability failures that break gameplay

From Frozenbyte's internal level-art manual — the best public list of these:

- **Art hides something important** — a handrail over the button, bushes over a
  ledge.
- **Colour collision** — *"Don't use the same colour for decorative pieces and
  gameplay elements."*
- **False promise of function** — a doorway you can't enter, a ladder you can't
  climb. *"Level art shouldn't invite the player to a place they cannot
  enter."* Never use interactive-object assets as decoration.
- **Path-of-least-resistance inversion** — the secret area looks like the main
  route and vice versa. Watch where the warm light points.
- **Plausibility** — a platform with no visible support.

And the studio's greyscale law: *"If an image doesn't look good and clear in
greyscale, it will not work in colour mode either."* Plus the depth rule:
**closer = more contrast, further = less.** Distant objects reading at
play-plane contrast is *the* classic level-art bug.

## 16.13 Process

**Blockout's purpose is NOT to finish, NOT to make it pretty, NOT to texture,
NOT to light and NOT to detail.** Everything before layout lock is cheap;
everything after is expensive.

**Lighting comes early**, during or just after blockout — it's a readability
and gameplay tool, not decoration. Four passes: global → wayfinding hierarchy
(major exits lit more prominently than secondary) → gameplay lights → mood.
**Post-process is genuinely last** — *"Post Process is in the name. It's
post."* Grading early makes you overcompensate the lighting.

Frozenbyte's time split per level: **base art 60–70%, detailing 20–30%,
polish 10–20%.** *"If the base art is lacking, nothing works."*

**Reference discipline:** *"Don't use reference in someone else's style. Use
real images, or you'll copy other people's mistakes."* Referencing another
artist's finished 3D scene inherits their style **and** their errors.

---

# 17. THE PRE-SHIP CHECKLIST

Run this on every scene before calling it done. **Items 1–5 are free and catch
most problems.** The judge should run this verbatim.

**Read & composition**
1. **Greyscale pass.** Desaturate. Does it resolve into 3–4 clear value masses?
   Does the focal point still dominate?
2. **Squint / blur pass.** Blur heavily. Does anything unimportant still shout?
   Does the eye land where intended within one second?
3. **Thumbnail pass.** View at ~200px. Does the light/dark pattern survive or go
   to grey mud?
4. **Flip horizontally.** Does the composition still balance? Proportion errors
   you'd normalised will jump out.
5. **Depth check.** Distinct foreground, midground, background? Does contrast
   *decrease* with distance? Any tangents to break?

**Scale & grounding**
6. **Human-scale audit.** Drop the character in; check doorways, stairs,
   railings, ceiling height. Judge from the *player* camera, never a fly-cam.
7. **Grounding audit.** Nothing floats. Props buried 30–60% or given a sculpted
   seam, debris skirt, contact-shadow darkening and transition blend.
8. **Off-grid audit.** Anything organic at exactly 0° yaw or on a grid interval?
   Break every perfect 90° in the big forms.

**Detail & placement**
9. **70/30 audit.** Is ~70% flat/filler/negative space? Are there deliberate
   eye-rest spots?
10. **Clump audit.** Varying cluster size *and* spacing (not spotted-dog)? Odd
    groups? Large/medium/small present in each tier?
11. **Repetition audit.** Walk the space looking only for the same silhouette
    twice.
12. **Hero audit.** One clear focal point per view, lit, with everything else
    subordinate?

**Story**
13. **Use-logic pass.** Where would a person walk, touch, sit, lean? Is the path
    centre worn and the edges dirtier?
14. **"How does this work?" pass.** Anything you can't answer for gets justified
    or deleted.
15. **Story-pocket pass.** One dominant prop + two hints per volume. Show
    someone the shot for five seconds and ask what happened here.

**Materials & light**
16. **Material-contrast pass.** Anything matte beside something reflective? Push
    every surface off 0.5 roughness.
17. **Albedo sanity pass.** Anything below 50 or above 240 sRGB? Is albedo doing
    lighting's job?
18. **Lighting pass.** Exposure clamped before judging. Solo each light — does
    it earn its place? Is every light **motivated** by a visible fixture? Is
    there fill so shadows aren't crushed?

**Readability & tech**
19. **Gameplay-readability pass.** Does art hide anything important? Do
    decorative assets share colour or silhouette with interactive ones? Any
    false promises? Is the intended route the most tempting path?
20. **Tech + fresh eyes.** Texel density consistent, collisions match art, LODs
    tuned, no overdraw blowouts, console clean. **Then close it, sleep, and look
    again tomorrow with the key reference side-by-side at the same size.**

---

# 18. THE BLENDER PIPELINE (verified by execution)

Everything below was **run on real Blender 4.5.12 LTS headless**, not read from
docs. The gotchas are measured, not theorised.

## 18.1 Version and invocation

**Pin `blender-4.5.12-linux-x64`.** 4.2 LTS is EOL; 5.2 refactored Geometry
Nodes modifier properties (`mod["socket_1"][1]` → `mod.socket_1.y`), which
breaks every geonodes script. Docs: use `docs.blender.org/api/4.5/`, since
`/current/` now serves 5.2.

⚠️ **`pip install bpy` is the wrong tool** — it ships **zero addons** (no
Sapling, no ANT, no rock generator) and has no `--python-exit-code`. Use the
real binary. Do `pip install fake-bpy-module-4.5` for type stubs though; it
measurably cuts agent error rate.

```bash
blender --background --factory-startup -noaudio --offline-mode \
        --python-exit-code 1 --python stages/build_asset.py -- --spec rock.json
```

⚠️ **`--python-exit-code 1` is mandatory.** Without it Blender **exits 0 after
an uncaught traceback** and your build goes green on broken assets.

## 18.2 The five gotchas that cost the most time

**1. `read_factory_settings()` unregisters every addon.** Reset *first*, then
enable — the reverse order fails silently and `bpy.ops.curve.tree_add` simply
doesn't exist.

```python
bpy.ops.wm.read_factory_settings(use_empty=True)
for p in ("sapling_tree_gen","antlandscape","extra_mesh_objects","cell_fracture"):
    addon_utils.enable(f"bl_ext.blender_org.{p}", default_set=False, persistent=True)
```

The generators **moved out of the bundle in 4.2** — 4.5 ships only 15 core
addons. Install once with
`blender -b --online-mode --command extension install -e sapling_tree_gen,antlandscape,extra_mesh_objects,cell_fracture`
(`--online-mode` required, comma-separated, no spaces), or vendor them via
`BLENDER_USER_EXTENSIONS` so nothing touches user prefs.

**2. Stale depsgraph.** Without `view_layer.update()` before
`evaluated_depsgraph_get()`, three different DECIMATE ratios returned
**identical face counts** in testing.

```python
def apply_all(ob):
    bpy.context.view_layer.update()                    # ← REQUIRED
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg),
                                         preserve_all_data_layers=True,   # keeps UV1
                                         depsgraph=dg)
    ...
```

**3. AgX wrecks every saved map.** It's the 4.0+ default view transform. Set
`view_settings.view_transform = 'Standard'` at boot, and save with
`img.save()` — **never `save_render()`**, which applies colour management.

**4. Cycles only.** EEVEE **cannot bake at all**, and EEVEE Next / Workbench
fail headless with `Couldn't open libEGL.so.1`.

**5. `export_format` defaults to `''`, not `'GLB'`.** Always pass it.

## 18.3 Baking — the parts the docs don't tell you

**`bpy.ops.object.bake()` has a `uv_layer=` parameter.** Almost nobody uses it,
and it's the cleanest thing in the pipeline — bake to the lightmap UV while the
albedo UV stays active, with no state juggling.

⚠️ **Omitted kwargs fall back to `scene.render.bake.*`, not the signature
defaults.** So `bake(type='NORMAL')` silently uses `margin_type='ADJACENT_FACES'`.
And `type` has **no** fallback (defaults `COMBINED`), while setting
`scene.cycles.bake_type` from Python **does nothing** — it's UI-only storage.
**Pass every parameter explicitly.**

⚠️ **The bake target node must be BOTH active AND selected, and left
unconnected**, in *every* material slot — Blender's source explicitly refuses
to "bake to unselected images", and connecting it throws "Circular dependency
for image".

```python
for n in nt.nodes: n.select = False
tex.select = True                # both required
nt.nodes.active = tex
```

**Samples:** NORMAL/POSITION/UV bakes are **deterministic — use `samples=1`**,
identical output to 512 and ~500× faster. AO wants 128–256, GI 256–512.
**Denoising off for normals** (OIDN is trained on radiance and smooths away
exactly the detail you baked). Cycles bake output is **not** denoised by the
scene denoiser — there is no such feature.

**Green channel:** Blender's default `normal_g='POS_Y'` is already OpenGL +Y,
which is what glTF and three.js want. **Do not swizzle.**

## 18.4 UV1 and AO reach three.js automatically

**All UV layers export unconditionally.** Verified: three UV layers on a mesh
with **no material at all** produced `TEXCOORD_0/1/2`. You do *not* need to
reference a UV map in a material node. `TEXCOORD_n` index = **position in
`mesh.uv_layers`**, so just name them deterministically:

```python
me.uv_layers[0].name = "UVMap"        # → TEXCOORD_0 → geometry.attributes.uv
me.uv_layers.new(name="Lightmap")     # → TEXCOORD_1 → geometry.attributes.uv1
```

**AO needs zero JavaScript glue.** glTF has no lightMap slot, but Blender's
exporter maps a node group named **`"glTF Material Output"`** with an
`Occlusion` input to `occlusionTexture` — and GLTFLoader then sets
`aoMap.channel = 1` automatically. Verified output:

```json
"materials":[{"occlusionTexture":{"index":0,"texCoord":1}}]
```

**Full lightmaps still need manual assignment** — and they are **HDR**.
Measured pixel values above 1.0 (`[1.207, 1.280, 1.499]`), which **silently
clip when saved to PNG**. Normalize and ship the scale factor:

```python
peak = max(all_rgb_pixels) or 1.0
if peak > 1.0: divide all rgb by peak
obj["lightMapIntensity"] = round(peak, 4)   # → material.lightMapIntensity in three.js
obj["lightMapChannel"]   = 1
```

⚠️ `lightMap` only affects the diffuse term — pair with `MeshStandardMaterial`
or `MeshLambertMaterial`. For fully-baked static geometry, `MeshBasicMaterial` +
`lightMap` gives zero-cost lighting.

⚠️ `uv.pack_islands` returns `{'CANCELLED'}` unless
`scene.tool_settings.use_uv_select_sync = True`.

## 18.5 🔴 Two findings that break the whole pipeline if you get them wrong

**(a) A lightmap UV2 makes external simplification a total no-op.**

Measured on the same sphere, `gltf-transform simplify --ratio 0.25`:

| UV setup | verts before | after simplify |
|---|---|---|
| 1 UV (smart project) | 2,202 | **628** ✅ |
| UV1 + UV2 via `lightmap_pack` | 8,064 | **8,064** ❌ **0% reduction** |

`lightmap_pack` makes **every face its own UV island**, so every vertex splits
and meshoptimizer cannot collapse a single edge. `weld` doesn't help — the UV2
values genuinely differ per corner.

**→ The ordering rule this forces:**
```
generate → UV0 → LOD CHAIN → lightmap UV1 on LOD0 ONLY → bake → export
```
LOD1+ should use vertex-baked AO (`COLOR_0` interpolates gracefully through
decimation) or a shared tiling material.

**(b) Flat shading triples vertex count and blocks simplification.**

| setup | glTF verts | verts/tri | after `gltfpack -si 0.3` |
|---|---|---|---|
| flat + UV | 2,865 | **2.96** | ❌ **zero reduction** |
| smooth + UV | 1,064 | 1.10 | ✅ 290 tris |

**Ship smooth-shaded with baked normal maps** for the faceted look, not
`shade_flat`. Track **verts/tri** as a health metric — above 2.0 means roughly
3× the vertex data hitting three.js.

## 18.6 Procedural generation — measured behaviour

| Generator | Operator | Verified |
|---|---|---|
| Sapling Tree Gen | `bpy.ops.curve.tree_add` (92–95 props) | ✅ 9 presets, none named "oak" |
| A.N.T. Landscape | `bpy.ops.mesh.landscape_add(refresh=True)` | ✅ 16k-poly cliff; 32 presets incl. `cliff`, `canyon`, `mesa` |
| Rock Generator | `bpy.ops.mesh.add_mesh_rock` | ✅ (inside `extra_mesh_objects`) |
| Cell Fracture | `bpy.ops.object.add_fracture_cell_objects` | ✅ 8 shards in 0.04s |

⚠️ **A.N.T.'s `refresh` defaults False → silently creates nothing.**
⚠️ Sapling **doesn't set the active object** (grab by name `'tree'`), and
`makeMesh=True` attaches a SKIN modifier producing **1.6M polys**. Use
`makeMesh=False` + curve bevel.
⚠️ The rock generator's 6 modifiers evaluate to **393k polys** at `detail=4`.

**Gnarl levers for dead dark-fantasy trees, ranked:** `curveV` 180–240 (biggest
knob), **negative `attractUp`** (drooping dead limbs), `curveBack` (S-bends),
`baseSplits` 3–4 with low `baseSize` (multi-trunk witch tree), `rotateV`
(breaks regularity).

**🔴 Sapling curve-meshes are non-manifold and DECIMATE hits a hard floor** —
measured: ratios 0.5, 0.25 and 0.06 all returned **17,246 polys**. Collapse
can't proceed past ~70%, and `remove_doubles` doesn't fix it.

**The fix — REMESH VOXEL first:**
```python
rm = ob.modifiers.new("remesh", 'REMESH')
rm.mode = 'VOXEL'; rm.voxel_size = 0.055; rm.adaptivity = 0.15
# → 3,039 polys, 0 boundary edges (watertight); DECIMATE ratios now honoured exactly
```
Bonus: it produces the chunky carved silhouette that suits this art direction.
`mode='BLOCKS'` is excellent for ruins.

**Geometry Nodes:** `node_group.inputs` no longer exists (4.0 break) — use
`ng.interface.new_socket(...)`, and **never hardcode socket identifiers**
(they're allocated across inputs *and* outputs in creation order). Pragmatic
route: author the group once in a GUI, ship the `.blend`, append headlessly
with `bpy.data.libraries.load` — and mark `use_fake_user = True` first or it
won't survive the save.

## 18.7 Export

**Use meshopt, not Draco.** Measured on a 4-LOD tree GLB:

| Variant | Raw | gzip -9 |
|---|---|---|
| plain | 768,836 | 535,826 |
| Draco L6 | 135,828 | 132,738 |
| **gltfpack `-cc`** | 121,040 | **92,673** |

Draco is already entropy-coded so gzip barely helps; meshopt drops another 23%,
decodes ~10× faster, and its decoder is **25 KB** versus Draco's 200 KB+ — and
it's a plain ES module import with no extra files to host.

⚠️ **`gltfpack` silently drops node names, extras, and "unused" UVs unless you
pass `-ke -kn`.** Verified: without them, `node_extras=[]` and attributes
collapse to just POSITION and NORMAL.
⚠️ In `gltf-transform optimize`, **disable `--join --flatten --instance`** or it
merges your `_LOD0..3` nodes into one mesh.

```python
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',   # ← required
    export_yup=True, export_extras=True, export_texcoords=True,
    export_normals=True, export_tangents=True,
    export_vertex_color='ACTIVE',           # 'MATERIAL' can emit stray COLOR_1
    export_draco_mesh_compression_enable=False)
```
Custom properties round-trip: `obj["lightMapIntensity"] = 1.41` → `node.extras`
→ `mesh.userData` in three.js. JSON-serialisable types only.

## 18.8 LODs and impostors

🔴 **`MSFT_lod` is not supported by three.js** — use a naming convention
(`Name_LOD0..3`) and build `THREE.LOD` at load with **hysteresis 0.1** to stop
flicker. **Ship one GLB containing all LODs** — they then share one material
instance and one texture upload.

Decimate ratios for stylized low-poly: LOD1 `0.5`, LOD2 `0.2–0.25`, LOD3
`0.08–0.1`, then switch to an impostor — below ~0.15 COLLAPSE destroys branch
silhouettes. `vertex_group` + `vertex_group_factor` is the underrated lever:
protect silhouette-critical geometry and decimate the rest harder.

**🟢 Skip Blender for impostors entirely.** `@three.ez/octahedral-impostor`
bakes the atlas in-browser via render targets, so the baker and the shader
share one convention — which is where all the bugs live. Two conventions that
silently ruin a hand-rolled atlas: sampling must be `i/(N-1)` **inclusive**
(not `(i+0.5)/N`, which gives a persistent parallax wobble), and **Blender is
Z-up while three.js is Y-up** — `export_yup` fixes the mesh but not camera
directions you compute yourself. Use **hemi-octahedral** for trees, ruins and
cliffs (never viewed from below → 2× angular resolution for the same budget);
12×12 at 2048 is the sweet spot.

## 18.9 Worth mining

**[princeton-vl/infinigen](https://github.com/princeton-vl/infinigen)** —
**BSD-3-Clause**, actively developed, a huge library of procedural rock,
terrain, cliff and tree generators driven headlessly. Photoreal-oriented so the
styling needs replacing, but **the geometry algorithms are directly liftable
under a permissive license.** The single highest-value repository found.

Also: `Naxela/The_Lightmapper` (best lightmap-baking reference),
`franMarz/TexTools-Blender` (most battle-tested bake code, authoritative on
normal swizzle and colorspace), `sharpen3d/Aether` (best modern bake suite).
