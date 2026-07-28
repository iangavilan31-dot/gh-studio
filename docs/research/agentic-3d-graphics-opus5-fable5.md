# Raw research notes — how people are getting genuinely good-looking 3D out of agentic coding (Opus 5 / Fable 5 era)

Researched 2026-07-28. Companion to `TOOLKIT.md` (what to install) and `DIRECTION.md`
(what it should look like). This file is about **method** — the harness, the loop, and the
context that separates "AI made a three.js scene" from "AI made something that stops the
scroll."

Confidence tags: `[S]` = sourced from a cited page below; `[C]` = consensus across several
sources/community; `[A]` = my inference from the evidence, not directly stated.

---

## 0. The one-sentence finding

Nobody who is producing beautiful 3D is doing it by prompting for beauty. **Every strong
result in the wild comes from the same three-part structure: a written art brief with hard
floors, a machine-readable measurement harness the model runs on itself, and a long
autonomous loop against reference images.** The model is the least differentiated part.
`[C]`

The blunt version, from a skill pack built specifically for this problem: *"you cannot just
prompt the agent for 'good graphics' and expect the agent to produce it. The agent needs to
see the exact implementation of said good graphics."* `[S]`

---

## 1. Model landscape (as of July 2026)

| Model | Position | Relevant evidence |
|---|---|---|
| **Claude Fable 5** | Anthropic's frontier model. SOTA on **vision**, and the one people reach for on long-horizon autonomous graphics work. Reflects on and validates its own work. $10/M in, $50/M out. | Anthropic: rebuilds a web app's source from screenshots alone; finished Pokémon FireRed from raw screenshots with minimal scaffolding; designed 3D-printable CAD models autonomously. `[S]` |
| **Claude Opus 5** | Launched 2026-07-24. Near-Fable intelligence at ~half the price; SOTA on coding/agentic benchmarks (Frontier-Bench, GDPval-AA). | The Claude-of-Duty FPS demo. `[S]` |
| **Claude Mythos 5** | Announced alongside Fable 5, same price tier. | `[S]` |

**The practical split people report** `[C]`:

- **Opus 5** for the volume of engineering — subsystems, physics, refactors, the 50k-line
  grind. Cheaper, so you can afford the 500-turn loop.
- **Fable 5** for the *seeing* — art-direction critique, screenshot judging, "why does this
  look like a student project," and the hard graphics passes where the model has to look at
  its own render and disagree with itself.

One directly comparable data point, and it is a big one: Sebastian Kits ran the same
three.js foliage scene (200k trees, voxelised) on both. Opus burned **50M+ tokens and never
got there** — bad performance, bad look. Fable landed it in **~4–5M tokens**, taking the
scene from ~25fps to shippable. `[S]` Treat this as one anecdote, not a benchmark, but it
matches the general pattern: on *visual* convergence, the vision-stronger model pays for
itself despite the price. `[A]`

**Implication for a budget build:** Opus 5 as the build agent, Fable 5 as the judge/critic
in the loop. That maps exactly onto the judge-file pattern already in `DIRECTION.md`. `[A]`

---

## 2. The three workflow archetypes

### 2.1 One-shot spec prompt (minutes, demo-grade)

The viral "one prompt → playable 3D world" clips. Real, and better than people expect —
Peter Gostev's set of 63 three.js worlds (underwater Manhattan, walkable *Starry Night*,
large procedural cities) mostly worked on the first pass. `[S]`

The part that gets lost in the retweets: **"These worlds were not produced from one tiny
sentence."** The prompts were specification-style technical design briefs covering camera
behaviour, lighting, object density, performance constraints, and procedural rules. `[S]`
The one-shot is real; the *one-sentence* is not.

Costs from the wild, useful for calibration `[S]`:

- Minecraft-style clone (biomes, caves, ores, day/night, mobs): 37 min, ~3k LOC, **$12 API**
- Three.js recreation of the *Friends* apartment from floor plans, single HTML file: **$12**
- Mario-Kart-64-style racer, 4 maps, 3 modes, music: ~15 min from a two-sentence prompt
- Single-file black hole sim (gravitational lensing, doppler-boosted disk, photon sphere)
  at 60fps: one prompt

### 2.2 Long-horizon autonomous build (days, the good stuff)

This is where the actually beautiful things come from. Two documented builds, both worth
reading in full.

**LAAS — `Braffolk/fable5-world-demo`. The most important reference for us.** `[S]`

- 4×4 km fully procedural open world, **WebGPU only** (`WebGPURenderer` + TSL materials +
  raw WGSL compute), ~21k lines of strict TypeScript, zero `any`, 90+ commits.
- Content: 4096² heightfield with hydraulic + thermal erosion, flow-accumulation rivers,
  ~190k trees across six species from procedural branching grammars (**every tree
  geometrically unique — no mesh reuse**), 450k understory instances, ~1M grass blades/frame,
  GPU-driven clustered Poisson scatter with per-frame culling.
- Render: four-cascade shadows with PCSS + screen-space contact shadows, irradiance probe
  field for GI, Hillaire LUT atmosphere with aerial perspective, raymarched volumetric
  clouds with shadow integration, SSR with terrain-aware fallback, froxel volumetrics,
  analytic caustics, TAA, hierarchical wind, 131,072 GPU particles.
- **The human wrote ~1% of the output: one document.** `PROJECT_LAAS_v2.md` — visual targets
  (UE5 reference frames), hard constraints (triangle budgets, world dimensions, shadow
  treatment), and *forbidden outcomes*: **no black shadows, no cloned trees, no fog abuse.**
  It deliberately omits implementation detail.
- Remaining human steering was **only what a static frame cannot carry**: wind sway
  amplitude, camera bob, cloud motion lag, water coverage. That is the correct division of
  labour and worth copying verbatim. `[A]`

**Claude of Duty — Opus 5 browser FPS.** `[S]`

- ~55k LOC, 11 subsystems, three.js r180 + WebGL2, zero art assets — everything procedural,
  including 19 GPU-generated PBR surfaces with parallax occlusion mapping and triplanar
  projection, plus Web-Audio-synthesised sound with no recorded files.
- Seed prompt asked it to fan out sub-agents, run **harsh visual critics doing blind A/B
  against real CoD**, and `/loop until it's utterly perfect`.
- **Honest outcome: critic scores peaked at 5.05/10** and blind A/B consistently favoured
  the real game. Blocky viewmodels, procedural material artifacts, mannequin enemies.
  Useful ceiling data.

### 2.3 Human-in-the-loop art direction (the realistic middle)

Play, screenshot, critique, prompt, repeat — but with the screenshots going *into* the
model, not just into your eyes. The honest limitation, from someone who built a whole
platform around it: *"Graphics-intensive work is significantly slower to iterate on with AI
than text-oriented work"* — "make particles fade gradually with blue shift in trails" is an
awkward, lossy translation through text, because LLMs are weak on spatial reasoning and
representational grounding. `[S]` That essay's conclusion is to move to sketch/markup
interfaces rather than better prompts.

---

## 3. The harness is the product

Both serious builds land on the same conclusion, independently: **the measurement
infrastructure mattered more than the prompting.** `[S]`

### 3.1 Tools the model builds for itself

From Claude of Duty `[S]`:

| Tool | Job | Why it mattered |
|---|---|---|
| `imagediff.mjs` | per-pixel visual gate | proves a change was *intentional*; catches silent regressions |
| `profile.mjs` | **gameplay-realistic** profiling, not static bench | exposed shader-compilation stalls a static bench hid |
| `baseline.mjs` | fresh isolated page per run | stops particle/decal state leaking between test runs |

From LAAS `[S]`: headless Playwright driving Chromium with WebGPU adapters, screenshot +
pixel-sample + frame comparison against baselines, **frame-aligned determinism checks**,
per-encoder GPU pass timing, and bug-specific regression probes written per discovered bug.

### 3.2 Determinism is a graphics feature

You cannot diff screenshots of a world that moves. Both builds solved this the same way:
clock-synchronised animation for reproducible frames `[S]`, and in LAAS a full URL
state-capture surface `[S]`:

```
?seed=N ?T=hours ?shot=1..9 ?cam=x,y,z,yaw,pitch[,fov] ?preset=low|high|ultra ?freeze=1 ?hud=1
```

`?freeze=1` and `?cam=` are the two that make an automated art-direction loop possible at
all. Every scene worth judging should be addressable as a URL. `[A]`

### 3.3 Persistent memory file

LAAS's `STATUS.md` is the model's session memory — known issues, measurements, architectural
decisions — and is what let coherence survive across long autonomous sessions. `[S]`
Supporting docs each had one job: `THREE-NOTES.md` (verified API facts it had to re-learn),
`DELTA.md` (reference-comparison phase loops), `DEVIATIONS.md` (spec deviations *with
justification*). `[S]`

`DEVIATIONS.md` is the underrated one: it gives the model a legal way to disagree with the
brief instead of silently ignoring it. `[A]`

### 3.4 Measure physical quantities, not adjectives

The single sharpest lesson in the whole corpus: on Claude of Duty, one agent **contradicted
the brief** — raising diffuse albedo when the brief said crush it — because measured
luminance (L) values outweighed critic language calling the weapon "untextured." `[S]`

Corollary: critics that say "make it moodier" produce mud. Critics that report L values,
frame times, and histogram spread produce fixes. `[A]`

### 3.5 Fan-out is not free

Counter-intuitive and directly relevant to `FINAL_PASS.md`: parallel fan-out of six
independent agents per subsystem produced **+0.46** score while introducing coupling
failures. **Sequential ownership by a single agent** over interdependent systems (lighting,
tone-mapping, sky) produced **+1.00** and cut defects **66 → 26**. `[S]`

Rule: fan out across *independent* surfaces (audio, UI, physics). Keep the entire
light/tonemap/sky/material chain under one agent, one at a time. `[C]`

### 3.6 "Loop engineering"

The term coined June 2026 for this: designing systems that prompt agents autonomously rather
than typing prompts yourself. `[S]` The perceive–reason–act cycle — screenshot via MCP →
inject as multimodal input alongside textual state → act — is now the standard shape across
Unreal/Unity agent work too. `[S]` Academic work on image-to-3D uses the same frame:
show the model *its previous code, turntable renders, and the reference images*, ask it to
accept or emit corrected code, with a **revert-on-break guard**. `[S]`

---

## 4. Context packs / skills — the unglamorous multiplier

three.js moves fast enough that model training data is always stale, and that is where a lot
of the "AI three.js looks bad" reputation actually comes from — deprecated API (`PI2`),
missing WebGPU device-loss handling, non-idiomatic TSL, half-finished post chains. `[S]`
Packaged skills fix this by pinning verified API surface into context.

What exists and is worth mining (all `[S]`):

- **`dgreenheck/webgpu-claude-skill`** — WebGPU/TSL: core concepts, materials, compute
  shaders, post-processing, WGSL interop, templates. Aligned to **r183+**.
- **`scottstts/Threejs-Awesome-Graphics-Agent-Skills`** — 26 skills: procedural
  animation/fields/materials/geometry/vegetation/architecture/planets, spectral **FFT ocean
  synthesis**, water optics, precipitation, aerial perspective, volumetric clouds, shadow
  systems, AO, bloom, exposure/color grading, parallax occlusion mapping, raymarched space
  effects, temporal surfaces. Its operating model demands every graphics system ship:
  deterministic reproducible inputs, **named perceptual control fields**, diagnostic
  outputs, stability rules across scale and time, quality tiers, and **a functional baseline
  that works with post-processing off.**
- **`majidmanzarpour/threejs-game-skills`** — a director skill routing to gameplay-systems,
  aaa-graphics-builder, 3d-generator, image-generator, audio-generator, qa-release. Gates
  worth stealing: *playable loop before static scene is "done"*; *mobile input + resize in
  the first implementation, not a later pass*; **"generic stat-cards and cube obstacles are
  prototype placeholders unless explicitly requested"**; premium claims require a filled
  visual scorecard with fresh-eyes review and all categories ≥ 2.

That last pack's ordering rule is the best single line of graphics advice in the corpus:

> **"Do not make primitives look AAA by adding glow. First build authored forms, then
> materials, then lighting, then effects."** `[S]`

It also refuses procedural-only as valid for a premium claim unless blockers are documented —
at least one hero surface must carry a generated/authored asset. `[S]` Note that this is in
direct tension with what Claude of Duty and LAAS did (both 100% procedural), and Claude of
Duty's own honest verdict — blocky viewmodels, mannequin characters — is evidence the skill
is right about **characters and hero props** specifically. `[A]`

---

## 5. Stack consensus, July 2026

- **WebGPU is production-ready.** Safari 26 (Sept 2025) was the last holdout; all major
  browsers ship it. `three/webgpu` has been zero-config since r171, with automatic WebGL2
  fallback. Guidance: no urgent migration for stable projects, **but new projects should
  start on WebGPU**. Reported gains 2–10x on complex scenes, up to 100x on heavy compute
  (point clouds). `[S]`
- **This contradicts `TOOLKIT.md` §1.2** ("stay on WebGLRenderer, do NOT adopt WebGPU/TSL").
  That call was defensible for a shipping WebGL build with a `postprocessing` peer pin —
  but the frontier work (LAAS) is WebGPU/TSL/WGSL and **explicitly refuses a WebGL
  fallback**, failing loudly instead of degrading silently. `[S]` See §7 for how to hold
  both.
- **TSL** = write shaders in JavaScript as a node graph instead of GLSL/WGSL strings;
  it is what makes agent-authored shaders debuggable and composable. `[S]`
- The "looks good" delta in WebGL land is still, in order: **tone mapping (ACES/AgX) →
  exposure (0.8–1.2) → correct color space → AO → shadows with real softness → bloom last.**
  Without tone mapping, highlights clip to white and colour relationships collapse — this is
  precisely the "flat AI render" signature. `[S]`
- three.js is at ~2.7M weekly npm downloads; the ecosystem effect is real and part of why
  models are good at it. `[S]`

---

## 6. Assets: procedural vs generated

Both flagship builds went **100% procedural, zero art assets** — LAAS generates all visual
content algorithmically at boot; Claude of Duty synthesised even its audio. `[S]` That is a
deliberate flex (it proves the model authored everything) and not necessarily the right
choice for a game you want to *look* good. `[A]`

The generated-asset lane, 2026 state `[S]`:

- **Rodin (Hyper3D)** — reported as the only one consistently dropping into a production
  pipeline without ~2 hours of cleanup.
- **Meshy** — broadest: text-to-3D and image-to-3D, remesh/retopo step, PBR textures,
  auto-rigging for characters.
- **Tripo** — fastest, cleanest topology; sharpest image-to-3D given a clean reference.
- **TRELLIS 2** (Microsoft Research) — best visual quality among free/open-source, Gaussian
  Splatting based.
- Photogrammetry/NeRF/splats for real-world environment capture.
- Trend: 2026 tools compete on **finishing** (retopo, UV, format conversion), not raw mesh.

**Blender MCP** is now the standard bridge: a stable MCP server exposing Blender's Python
API, so the agent writes scene-graph ops, Blender executes them live, and the render streams
back into the conversation. It can create objects, apply PBR materials, set up lighting,
pull **Poly Haven** assets, and generate meshes via **Rodin**. `[S]`
Documented hard limit: **anything character-driven fails** — it can place a generic humanoid,
but anatomy, posing, rigging and weight painting remain manual. `[S]`

---

## 7. What this means for MOONREST (actionable)

Ordered by expected delta per hour. `[A]` except where tagged.

1. **Make every judged scene a URL.** Adopt LAAS's parameter surface —
   `?seed`, `?T`, `?shot=1..9`, `?cam=`, `?preset`, `?freeze=1`, `?hud=1`. Nothing else in
   this list works without it. `[S]`
2. **Build the three harness tools before the next art pass**, not after: per-pixel
   `imagediff`, gameplay-realistic profiler (not a static bench — it will hide shader
   compile stalls), and a fresh-page baseline runner. `[S]`
3. **Make the critic report numbers.** `composecheck.mjs` should emit luminance means,
   histogram spread, and shadow-region L floors alongside the prose score — and the build
   agent should be told numbers outrank adjectives, including the brief's own adjectives. `[S]`
4. **Restructure `FINAL_PASS.md` fan-out:** single sequential owner for the
   lighting → tone-mapping → sky → material chain; parallel only across genuinely
   independent surfaces. Expected +1.00 vs +0.46, and far fewer coupling defects. `[S]`
5. **Add a `DEVIATIONS.md`** so the agent can disagree with `DIRECTION.md` on the record
   instead of silently. Add a `THREE-NOTES.md` for API facts it verifies, so it stops
   re-deriving them each session. `[S]`
6. **Add forbidden outcomes to `DIRECTION.md`.** LAAS's brief is short and its teeth are
   the negatives: no black shadows, no cloned trees, no fog abuse. Ours should name its own —
   `[A]` candidates: no untextured primitives, no uniform-height vegetation, no single global
   ambient, no bloom used to hide flat materials.
7. **Kill mesh reuse on hero vegetation.** ~190k trees, each geometrically unique from a
   branching grammar, is what makes LAAS read as a forest rather than a tiling. `[S]`
8. **Revisit the WebGL/WebGPU call.** Recommendation: keep `WebGLRenderer` for the shipping
   build (the peer pin and the r185 lock are real), but **stop treating TSL/WebGPU as
   out of scope** — the ceiling demonstrated on WebGPU is far above ours, and the migration
   cost only grows. Track it as an explicit deferred decision rather than a closed one. `[A]`
9. **Reconsider procedural-only for hero props and any character.** Procedural terrain and
   vegetation are proven; procedural *characters* produced "mannequin-like enemies" in the
   one build that tried at scale. Rodin/Meshy via Blender MCP for hero assets, keeping
   everything else procedural. `[S]`
10. **Model split:** build on Opus 5, judge on Fable 5. The judge loop is where vision
    quality converts to pixels, and it is the cheaper half of the token spend. `[A]`

---

## 8. Honest limits of this research

- The Opus-vs-Fable foliage comparison is a single X post, not a benchmark. `[S]` but n=1.
- Several one-shot demo costs/timings come from X posts aggregated in a link list; I did not
  independently verify the artifacts. `[S]`-with-caveat.
- The `threejs-aaa-graphics-builder` numeric budgets and calibration anchors live in files I
  did not retrieve (`visual-scorecard.md`, `technical-art.md`); only the enforcement rules
  and gate structure above are sourced. Worth a follow-up fetch.
- No source in this corpus demonstrates a vibe-coded 3D game that beat a shipped commercial
  title in blind A/B. The honest ceiling today is "looks genuinely good," not "looks AAA."
  Claude of Duty's own README says so. `[S]`

---

## Sources

- https://www.anthropic.com/news/claude-fable-5-mythos-5
- https://github.com/Braffolk/fable5-world-demo
- https://explainx.ai/blog/claude-of-duty-opus-5-procedural-fps-july-2026
- https://x.com/SebastianKits/status/2072816764363157832
- https://dev.to/67_3ef937cdc740861f5/fable-5-creates-playable-3d-worlds-underwater-manhattan-living-paintings-and-63-threejs-hjn
- https://github.com/Anil-matcha/awesome-claude-fable-5
- https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills
- https://github.com/majidmanzarpour/threejs-game-skills and its `AGENTS.md`
- https://github.com/dgreenheck/webgpu-claude-skill
- https://www.utsubo.com/blog/threejs-2026-what-changed
- https://meditations.metavert.io/p/when-ai-learns-to-paint-threejs-and
- https://explainx.ai/blog/what-is-loop-engineering-ai-agents-2026
- https://thenewstack.io/anthropics-opus-5-almost-fable-5/
- https://blendermcp.org/setup/claude and https://clskillshub.com/blog/claude-blender-3d-rendering-2026
- https://www.mindstudio.ai/blog/claude-blender-mcp-real-world-performance
- https://www.meshy.ai/blog/best-ai-tools-for-3d-game-assets
- https://www.summerengine.com/blog/ai-3d-game-asset-generator
- https://threejs-journey.com/lessons/realistic-render and
  https://discourse.threejs.org/t/tone-mapping-overview/75204
- https://arxiv.org/pdf/2606.01057 (3DCodeBench — agentic procedural 3D modeling via code)
- https://arxiv.org/pdf/2604.25318 (Cutscene Agent — perceive/reason/act screenshot loop)
