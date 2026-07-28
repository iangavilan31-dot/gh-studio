# MOONREST — GRAPHICS BOOST PASS

**Status: proposed amendment.** This document adds to `TOOLKIT.md` and proposes **three
changes that contradict existing docs** (§1 tone mapping, §7 camera FOV, §3 dithering
placement). Those three are flagged 🔶 and are the owner's call — everything else is
additive and can be executed immediately.

Researched 2026-07-28 against three.js docs/forum, published rendering references, and the
agentic-workflow findings in `research/agentic-3d-graphics-opus5-fable5.md`.

**What this is not:** a restatement of `TOOLKIT.md`. Everything already covered there —
selective bloom thresholds, n8ao, CSM, tinted shade, sky-RT fog, blade grass, depth foam,
Yale star catalogue, the Blender bake — is assumed done and is not repeated. This file is
only the delta.

**Caveat up front:** I have not seen the build. This repo contains the docs, not the game.
The triage table in §0 is keyed to symptoms so it works without a screenshot, but if you
drop three screenshots (one wide vista, one mid-distance path shot, one near-object shot)
into `docs/build/`, most of this collapses into two or three specific fixes.

---

# 0. TRIAGE — find the symptom, apply the fix

Ranked by how often each one is the actual cause of "it looks sub par." Work top-down and
stop when it looks right; do not do all of them at once or you will not know what worked.

| # | Symptom you'd see in a screenshot | Root cause | Fix | Cost |
|---|---|---|---|---|
| 1 | Everything readable but **nothing feels far away**; the vista looks like a diorama | FOV too wide — three.js default 75° is a ~24mm lens | §7 lens law: 45–55° gameplay, 30–35° postcards | one line |
| 2 | Sky and fog show **visible stair-step rings** in the dark gradients | 8-bit quantization; `Material.dithering` only covers lit materials, not post output | §3 blue-noise dither **after** the LUT | ~30 lines |
| 3 | Amber lanterns read **yellow/green**, haze reads **cyan**, palette lock not recognizable | ACES shifts hue toward primaries and crushes contrast before the LUT can grade | 🔶 §1 swap ACES → AgX or Neutral, let the LUT carry the look | one line |
| 4 | Objects are lit but **look pasted on**; the player doesn't change as they walk into a ruin | Static geometry gets baked lightmaps, dynamic objects get one global hemisphere light | §4 baked irradiance probe grid → `LightProbe` | ~120 lines + bake step |
| 5 | Ground reads as **one repeating texture** at mid distance | Triplanar fixes stretching, not repetition | §6 macro variation + distance retiling | ~20 shader lines |
| 6 | Materials look **plastic / wet-plastic** under moonlight | Roughness range too narrow and too low; high-frequency noise standing in for detail | §6.2 roughness clamping + low-frequency breakup | tuning |
| 7 | Night reads as **"daylight with the brightness down"** | No perceptual night model — colors stay photopic | §2 Purkinje shift | ~15 shader lines |
| 8 | Edges **crawl and shimmer** on rim lights against the moon sky, SMAA doesn't help | Specular/normal aliasing — spatial AA cannot fix this | §5 roughness clamping + mip-aware normals, then optional temporal | tuning first |
| 9 | Wet ground called for in `DIRECTION` Part 6 but **nothing reflects** | No SSR path exists; the archived libs are dead ends | §8 puddle mask + confined planar reflector | ~60 lines |

---

# 1. 🔶 TONE MAPPING — the palette lock is fighting ACES

`DIRECTION.md` Part 9 and `TOOLKIT.md` §3 both specify **ACES**. For most projects that is
the right default. For **this** project it is arguably the wrong one, and it is a one-line
change either way.

What ACES actually does, from the three.js forum's side-by-side comparison: it *"changes
your colors, not just the intensities"* — hue shifts toward primaries, oranges become
yellow, water becomes cyan — and it **bands at high intensity**. It also markedly boosts
contrast and darkens the image. `[S]`

Now read that against Part 7's palette lock:

- Accent amber `#E8A13C` and gold `#F0C25A` are exactly the hues ACES pushes yellow.
  These are the game's *scarcest and most meaningful* colors — an ≤8%-of-frame budget — and
  the tone mapper is skewing every one of them.
- Haze blue `#4A5D78` and cold blue `#16243A` sit in the range ACES pushes cyan.
- The whole frame is a dark gradient, which is where ACES banding is worst, and §3's
  banding problem compounds it.

**Recommendation:** switch the transform to **AgX** (`THREE.AgXToneMapping`) or **Khronos
PBR Neutral** (`THREE.NeutralToneMapping`), and let the **per-zone LUT do the artistic
grade**. AgX is deliberately flatter and lower-contrast — that reads as a downside in
isolation, and it is exactly what you want *underneath a LUT*, because a neutral base means
the `.cube` you graded in Resolve produces on screen what you saw in Resolve. `[S]`

Architecturally: **one artistic transform, not two.** Right now ACES and the LUT are both
trying to author the look, and ACES goes first.

```js
renderer.toneMapping = THREE.AgXToneMapping;   // was ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0;            // re-tune; AgX and ACES are not swappable at equal exposure
```

⚠️ Exposure does **not** carry over. Expect to re-tune exposure and re-grade the LUT — the
LUT was authored against ACES output and will be wrong. Budget one grading session.

**How to decide instead of guessing:** render the same three postcard poses under
ACES / AgX / Neutral at matched exposure, sample the amber accent pixels, and print
hue angle drift from `#E8A13C`. Pick the one with the least drift and the best-behaved sky
gradient. That is a 20-line script and it settles it with a number. See §10.

**Do not** use `LinearToneMapping` or `NoToneMapping` — highlights clip to white and the
kindled-flame core, the one place saturation is permitted, is the first thing to blow out.

---

# 2. THE PURKINJE SHIFT — the missing night model

Nothing in the docs models **how human vision actually behaves at night**, and this is the
gap between "dark scene" and "night."

Below roughly 0.01 cd/m², rods take over from cones. Rods peak at ~505nm (blue-green) versus
cones at ~555nm (yellow-green), and rods are nearly blind to red. Consequences, all
observable: at night blues and greens appear *relatively brighter*, reds go nearly black,
and **color saturation collapses** — you lose acuity and chroma together. This is the
Purkinje shift, and day-for-night rendering reproduces it with desaturation, acuity loss,
and a blue shift. `[S]`

Why it matters here specifically: it turns `DIRECTION` Part 6's art rule — *"warm light is
the game's scarcest and most meaningful resource"* — into a **rendering law that enforces
itself**. Areas below the rod threshold desaturate toward blue-green automatically; the
lantern, the doorway, the kindled flame stay above the threshold and keep full chroma. The
warm pools don't just look warmer, they become **the only places color exists at all**.
That is a much stronger read than tinting things amber.

Apply as a post effect **before** tone mapping, or in `csm_DiffuseColor` per material:

```glsl
// scotopic blend — 0 = full cone vision, 1 = full rod vision
float lum      = dot(color, vec3(0.2126, 0.7152, 0.0722));
float scotopic = 1.0 - smoothstep(uRodLow, uRodHigh, lum);   // try 0.002 .. 0.05

// rod response: luminous efficiency peaks blue-green, red nearly invisible
float rod = dot(color, vec3(0.08, 0.55, 0.37));              // ~505nm weighting
vec3  rodColor = rod * uRodTint;                             // uRodTint ~ #7FA8C8, deep blue-grey

color = mix(color, rodColor, scotopic * uPurkinjeStrength);  // strength 0.6–0.85
```

Tuning notes:

- `uRodHigh` is the artistic control. Set it so a lantern at 3m stays in full color and the
  moonlit ground at 30m is fully scotopic. Expose it in lil-gui — you will move it a lot.
- **Keep a floor of chroma** (`uPurkinjeStrength` < 1.0). Full desaturation reads as a
  broken greyscale filter, not as night.
- The crimson accent `#7E1F2B` (Part 7, once per zone) will go **black** under this unless
  it is lit above threshold. That is physically correct and dramatically useful — put the
  crimson somewhere lit, and it becomes the only red in the game.
- Pairs with §1: this is much easier to control on a neutral transform than through ACES.

---

# 3. 🔶 BANDING — the artifact that most reads as "cheap"

A game that is 80%+ dark blue gradient by area is the single worst case for 8-bit output.
Smooth slow gradients — skies, fog, lens glows — band at 8-bit even when everything else is
correct. `[S]` This is very likely visible in the current build and it is cheap to kill.

`TOOLKIT.md` §8 already sets `dithering = true` on the sky dome, and three's
`Material.dithering` adds noise to RGB **after lighting is computed** — but only in the
lambert/phong/physical shaders. `[S]` That leaves the two places that band worst untreated:

1. the **fog blend**, which is a full-screen gradient composited in the material,
2. the **post chain output**, after tone mapping and the LUT — and the LUT is itself a
   quantizer that can *re-introduce* banding the material dither already fixed.

**Fix: blue-noise dither as the final operation in the post chain, after the LUT.**

Ordinary white noise works but is visible as grain. Blue noise is the right tool: it puts
its energy in high frequencies where the eye is least sensitive, so bands turn into a fine
stipple rather than obvious grain. The recommended setup is 64×64 8-bit tiles, loaded as a
texture array, **picking a different tile per frame with a random offset per frame** — a
static dither pattern reads as a fixed screen-door texture the moment the camera stops. `[S]`

```glsl
// final effect in the EffectPass chain, AFTER LUT3DEffect
vec3 blue = texture2D(uBlueNoise, (gl_FragCoord.xy + uNoiseOffset) / 64.0).rgb;
outputColor.rgb += (blue - 0.5) / 255.0;   // exactly ±half a quantization step
```

Amplitude discipline: `1.0/255.0` peak-to-peak. Larger is visible grain, smaller doesn't
cross the quantization boundary and does nothing.

Free CC0 blue noise tiles: `momentsingraphics.de/BlueNoise.html`. `[S]`

**This is separate from the existing film grain** in the post stack. Grain is an art choice
at a much larger amplitude; dither is a correctness fix at ±0.5 LSB. Keep both, and if the
grain is currently being used to *hide* banding, turn the grain down once dither lands —
it's costing you the clean darks the whole art direction depends on.

---

# 4. LIGHT PROBES — why the player looks pasted on

The current rig, from `TOOLKIT.md` §4: baked lightmaps carry static geometry, one
`HemisphereLight` provides the ambient floor, one moon casts shadows. That's a good rig with
one hole: **the hemisphere light is global and constant.** Dynamic objects — the player,
creatures, the colossus if it moves — receive identical ambient light standing in open
moonlight, under a dense canopy, and ten metres inside a ruin.

Symptom: characters don't belong to the space. It reads as a compositing error, and it is
one of the more common tells of a browser 3D scene.

three.js has the pieces in core: `LightProbe` stores SH9 irradiance and is functionally an
irradiance environment map; probe volumes arranged in a 3D grid and interpolated are the
standard solution. `[S]`

**Recommended implementation — sparse, baked, and cheap:**

1. Extend the existing `tools/bake.py` (the Blender pipeline is already built, per
   `TOOLKIT.md` §18 — this is an added output, not a new pipeline). Place probes on a
   coarse grid, ~8–12m horizontally, at 1.6m and 6m heights. Reject probes inside solid
   geometry.
2. At each probe, render a small cubemap (64² is plenty for diffuse) and project to SH9.
   Export as JSON — 9 RGB coefficients per probe is ~108 bytes; a whole zone is a few tens
   of KB.
3. At runtime, trilinearly interpolate the 8 surrounding probes to the player position each
   frame, write the result into a single `LightProbe`, and **replace the hemisphere light
   for dynamic objects only**. Static geometry keeps its lightmap.

⚠️ **Light leaking is the failure mode.** Irradiance is discontinuous at walls, so a probe
on the wrong side of a ruin wall will light the player as if they were outside. `[S]`
Mitigations, in order of effort: reject probes whose position is enclosed, weight
interpolation by a visibility raycast from the sample point, and keep the probe grid coarse
enough that you can eyeball-verify every probe in a zone.

**Cheaper 80% version if that's too much:** two hemisphere-light presets (open / enclosed),
cross-faded by a downward+outward raycast occlusion test around the player, updated a few
times per second. Ugly in principle, nearly invisible in practice at these light levels, and
it fixes the worst of the "pasted on" read for about 20 lines.

---

# 5. ALIASING — SMAA is the wrong tool for the shimmer you have

`TOOLKIT.md` §3 specifies `SMAAEffect` at ULTRA and correctly notes that three's
`TAARenderPass` only converges with a static camera. `[S]` Both true. But the aliasing that
will actually hurt this game is **specular and normal aliasing on rim lights against the
bright moon sky** — thin bright edges on dark shapes, in motion. SMAA is a spatial edge
filter. It cannot fix temporal specular sparkle, and turning it up won't help.

**Fix the cause first — this is free and usually sufficient:**

- **Clamp roughness to a floor** (~0.25 minimum on distant/small geometry). Sharp speculars
  on sub-pixel geometry are the sparkle source.
- **Bias roughness upward with mip level** — the standard Toksvig-style fix. As normal-map
  detail averages away in the mips, the surface must get rougher to compensate, or it
  produces energy it shouldn't have.
- **Cap `rimPower` and fade rim strength with distance.** The `TOOLKIT.md` §4.3 rim term is
  a `pow()` on a view-dependent dot product — it is inherently a sub-pixel sparkle generator
  at distance. Fade it out past ~40m; nothing is reading silhouettes at that range anyway,
  the fog is doing that job.
- **Scale blades to zero rather than alpha-fading** — already specified in §7.1, make sure it
  actually shipped, because grass tips against a moonlit sky is the worst case in the game.

**Only if that's not enough**, add temporal. The working pattern is motion-vector
reprojection with 3×3 neighborhood clamping — effective specifically on specular aliasing
and holds up in motion, unlike the built-in pass. `[S]` A reference implementation exists
(`NickGerleman/taa-demo`). Two cautions: it needs a motion-vector buffer you do not
currently render, and it will smear the particle systems (embers, fireflies, rain) unless
you exclude them.

**Middle path worth considering first:** apply temporal accumulation to **AO and god rays
only**, at half res, reprojected. Those two are the noisiest and slowest passes, they're
low-frequency enough that reprojection artifacts don't read, and it buys you a quality tier
without touching the main image. This pairs well with `shadowMap.autoUpdate = false`
(§4) — in a world where the moon never moves, most of the frame is genuinely static.

---

# 6. MATERIALS — the two things that make stylized PBR look cheap

## 6.1 Texture repetition (triplanar does not fix this)

`TOOLKIT.md` §6 specifies triplanar with height-based blending. That solves *stretching* on
cliffs. It does not solve *repetition* — the same tile visibly recurring across mid-distance
ground, which is the more common giveaway.

Two techniques, both standard, neither in the docs `[S]`:

1. **Macro variation:** overlay a very low-frequency noise (world-scale, one octave, ~30–80m
   period) onto albedo *and roughness*. Grey values only — the source image doesn't matter,
   it exists purely to break the eye's pattern detection. Halve the strength you first think
   you want; harsh macro variation reads as blotching.
2. **Distance retiling:** sample the same texture at a second, much larger UV scale and
   blend toward it with camera distance. Near geometry keeps its detail, far geometry gets a
   tiling period longer than the visible area, and the repetition disappears.

```glsl
float macro = texture2D(uMacroNoise, worldPos.xz * 0.015).r;
albedo   *= mix(0.85, 1.15, macro);
roughness = clamp(roughness + (macro - 0.5) * 0.15, uRoughMin, uRoughMax);

// distance retiling
vec3 far  = texture2D(uAlbedo, worldPos.xz * uFarScale).rgb;
albedo    = mix(albedo, far, smoothstep(25.0, 90.0, vDist));
```

Note this costs texture fetches on top of triplanar's 3×. Follow §6's own advice and blend
it in only where it's needed — macro variation on the ground planes, not on every surface.

## 6.2 The plastic look

Diagnosis, and it's almost always the same one: **too much high-frequency noise and too
narrow a roughness range.** High-frequency detail standing in for real surface variation
produces the dirty-and-plastic read simultaneously; the cure is low-frequency macro
variation with **clamped roughness ranges** instead. `[S]`

This agrees with `DIRECTION.md` Part 9 ("minimal surface noise, broad shapes, large
gradients") — so if the build looks plastic, the likely story is that the spec was written
correctly and the implementation reached for noise anyway. Worth checking directly.

Practical floors for this art direction: roughness never below 0.25 except wet stone and
water; never above 0.9 (fully rough kills the moon's specular, which is doing a lot of the
silhouette work); and **real spread between materials** — wet stone 0.25, old bronze 0.45,
dry stone 0.7, cloth 0.85. If everything in the scene sits between 0.5 and 0.6, nothing
reads as a distinct material regardless of albedo.

---

# 7. 🔶 THE LENS — probably the single highest-leverage line in this document

`DIRECTION.md` Part 5 is an excellent composition law: four depth bands, one focal point,
dark foreground framing mass, 4+ planes separated by haze. Nothing in it, or in `TOOLKIT.md`,
specifies **field of view** — and FOV controls whether that composition is achievable at all.

three.js `PerspectiveCamera` defaults to **75°**. On a 16:9 frame that is roughly a **24mm**
lens. Wide lenses expand apparent depth: near objects loom, distant objects shrink fast, and
the midground and background separate hard. That is the opposite of the concept-art read
this game is asking for. Longer focal lengths **compress** — they pull background and
subject together and make a distant mountain or structure read as *looming*. `[S]`

Every reference in Part 1 — Shadow of the Colossus, ICO, BOTW's distant vistas, Mononoke's
forests — is built on compression. The colossus reads as enormous *because* the lens flattens
it against the player. At 75° a 200m statue at 300m distance will read as a small object far
away, and no amount of asset work will fix it.

**Proposed lens law:**

| Context | Vertical FOV | ≈ focal length | Why |
|---|---|---|---|
| Gameplay default | **50°** | ~40mm | Enough peripheral awareness to move; already far more compressed than 75° |
| Traversal / open vista | **45°** | ~47mm | Compresses the layered planes; this is the postcard read |
| Reveal volumes, postcard poses (`DIRECTION` 11.1) | **32–35°** | ~65mm | Full concept-art compression. Hold 1–3s, then ease back |
| Interiors / tight ravines | **60°** | ~30mm | Purely functional — don't let claustrophobia become nausea |
| Sprint | default **+5°**, eased | — | The standard speed cue; keep it small |

Ease FOV changes over 0.4–0.8s. Never snap.

⚠️ **This interacts with gameplay and must be verified, not just applied.** Narrower FOV
means less peripheral vision, which can make platforming and combat feel worse and can
increase motion sickness for some players. It also changes what `composecheck.mjs` measures —
every gate in `DIRECTION` 11.2 will shift, particularly sky fraction and edge mass, so
re-baseline the shots after changing it. Ship it behind a settings slider (55–75) with 50 as
the default, which is also the accessibility-correct answer.

**Cheap test before committing:** take one existing postcard pose, render it at 75/60/50/35,
and put the four frames side by side. This is a 10-minute experiment and I'd expect it to be
the most visible single change available.

---

# 8. WET GROUND — the requirement with no recipe

`DIRECTION.md` Part 6 lists "wet ground reflections" as required atmospherics. `TOOLKIT.md`
§3 correctly kills the obvious path — `screen-space-reflections` is archived,
`realism-effects` is dead. So the requirement currently has no implementation.

**Do not add SSR.** For this scene it is the wrong cost/benefit: expensive, noisy in the
dark, and its failure mode (missing reflections at screen edges, which is where the framing
masses are) hits exactly the compositions Part 5 asks for.

**Do this instead**, in increasing order of cost:

1. **Porosity/wetness mask, no reflection at all.** Wet surfaces are *darker albedo, lower
   roughness, flatter normals*. Drive all three from one mask and the moon's specular does
   the rest. In a scene with one dominant light this reads as convincingly wet and costs
   nothing. Start here — it may be all you need.
2. **Puddles as flat geometry.** Even where the ground under a puddle is uneven, a water
   layer gives a **flat surface normal** `[S]`, so puddles can be authored as flat discs
   with a normal of straight up, sitting slightly proud of the terrain. That alone produces
   the sharp moon glint that sells wetness.
3. **One confined `Reflector`.** Planar reflection is practical for a single dominant
   reflector in a forward renderer `[S]` — so allow **one per zone**, on the largest still
   water or the courtyard puddle nearest the focal point, at quarter resolution, with
   roughness blurring the result. Never a second one; each costs a full extra scene render,
   which is exactly the trap `TOOLKIT.md` §8 flags for `Water.js`.

`DIRECTION.md` Part 8 already says still water doubles your composition for free — that
argument applies to puddles at 1/50th the size, and a puddle reflecting a single distant
warm light is one of the cheapest strong frames available.

---

# 9. WHAT NOT TO DO

Recorded so the build agent doesn't spend a week on them.

- **Don't migrate to WebGPU/TSL mid-build.** The ceiling is genuinely higher (see the LAAS
  breakdown in `research/agentic-3d-graphics-opus5-fable5.md`), but nothing in §0's triage
  needs it, and every item here ships on the existing WebGL stack. Revisit after ship.
- **Don't add more lights.** `TOOLKIT.md` §4's forward-rendering ceiling (30–50 point lights)
  and `DIRECTION.md`'s three-major-lights rule are both correct. If a scene reads flat the
  answer is contrast and composition, never more lights.
- **Don't raise the ambient floor** to make things visible. That is the specific failure
  `DIRECTION` Part 6 names. If something important is invisible, fix it with rim light,
  lighter mid-distance fog behind the silhouette (`TOOLKIT.md` §5.2), or by moving it — not
  by lifting blacks.
- **Don't add detail to fix flatness.** Priority ladder Part 2 is right: composition,
  lighting and silhouette outrank materials and micro-detail by five places. Almost every
  "needs more detail" instinct is actually a value-grouping problem — depth comes from light
  and value grouping, not from detail, and the fix is to *blend* values in unimportant areas
  and boost contrast only at the focal point. `[S]`
- **Don't bloom your way out of it.** Already flagged in `TOOLKIT.md` §3, repeated because it
  is the most common panic response to a flat frame and it makes blacks fog up.

---

# 10. NEW `composecheck.mjs` GATES

`DIRECTION.md` 11.2's metric table is strong. These four additions catch the failures above,
and all are cheap to compute from the same screenshots. This follows the finding from the
prior research doc: **agents fix what is measured in numbers and ignore what is described in
adjectives** — a critic that says "moodier" produces mud.

| Metric | How to measure | Gate |
|---|---|---|
| **accent hue drift** | Sample pixels within ΔE 15 of `#E8A13C`; mean hue angle vs. the source | ≤ 6° drift. Catches §1 tone-mapper skew directly |
| **banding score** | Sky region only: histogram of unique 8-bit values per column; count runs of ≥6 identical adjacent values | < 2% of columns. Catches §3 |
| **material spread** | Std-dev of sampled roughness across the G-buffer / debug view | ≥ 0.15. Catches §6.2's "everything is 0.55" |
| **silhouette separation** | Mean L delta across the boundary of the foreground framing mass | ≥ 25 L. Catches the shape-lost-in-darkness failure `TOOLKIT.md` §5.2 exists to prevent |

Add a **tone-mapper A/B script** (`scripts/tonemap-ab.mjs`) while you're in there: render
each postcard pose under ACES / AgX / Neutral at matched exposure, emit accent hue drift and
banding score for each, write a contact sheet. That turns §1 from an argument into a table.

---

# 11. SUGGESTED ORDER

Sequenced so each step is independently verifiable, cheapest-first, and so nothing later
invalidates the baseline of anything earlier.

1. **Lens A/B test** (§7). 10 minutes, no code shipped, largest expected delta. Decide FOV
   before re-baselining anything else, since it moves every composecheck gate.
2. **Blue-noise dither** (§3). Isolated, no interactions, kills the cheapest-looking artifact.
3. **Tone mapper A/B** (§1, §10). Decide with the script; if it changes, re-grade the LUT.
4. **Re-baseline** all composecheck shots. Steps 1 and 3 invalidate the old ones.
5. **Roughness discipline + macro variation** (§6). Tuning before code.
6. **Purkinje shift** (§2). Do this after §1 — it is far easier to tune on a neutral transform.
7. **Aliasing causes** (§5), tuning only. Re-evaluate whether temporal is still needed.
8. **Light probes** (§4). The biggest build item here; do it once the frame is otherwise right.
9. **Wet ground** (§8), starting at the mask-only tier.
10. **New composecheck gates** (§10) wired into the judge loop, then let it run.

Per the sequential-ownership finding in the prior research doc: **§1, §2, §3 and §5 must be
owned by one agent, sequentially.** Tone mapping, the night model, dither and aliasing all
write to the same frame and interact; splitting them across parallel agents is the exact
pattern measured at +0.46 with coupling failures, versus +1.00 and 66→26 defects for
sequential single ownership.

---

## Sources

- https://discourse.threejs.org/t/tone-mapping-overview/75204 — ACES vs AgX vs Neutral comparison
- https://github.com/mrdoob/three.js/issues/27362 — AgX support in three.js
- https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/ — how to (and how not to) fix banding
- https://momentsingraphics.de/BlueNoise.html — free CC0 blue noise tiles
- http://loopit.dk/banding_in_games.pdf — banding in games reference
- https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/
- https://threejs.org/docs/#api/en/materials/Material.dithering
- https://forums.unrealengine.com/t/unlocking-the-night-crafting-an-blue-night-filter-with-the-purkinje-effect/1750941
- https://dl.acm.org/doi/10.1145/2644813 — day-for-night / scotopic retargeting
- https://threejs.org/docs/pages/LightProbe.html and https://github.com/mrdoob/three.js/pull/16223
- https://discourse.threejs.org/t/probes-volume-purposal-for-three-js/57921 — irradiance volumes, light leaking
- https://github.com/NickGerleman/taa-demo — motion-vector TAA with neighborhood clamping
- https://threejs.org/examples/webgl_postprocessing_taa.html
- https://www.worldofleveldesign.com/categories/ue4/landscape-macro-tiling-variation.php
- https://aitextured.com/articles/7_proven_ways_to_break_texture_repetition_on_large_surfaces.html
- https://www.fxguide.com/fxfeatured/game-environments-partc/ — wet environments, porosity, flat puddle normals
- https://docs.vulkan.org/tutorial/latest/Building_a_Simple_Engine/Advanced_Topics/Planar_Reflections.html
- https://www.creativebloq.com/art/digital-art/how-to-master-light-and-depth-in-photoshop — value grouping
- https://80.lv/articles/lighting-tutorial-creating-realistic-environment-concept-art
- https://cameraspecscomparison.com/guides/focal-lengths-explained-28mm-35mm-50mm-85mm/ — compression by focal length

*Fewer changes, measured. The lens and the dither are two lines and they are probably half
the gap.*
