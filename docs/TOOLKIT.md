# MOONREST — TOOLKIT

Researched, cited techniques and libraries. **The build agent reads this before
writing rendering code.** Everything here is sourced; where a claim was verified
against three.js source it is marked **[V]**, where it comes from a cited
article **[R]**.

Companion to `DIRECTION.md` (the art law) and `FINAL_PASS.md` (the build order).

---

# 1. STACK DECISIONS (make these first)

## 1.1 Pin three.js to r180–r182 **[V]**

That is the only range satisfying the whole ecosystem simultaneously:

| Package | Constraint |
|---|---|
| `postprocessing` (pmndrs) | three >= 0.168 < 0.186 |
| `three-good-godrays` | three >= 0.125 <= 0.182 ← binding |
| `three-gpu-pathtracer` | three >= 0.180 ← binding |
| `three-mesh-bvh` | three >= 0.159 |
| `three-custom-shader-material` | three >= 0.159 |

Note for this repo: `@react-three/fiber@9` requires React 19; `8.18.0` is the
last React-18 line. **Simplest path: vanilla three.js inside a `useEffect`,
skipping R3F entirely.**

## 1.2 Renderer path — prefer `WebGPURenderer` with WebGL2 fallback **[V]**

`WebGPURenderer` auto-falls back to a WebGL2 backend (`forceWebGL: true` forces
it; otherwise it warns *"WebGPU is not available, running under WebGL2
backend"*). Taking this path gives **built-in exponential height fog** and the
node-based post stack while still shipping to WebGL2 browsers. The classic
`WebGLRenderer` + `EffectComposer` path requires hand-patching fog via
`onBeforeCompile`.

Height fog and depth-blur scattering are the two effects this art direction
leans on hardest, and both are one-liners on the node path.

## 1.3 Color pipeline — set before lighting anything

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
texture.colorSpace = THREE.SRGBColorSpace;  // color maps only, never data maps
renderer.toneMapping = THREE.AgXToneMapping;
```

**Use AgX, not ACES.** three.js's own PR notes admit the ACES implementation
*"fails to desaturate highlights"*, and true ACES desaturation would bleach
exactly the saturated lantern glow this game is composed around; ACES also
boosts contrast, fighting the "never crush to black" rule. AgX is flatter and
explicitly designed as *"a better foundation for additional color grading"* —
and it is Blender 4.x's default, so baked assets round-trip consistently.
**Pin >= r161** — r160's AgX shipped without required gamut mapping. **[R]**

Custom `ShaderMaterial` fragments must manually `#include <colorspace_fragment>`
at the end of `main()`; three.js will not fix a hand-written shader.

---

# 2. THE LIGHT RIG

three.js forward materials evaluate **every active light per fragment**, with
no automatic per-object light culling; practical degradation begins around
30–50 point lights **[R]**. The rig:

1. **1 × `DirectionalLight`** — the moon. The **only** shadow caster. Cascaded
   shadow maps ship in core: `three/addons/csm/CSM.js` **[V]**.
2. **1 × `HemisphereLight`** — the ambient floor, cool moon-blue sky over warm
   ground bounce. Cannot cast shadows, essentially free. This is the mechanism
   that keeps shadows from terminating at pure black.
3. **Single-digit `PointLight`s** for lanterns near the camera, `castShadow =
   false`, tight `distance`/`decay`.
4. **Everything else is emissive material with no light attached.**

80.lv's stylized-night breakdown states the recipe directly: *"To give the
illusion that the lanterns are lit I used emissive materials in combination
with well-placed point lights"*, and *"the most important part of correcting my
lighting was to let go of the directional light as the main light source."* **[R]**

## 2.1 The governing rule

From The Level Design Book's darkness chapter: **"make it feel dark, but don't
actually make it dark."** Corollaries **[R]**:

- Never apply flat ambient to all shadows — use directional/hemispherical
  ambient so only *some* shadows reach zero. **Contrast reads as night, not
  absolute darkness.**
- **Never bake darkness into albedo.** Let lights create dark.
- Avoid pure blue+orange ("vanilla blorange") — add a third accent hue.
- Fill recipe: dim bluish point lights, no shadows, soft falloff.

Robert Yang's mechanism: *"The perceived brightness of a light depends on the
actual brightness, and the relative light level in the areas around it."* **[R]**

## 2.2 Rim light — the highest-leverage trick in a dark scene **[R]**

```glsl
vec3  eye = normalize(-vertexPosition.xyz);   // view space
float rim = max(0.0, 1.0 - dot(eye, normal));
rim = pow(rim, rimLightPower);                // soft
// or: rim = smoothstep(0.3, 0.4, rim);       // hard banded edge
outputColor.rgb += rim * diffuse;
```

Bias toward the moon (`* saturate(dot(N, -lightDir))`) so it reads as backlight
rather than a uniform glow shell. In near-black scenes this is not a flourish,
it is *the readability mechanism*.

## 2.3 Why night reads blue **[R]**

Moonlight is ~4100K — technically warmer than daylight. The blue is the
**Purkinje shift**: scotopic rod vision peaks near 507nm, so reds darken first.
Aim for **steely desaturated grey-blue**, not saturated cartoon blue. Best
implemented as a *luminance-dependent* shift (desaturate reds, lift blue only
in low-luminance pixels) rather than a flat global tint.

---

# 3. FOG — THE PRIMARY SCALE TOOL

Íñigo Quilez, *Better Fog* (https://iquilezles.org/articles/fog/), states the
thesis: *"Without fog it's not easy to tell the scale of the terrain. With fog
we immediately understand the size."* **Fog is a scale instrument, not a mood
effect.**

## 3.1 The three formulas **[V, extracted]**

```glsl
// 1. plain exponential
float fogAmount = 1.0 - exp(-t*b);

// 2. INSCATTERING — fog shifts toward the light when you look at it
float sunAmount = max(dot(rd, lig), 0.0);
vec3  fogColor  = mix(nightBlue, moonPale, pow(sunAmount, 16.0));  // 16–32 = tight halo

// 3. EXPONENTIAL HEIGHT FOG — density a*exp(-b*y), analytically integrated
float fogAmount = (a/b) * exp(-ro.y*b) * (1.0 - exp(-t*rd.y*b)) / rd.y;
```

Formula 3 costs one extra divide and delivers the entire "valleys drown in
mist, towers stand clear" read. Formula 2 with a pale moon tint and a high
exponent gives the moon a halo through the air.

Separate extinction from inscattering for six independent coefficients:
```glsl
vec3 extColor = exp(-distance * be);
vec3 insColor = exp(-distance * bi);
finalColor = pixelColor*(1.0-extColor) + fogColor*insColor;
```

## 3.2 Built-in node fog **[V]**

```js
import { exponentialHeightFogFactor, uniform, fog, color } from 'three/tsl';
scene.fogNode = fog( color(0x14243a), exponentialHeightFogFactor( uniform(0.04), uniform(2) ) );
scene.backgroundNode = color(0x14243a);   // fog color == horizon color, always
```
`fog(color, factor)` accepts an **arbitrary factor node**, so inscattering is a
custom factor rather than a fork. Example: `webgpu_fog_height`.

Classic-path note: three.js's built-in fog uses `-mvPosition.z` — planar, not
radial — so density shifts as the camera rotates. Matters at wide FOV. **[V]**

## 3.3 Depth-driven scattering blur — best value effect found **[V]**

Blend toward a **half-res blurred copy of the scene** weighted by the fog
factor, so distant geometry loses acuity instead of only tinting:

```js
const blurred = gaussianBlur(scenePassColor, vec2(scattering), 4, { resolutionScale: 0.5 });
outputNode = mix(scenePassColor, blurred, fogFactor);
```

three.js's own `webgpu_custom_fog_scattering` example does exactly this, and its
scene notes describe our target verbatim: fog and background share a color so
trunks *"read as dark silhouettes that dissolve into depth"*, all
`MeshBasicMaterial`, **no lights at all**, camera at `y = 1.7`, FOV 55.

## 3.4 Fog behind silhouettes — the cheapest readability fix **[R]**

Left 4 Dead's *Stylized Darkness* post: when playtesters couldn't read shapes
against dark backgrounds, the team added **light-colored fog** — explicitly
less realistic, but *"it meant playtesters could see attackers in the
distance."* A slightly-lighter fog band at mid-distance turns every foreground
object into a legible silhouette.

## 3.5 Soft particles — mandatory for fog cards **[R]**

Linearize scene depth, subtract card depth, `smoothstep` into alpha. Three
lines, kills the hard clip line where ground fog meets terrain. Requires a real
`DepthTexture` (WebGL2 samples depth natively, no RGBA packing).

## 3.6 Sky

`three/addons/objects/Sky.js` is Preetham and **misbehaves at deep night**
(low sun elevation breaks the zenith terms). Community consensus: cross-fade
from Preetham at dusk into a procedural starfield dome with a manual color
lerp. **[R]**

---

# 4. VOLUMETRIC LIGHT

Ranked by cost. **Important correction: the old
`examples/jsm/shaders/GodRaysShader.js` no longer exists** — three.js's own
example now uses third-party `three-good-godrays` **[V]**.

1. **Billboard cone shafts — the right answer for lanterns.** John Chapman's
   "Good Enough Volumetrics"; three.js port `threex.volumetricspotlight`. Whole
   fragment shader is a distance falloff times `pow(dot(normal, viewZ),
   anglePower)` to fade at the silhouette. `transparent, depthWrite:false`.
   Add the §3.5 soft-particle depth fade. **[R]**
2. **Screen-space radial blur** (GPU Gems 3 Ch.13) — march samples toward the
   light's screen position with exponential decay. **Breaks when the light is
   off-screen**, so fine for torches, wrong for the moon. **[R]**
3. **Raymarched through the shadow map** — `three-good-godrays`, now absorbed
   into core as `three/addons/tsl/display/GodraysNode.js` **[V]**, with
   `BilateralBlurNode` and `depthAwareBlend` companions. Works off-screen.
   Requires full shadow setup; point and directional lights only. Defaults:
   `density 1/128, maxDensity 0.5, raymarchSteps 60`.
4. **Blue-noise dithered raymarching** — turns banding into temporal noise,
   letting step counts drop from ~250 to ~50. **[R]**

Maxime Heckel's *Shaping Light* is the best web-specific writeup (raymarch
loop, per-sample shadow occlusion, Henyey-Greenstein phase, blue noise).

**Use `pmndrs/postprocessing` over stock `EffectComposer`:** its `EffectPass`
merges multiple effects into a single shader program rather than N ping-ponged
fullscreen passes, and draws a fullscreen triangle instead of a quad.

---

# 5. BAKED LIGHTING (the quality multiplier)

**Why it wins here:** a night scene's beauty lives in soft bounce — lantern
light spilling onto a wall and back onto the ground. Realtime WebGL direct
lighting cannot produce that at any price. Baking buys GI, soft area shadows
and AO for one texture fetch, and lets the scene run on two realtime lights.

## 5.1 The API detail every older tutorial gets wrong **[V]**

Lightmap UVs do **not** go in `geometry.attributes.uv2`. Modern three.js
selects the UV set per-texture:

```js
material.lightMap.channel = 1;   // → geometry.attributes.uv1
material.aoMap.channel    = 1;
```
glTF `TEXCOORD_1` maps to `uv1` automatically.

## 5.2 What each map actually does **[V]**

```glsl
// aomap_fragment — AO touches INDIRECT light only
reflectedLight.indirectDiffuse *= ambientOcclusion;
// lights_fragment_maps — lightmap ADDS to irradiance
irradiance += lightMapTexel.rgb * lightMapIntensity;
```
AO modulating only indirect is exactly right here: it darkens the hemisphere
floor and lightmap without double-darkening direct moonlight. It reads `.r`, so
it is ORM-compatible. The lightmap adds to irradiance, so it stacks with the
hemisphere light — tune `lightMapIntensity` and hemisphere intensity as a pair.

## 5.3 Pipeline options

- **Blender Cycles bake → glTF** (second UV via Smart UV Project / Lightmap
  Pack, exported as `TEXCOORD_1`). Primary path — see `ASSETS.md` Part 2.5.
- **`three-gpu-pathtracer`** (requires three >= 0.180) can bake lightmaps
  in-browser, built on `three-mesh-bvh`.
- **xatlas** for automatic lightmap UV atlas generation as a build step.
- **Vertex-color AO** — for low-poly stylized geometry this is often enough and
  needs no UVs at all. Bake AO to vertex colors, `material.vertexColors = true`.
  Zero texture memory. **Try this first; it may be sufficient.**
- Compressed/HDR lightmaps: `KTX2Loader`, `EXRLoader`, `RGBELoader` all in
  core addons **[V]**.
- **Light probes** (`webgl_lightprobe` examples **[V]**) — spherical-harmonic
  ambient is the middle ground for moving characters in a baked world.

**Contact shadows are non-negotiable.** In a dark scene the real shadow is
often invisible, so a soft dark ellipse under every object is what stops things
floating.

---

# 6. STYLIZED SHADING

## 6.1 `MeshToonMaterial` is already half-Lambert — and floors at 0.7 **[V]**

```glsl
float dotNL = dot( normal, lightDirection );
vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );        // ← half-Lambert remap, free
// without a gradientMap:
return mix( vec3(0.7), vec3(1.0), smoothstep(0.7-fw.x, 0.7+fw.x, coord.x) );
```

Two consequences: the `dotNL*0.5+0.5` remap is Valve's half-Lambert and is why
the terminator doesn't crush to black — keep it. But **the default darkest
irradiance is 0.7, not 0**, which is wrong for dark fantasy. **Author a custom
`gradientMap`** (1D gradient texture, `NearestFilter` for hard bands) that
descends into the real shadow value. `fwidth` provides analytic AA on the band
edge — preserve it if hand-rolling.

`MeshToonMaterial` has **no specular at all** — inject it if a wet-look
highlight is wanted.

## 6.2 Matcap — use only for background geometry

`MeshMatcapMaterial` bakes the entire lighting response into one texture. Fast
and beautiful, but **does not respond to lanterns at all**, so it breaks the
moment warm light should pool on a surface. Distant silhouette geometry only.

---

# 7. COLOR GRADING

Workflow (John Hable): **prototype the grade live with a parametric
`ShaderPass`, then bake the approved look to a `.cube` LUT for production.**

```glsl
// lift / gamma / gain
color = pow(max(vec3(0.0), color*(1.0 + uGain - uLift) + uLift + uOffset),
            max(vec3(0.0), 1.0 - uGamma));
float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
color = mix(vec3(luma), color, uSaturation);
float v = smoothstep(0.8, 0.2, length(vUv - 0.5) * uVignetteStrength);
color *= mix(1.0, v, uVignetteAmount);
```

LUT application: `LUTPass` + `LUTCubeLoader` from core addons, or
`three/addons/tsl/display/Lut3DNode.js` on the node path **[V]**.

**Lock the palette from one shared value.** Drive `fog.color`,
`hemisphereLight.color`, and the grade tint from a single "mood" color. A
time-of-day or zone transition becomes interpolating one value plus swapping
the directional light — not re-authoring materials. Both the Sable breakdown
and the 80.lv night article arrived at this independently. Journey used
explicit **per-act color scripting** the same way. **[R]**

---

# 8. MAKING THINGS FEEL HUGE

- **Fog is the primary scale cue** (§3). An object fading into haze reads as
  both far *and* large, because the brain infers size from how much atmosphere
  sits between.
- **Value-band layer separation.** Foreground / midground / background must
  occupy distinguishable value bands. Diagnostic: **screenshot, desaturate,
  squint.** If layers mush into one grey, the fog curve is wrong.
- **Camera height:** low camera makes things loom. three.js's own example
  annotates `camera.position.y = 1.7` as "~human eye height" — a deliberate
  anchor **[V]**.
- **Sight angle:** looking *up* is what makes a thing monumental. A flat angle
  makes a scene *"feel flat and boring"*; putting the viewer below creates the
  *"impression of observer's smallness."* **[R]**
- **FOV:** wide exaggerates looming proximity; narrow sells distant mass.
  Consider animating FOV on colossus reveals.
- **Staffage** — the actual term of art: living figures or known-size objects
  placed for scale reference. Birds, doorways, stairs, railings. **Scale is
  always relational; without an anchor a huge object is just an object.**
- **Detail frequency.** A giant wall reads giant because it carries
  brick-scale detail the eye uses as a ruler. A huge object with low-frequency
  detail just looks like a small object seen close. Texel density standard
  ~256 px/m; do **not** use uniform density — more on near/visible surfaces.
- **Big things move slowly**, with secondary-motion lag.

**Shadow of the Colossus specifics [R, analysis sources not developer-primary]:**
Wander is deliberately undersized (~1.2m) to accentuate giantness; Agro is a
constant familiar-sized companion travelling with the player; the Forbidden
Lands are deliberately empty — *design by subtraction* — so the colossi are the
only vertical events in the world. **Cutting content is a scale technique.**
When a climbed surface fills the whole screen, the object has become terrain;
that transition is the payoff.

**Always keep something moving** — SotC remake art director Mark Skelton:
*"I always insist on SOMETHING moving in every frame. Whether it be rolling
fog, plants bending in the wind, dust motes circling..."* Static reads as
diorama. **[R]**

---

# 9. COMPOSITION VOCABULARY

From level-design.org (the most complete taxonomy found) **[R]**:

- **Dominant** — the focal point; must stand out by brightness and position.
  **Counterpoint** — a competing secondary focal point.
- Layers: **Foreground** (framing, often pure dark silhouette), **Center of
  Interest**, **Background** (calm, low detail, aerial perspective),
  **Staffage**.
- **Observation Spot** — the specific place the player should be standing when
  they see the composition, engineered with choke points and funnels. **This is
  the practical answer to "how do you frame a view in an interactive camera":
  you don't frame the view, you funnel the player to the framing position.**
- Symmetric composition reads *"synthetic, made by human, clean"*; asymmetric
  reads *"organic, made by nature, dirty."*
- **Critical constraint for a dark game:** *"You shouldn't invert that effect,
  players are mostly not accustomed to look at very dark spots to find
  something interesting."* — **the focal point must be the lit thing.**

The Level Design Book dissents usefully: it **rejects leading lines**, arguing
*"literally every hallway you build will seem to converge in the distance"*
through foreshortening, and prioritizes **spatial composition** (3D massing,
works from all angles) over **shot composition** (one 2D frame). It defines a
**vista** as *"an exceptionally deep scene composition that offers an overview
of the next area"* and an **approach** as *"a path with a vista."*

Two GDC talks worth watching in full: Miriam Bellard, *Environment Design as
Spatial Cinematography* (2019); Jim Brown, *The Importance of Nothing: Using
Negative Space in Level Design* (2014).

Books: *Framed Ink* (Mateu-Mestre) for staging and value; *Color and Light*
(Gurney) — its chapters on night, firelight, and limited palettes map almost
1:1 onto this project.

---

# 10. CHEAP TRICKS RANKED BY IMPACT ÷ EFFORT

1. **Emissive + selective bloom.** Emissive costs nothing (no light-loop
   contribution) yet reads as a light source. Layer-based selective bloom so
   only lanterns glow, not every bright pixel (`webgl_postprocessing_unreal_bloom_selective`;
   TSL `BloomNode`) **[V]**.
2. **Fog behind silhouettes** (§3.4) — cheapest readability fix in a dark game.
3. **Wet surfaces.** Darken diffuse, boost specular: *"the glint off a wet
   brick wall implies a greater amount of detail."* Perceived detail in shadow
   for the price of a spec term; also pops silhouettes.
4. **Rim light on everything that matters** (§2.2).
5. **Half-Lambert everywhere** — one-line change, nothing crushes to
   unreadable black.
6. **Particles as depth cues.** Dust motes between camera and subject prove
   there is *air* between things. Must be soft particles (§3.5).
7. **Depth-driven blur** (§3.3).
8. **Contact/blob shadows** — stops everything floating, nearly free.
9. **Vignette** — two lines of GLSL, forces the eye to the lit focal point.
10. **Negative space and subtraction** — empty is a resource; cutting props
    increases the impact of what remains, and is free performance.

---

# 11. BUILD ORDER (rendering)

1. Pin three r180–r182; choose the renderer path (§1.2).
2. Linear color pipeline + AgX (§1.3). **Before lighting anything.**
3. Rig: 1 directional moon + 1 hemisphere floor + emissive lanterns (§2).
   Resist adding lights.
4. Height fog, non-black tint, color shared with hemisphere sky (§3). Tune
   until the greyscale squint test shows three clean value layers.
5. Custom `gradientMap` toon ramp + rim light (§6, §2.2).
6. Bake lightmaps / vertex AO once layout is locked (§5).
7. Volumetrics: cone meshes for lanterns; godrays only if the moon needs shafts.
8. Grade parametrically, then bake to `.cube`.
9. Dust motes, vignette, selective bloom last.

---

# 12. NOTABLE FINDINGS FROM THE REFERENCE GAMES

- **Journey has no dynamic shadows at all** — every shadow is hand-painted,
  including the temple light columns, aligned to the texture pixel grid. A
  deliberate cost trade. Per-act **color scripting** drives its mood. **[R]**
- **Sable** added lighting *"for spatial readability, not realism"*, and added
  moonlight specifically so the world stays readable at night. Fog called
  *"really, really key"*, blended to sky color, tuned per biome. Outlines fade
  opacity with distance to prevent silhouette pop-in. **[R]**
- **Ashen**: *"The lack of natural light is excellent for the experience we
  want"* — but not uniformly dark; one dominant warm emissive landmark anchors
  the world. **[R]**
- **Shadow of the Colossus remake deliberately removed the PS2 bloom**, because
  it was *"a design choice born from limitation — made primarily to mask short
  draw distances."* Decide consciously which look is wanted. **[R]**
- **Left 4 Dead**: *"Simplifying the lighting helped the gameplay (the player
  is drawn to the warm glow down the street, and not distracted by unnecessary
  light sources)."* **[R]**
- **Death's Door is Unity**, not Unreal. Warm toon-shaded characters against
  muted cool environments. **[R]**

---

*Sources are inline. Where this document and any other doc disagree on a
technical detail, this one wins — it was verified against source.*
