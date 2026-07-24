# MOONREST — Progress Log (append-only)

Fresh-agent resume protocol: read docs/MASTER_PROMPT.md Part 0 + Part 12, then
docs/build/PLAN.md, then the tail of this file. Never re-derive the plan from memory.

---

## 2026-07-23 ~22:00 UTC — Run start, harness setup

**Done:**
- Master spec persisted verbatim to `docs/MASTER_PROMPT.md` (was supplied in-prompt; did not exist in repo).
- `docs/VIBE_BIBLE.md` and `docs/research/` do NOT exist anywhere in the repo (checked local tree, origin/main, all remote branches). Invoking the spec's self-sufficiency clause (Part 0.1). Logged as D1 in DECISIONS.md.
- Harness files created: PLAN.md, PROGRESS.md, JUDGE.md, DECISIONS.md, features.json, scripts/init.sh, CLAUDE.md compact instructions, .claude/settings.json SessionStart(compact) hook.
- `npm install three peerjs @fontsource/im-fell-english @fontsource/alegreya` kicked off.
- Repo state at start: Vite+React portfolio site (gh-studio), branch `claude/moonrest-autonomous-build-015qyb` checked out at 4cae6bf (== main). Branch not yet on origin.

**Verified working:** n/a yet (no game code).

**Next action:** M0 — replace app shell with game entry (`src/game/main.js`), build the 480×270 nearest pipeline + post pass + ZoneLight sky dome + proof scene, then shoot rig, then review the first screenshot.

**Learnings:**
- The repo's `docs/` folder was absent entirely; the user pasted MASTER_PROMPT content mid-session. Persist anything you're told to "read" if it must survive compaction.
- GitHub MCP tools are the only GitHub access (no `gh` CLI). Push with `git push -u origin claude/moonrest-autonomous-build-015qyb`, then create draft PR via mcp__github__create_pull_request.
- Scratchpad for temp files: /tmp/claude-0/-home-user-gh-studio/49c5215f-625a-5670-9764-6f58a6fe2dff/scratchpad

---

## 2026-07-23 ~22:40 UTC — M0 COMPLETE: pipeline proof

**Done:**
- Game entry `src/game/main.js` replaces app shell (D2). Modules: `core/pipeline.js` (480×270 nearest RT → post shader quantize/dither/vignette/gamma → letterboxed canvas), `core/rng.js` (mulberry32, forkable, seeded), `art/textures.js` (paint core + cobble/grass/dirt/bark/canopy/flame/iron/glow recipes), `art/materials.js` (single retro ShaderMaterial: tex × vertexColor × ambient + emissive, manual fog, optional hemi/wind/vertex-snap), `world/zonelight.js` (Park record, 5-stop sky dome, fog==stop[4] assert).
- Proof scene: cobble ground (baked warm vertex pool), open-cage iron lamp with visible flame sprite + additive halo + ground glow decal, big canopy tree.
- `scripts/shoot.mjs` (preview server + headless Chromium `/opt/pw-browsers/chromium` + pose teleport + non-blank gate + console capture) and `scripts/init.sh` baseline.

**Verified (evidence):**
- `bash scripts/init.sh` → exit 0, "BASELINE OK", differRatio 0.382, console clean.
- `docs/build/shots/m0.png` REVIEWED: warm caged lantern + amber pool in saturated teal dark, fog band == horizon, chunky texels + dither, tree silhouette. Vibe rules 1/2/3/8/12 hold.
- 4:3 letterbox screenshot reviewed (black bars, no distortion). Post toggles exercised via setPost. Two fresh loads → identical sample stats (seeded RNG determinism).
- Build: 135KB gz JS (budget ≤1.2MB).

**Next action:** M1 — Lamplighter character (procedural mesh+anim), controller, orbit camera, Park graybox.

**Learnings:**
- `renderer.outputColorSpace = NoColorSpace` throws in three r179 — use LinearSRGBColorSpace for raw pass-through.
- THREE.Clock logs a deprecation warning (console-clean gate) — use performance.now() manually.
- Spawn `node_modules/.bin/vite` directly, not `npm run` (orphaned child on kill → port stuck). `pkill -f "vite preview"` clears strays.
- Playwright must use executablePath /opt/pw-browsers/chromium + --enable-unsafe-swiftshader for headless WebGL. Headless fps ~11-15 (software GL) — perf gate must run its own math, not trust headless fps as hardware proxy.
- renderer.info resets per render() — snapshot after scene pass, before post quad.

---

## 2026-07-23 ~23:30 UTC — M1 COMPLETE: The Lamplighter

**Done:**
- `art/characters.js`: procedural wizard builder — 914 tris (budget 2500), one 128px painted atlas (robe/skin/beard/leather/metal/wood/glass regions, UV-remapped primitives), bone hierarchy root/hips/spine/head/hat/beard/arms/legs, bent-tip hat, apex-down beard, lantern-staff with hook + swinging mini-lantern + own flame sprite/halo (player's light source). 4 co-op tints defined.
- `systems/anim.js`: distance-driven stride phase (no foot-slide by construction), idle breathe w/ hat counter-bob, walk/jog with brim flap, beard sway, lantern pendulum, overlays sit/lie/sleep/wave/point/channel/giggle.
- `systems/input.js` + `player.js`: WASD camera-relative (basis re-derived — see Learnings), 120ms ease-out accel, <90ms turn, hop 0.5m, slope>40° slide, C sit/lie, latency instrumentation.
- `systems/camera.js`: orbit smoothing 0.12s, collider pull-in w/ 0.25s recovery, FOV 55→59 jog ease, auto-frame ≤2°/s.
- `world/world.js`: Park graybox — displaced terrain w/ heightAt/surfaceAt, dirt loop path, 14 trees + Long Bench + bench lamp + 2 path lanterns + 2 loop benches, circle colliders, bounds r=30.
- `scripts/feelcheck.mjs` (permanent gate): 12 assertions, ALL PASS — walk 1.6 / jog 3.2 / fov 58.7 / decel / **latency 9.4ms** (<50ms spec) / hop apex 0.32m sampled / sit / lie / bounds 26≤30 / tree pushout d=1.54 / console clean.

**Evidence read:** player.png (silhouette: hat+beard+staff-lantern read), park.png (bench+lamp+path composition, player readable at ~13m in fog), anim/walk-*.png + jog-*.png (stride + robe sway + lantern swing), sit/lie/wave shots, feelcheck output above.

**Next action:** M2 — interact/kindle system, AudioEngine + Park generative layers, moon on arc.

**Learnings:**
- Camera-relative basis for yaw convention `rig faces +z at yaw 0`: forward=(-sin cy,-cos cy), right=(cos cy,-sin cy). Wave emote must go up-and-OUT (rotation.z≈2.15), not forward — forward poses are body-occluded from the follow cam.
- Emissive glass boxes read as glowing rectangles — keep lantern glass translucent (opacity<0.5) and let the flame sprite + halo carry the glow.
- Robe atlas must be painted near-white (#e2dcee) for dark tints (#4B3B6E) to survive the hemi light; character hemi = mix(fog*1.7, skyUp*2.1, wn.y).
- Actions verified numerically via __MOONREST__.boneDebug() — keep it; cheap bone-state assertions beat squinting at dark pixels.

---

## 2026-07-24 ~00:20 UTC — M2 COMPLETE: kindling + audio core

**Done:**
- `audio/engine.js`: master→music/ambience/sfx buses→tanh soft-clip limiter; procedural convolver impulses (2.5s + 4s Hall); tape hiss -42dB; tab-blur 1s fade; per-bus AnalyserNodes for RMS evidence; ctx.resume guard.
- `audio/score.js`: generative engine — per-zone key/mode/BPM table (all 8 zones), 4-bar seeded random-walk ostinati over i–VI–III–VII chord tones, 8-bar variation regen, layer gains faded by kindle count (≈4s). Instrument recipes: pad/harp/celesta/kalimba/musicbox/flute/choir(formant stack)/bass/bell(inharmonic)/organ(additive)/pizz/horn.
- `audio/sfx.js`: footsteps ×6 surfaces (filtered noise + knock body, pitch jitter), kindle channel shimmer (3 rising sines) + chime (zone-key root+fifth+octave, bell partials), UI tick/confirm, brew "hmm!" formant blip.
- `systems/interact.js`: 2m prompt w/ LOS sampling, hold-E 1.2s channel (staff-raise pose), interrupt handling, event log for rigs.
- `ui/hud.js` + index.html #ui: rune-ring prompt w/ conic progress (SVG stroke), subtitle line (a11y), zero persistent HUD.
- `world/particles.js`: instanced-quad billboard system (shader camera-basis billboarding — NOT gl_PointSize, which is unreliable across drivers), per-system update fns, ember burst effect.
- `world/night.js`: 40-min moon clock; painted moon face (maria + sleeping face + limb shade) + additive cross-flare; arc zenith→western horizon; follows camera (noFog — Rule 6); skipTo debug.
- Cold-light registry in world: 4 Park lights (bench lamp, 2 lanterns, firefly jar) with per-light bloom ramp (2s ease-out), forever-flicker, per-instance materials (NEVER clone retro materials — severs shared fog uniforms).

**Evidence read:** `scripts/kindlecheck.mjs` 13/13 PASS (prompt at 1.4m yes/4.7m no, interrupt logged, kindle registered+persists, layers 0→2→4 tracking kindles, music RMS 0.038, nightT skipTo, console clean). Footstep one-off: sfx RMS 0.0032 while walking. Shots reviewed: during-channel.png (ring + verb), moon-early/late.png (moon high→low on arc, painted face + cross-flare, kindled lamp glowing with visible candle flames).

**Next action:** M3 — world blockout: all 8 zones + Foglands, ZoneLight blending, all shoot poses.

**Learnings:**
- Headless swiftshader runs ~11fps → hold-to-channel needs generous test timings (2.4s hold for a 1.2s channel).
- AudioContext in headless works with --autoplay-policy=no-user-gesture-required + ctx.resume(); AnalyserNode RMS is the listen-proxy for "is it audible".
- Bloom/flicker per light needs per-instance materials from retroMaterial() — ShaderMaterial.clone() would break shared global uniform references (fog/ambient lerps would stop reaching clones).

---

## 2026-07-24 ~01:40 UTC — M3 COMPLETE: world blockout

**Done:**
- `world/layout.js`: global heightfield (park bumps, village 8m street climb w/ S-curve, elevated rooftop strip + ladder ramp, sea basin + isle rise + causeway, ruins plateau, gloomspire moat ring + approach causeway, hall interior floor, mosswood floor), surfaceAt (grass/dirt/cobble/shingle/sand), BOUNDS, MOSSWOOD_ARCH.
- `world/zonelight.js`: all 8 zone records + 6 fogland corridor records (Part 2.1 palettes verbatim; fog==stops[4] asserted at boot AND post-blend), nearest-2 signed-distance blending w/ ~4s lerps, elevation-gated zones (rooftops minY 7 dominates its parent volume when up).
- `world/world.js` full rewrite: ribbon road system draped on terrain, sea+moat water (scrolling), village (7 houses, spire tower w/ handless clock, covered well, 4+2 cold lights incl. bakery window + well lantern), rooftops (garden, pine, 2 hanging lanterns + telescope brazier), ruins (colonnade w/ 2 intact blue-capital columns, façade, domed shrine, rune monolith w/ cyan glyph, dry moonwell, CYAN sconces ×4), gloomspire (castle + 3 green-coned towers, open gatehouse, toxic-green flickering windows, red door, moat, 4 causeway lanterns + brazier), hall interior (walls/ceiling/columns/stone floor/red carpet/emerald runner/dais+throne/3 pre-lit chandeliers/6 cold sconces), mosswood (6 colossal trunks, torus arch + 2 hanging lanterns + 2 trail lamps, world-edge loop), isle (keep + crenellations, palms, 2 causeway lamps + cove beacon + keep brazier), foglands (6 fingerposts, 20 pre-kindled breadcrumb lanterns). 37 cold lights registered total.
- AABB colliders + door corridors; mosswood arch mirror-loop; hanging-lantern sway; green-window flicker; score zone-switching wired to blended zone.

**Evidence read:** `traversecheck.mjs` 11/11 PASS (fog lerp 11 distinct values through corridor, fogland traversal, ladder→rooftops y=11.84 zone+surface flip, red door→hall z=150, causeway minY=0.70 + isle arrival, arch loop x-mirror, console clean). All 10 poses shot non-blank console-clean; screenshots REVIEWED: village (indigo, street leading line), rooftops (cobalt sky, handless clock), ruins (violet colonnade), gloomspire (castle+green windows+moat), hall (red carpet to throne, stone floor, chandelier glow), mosswood (trunk vignette + arch), isle (moon w/ cross-flare + keep + palm + causeway lamp), park, foglands. kindlecheck 13/13 + feelcheck 12/12 still PASS.

**Next action:** M4 — art pass I (Park/Village/Rooftops full art), texture factory recipes, vertex-color bake + warm pools, Beldam/chickens/Nib, hue-match gate.

**Learnings:**
- Emissive over white texture washes out to ambient beige — dark surfaces need dark VERTEX colors (or painted textures), never emissive-only tinting.
- Elevation-nested zones need a minY gate + dominance bonus or the larger parent volume always wins nearest-2.
- Steep intentional climbs (ladders) must be exempted from the slope-slide rule via a world query, or the feel spec fights traversal.
- Shot atmosphere: gate elevated zones by CAMERA height, probe XZ at the look target.
- Playwright walk tests: budget ~1.6m/s real seconds; jog with Shift in tests to keep them fast.

---

## 2026-07-24 ~03:10 UTC — M4 COMPLETE: art pass I (Park, Village, Rooftops)

**Done:**
- `world/stars.js`: 650 instanced star quads w/ seeded twinkle + per-zone density (rooftops 1.0 densest → hall 0), occasional slow meteor (25–60s gaps, Rule 11 gentle).
- `world/ambience.js`: rain streaks + splash rings (Park, eased, ground-aware), drifting canopy leaves, chimney smoke (2 anchors), moths orbiting kindled lamps (village/rooftops), snore-z spawner; `snapZone()` for leak-free cinematic shots.
- `systems/npc.js`: Beldam (bearded variant, sit pose, head-loll, snore-z + snore SFX, bench-lamp stir → subtitled mumble), 5 chickens (~200 tris; idle/peck/walk/flee-2m-then-forget; strut bob; clucks incl. alarmed), sleeping windowsill cat (breathing loaf), Nib (red-hat gnome, spread-eagle, hat-rise snore; hat gets non-hemi material + ember emissive so cobalt light can't crush the red).
- Village: pre-lit amber windows (Rule 5/2) w/ hearth breathing, crates/barrels/hanging signs (sway)/flower boxes/handcart/rain barrels; rooftops: shepherd-hook posts for lanterns, garden bed + pine; park: stumps/mushroom clusters/birdbath (w/ water)/low fences.
- Vertex-color bake (8.4): ground AO (under-canopy via treePads, under-eaves via AABBs) + per-light ground-vertex warm lists lerped during kindle bloom (WoW MOCV style); zone ambient stays a runtime uniform so cross-zone blending keeps working (documented deviation).
- `scripts/huecheck.mjs` hard gate + `__MOONREST__.samplePalette()` (RT pixel stats: weighted hue, median lum, warm/red fractions). Boot 257ms total, texture gen 31ms (<300ms budget).

**Evidence read:** HUE GATE PASS 3/3 (numbers in JUDGE.md). Shots REVIEWED: park.png kindled (lamp + warm ground pool + rain + stars + Beldam + fences), village close-up (glowing amber crossbar windows), village.png (street + lamps + windows + spire), rooftops.png (kindled lantern on hook + moths + pine + cobalt sky), nib.png (red hat + spread-eagle + chimney smoke puff). NPC probe: chickens idle/peck/walk seen, flee verified (1.9m), all NPCs positioned. kindlecheck 13/13, traversecheck 11/11, feelcheck 12/12 (hop assert flaky once — noted in JUDGE.md).

**Next action:** M5 — art pass II (Ruins, Gloomspire, Hall vertex-light showcase, Mosswood, Isle): Curator ghost, gargoyle, Pale King + ghost cat visual, Mote, water shader w/ moon streak, nebula, ground fog cards, hue gate for all 8.

**Learnings:**
- Saturated warm/red accents DIE under a cool hemisphere term — accent props need plain-ambient materials (+ touch of emissive), not hemi.
- Windows must be on street-facing walls to serve Rule 2; face selection by house side matters.
- The corrupted-hex-literal glitch (0x + garbage) struck 4×: use '#rrggbb' STRING color literals everywhere; THREE.Color accepts them.
- Cinematic rigs need zone-weather snapping AND subtitle clearing or shots inherit the player's zone state.

---

## 2026-07-24 ~05:30 UTC — M5 COMPLETE: art pass II (Ruins, Gloomspire, Hall, Mosswood, Isle)

**Done:**
- NPC cast completed (`systems/npc.js`): Curator ghost (translucent lathe, 5-waypoint colonnade patrol w/ dusting arm sweeps, bows to players once all 4 sconces burn, subtitled line), Pale King (ghost robe, tilted gold crown w/ non-hemi material, head-slump breathing) + ghost cat on his lap, gargoyle (horns/wings/perch, statue — head-turn logic in M6), Mote the moss tortoise (table-sized, shell breath, snore-z), seabird colony (6, tucked heads), cove hammock sailors (D9).
- Gloomspire: 13 luminous green windows (noFog emissive panes + additive noFog halos — fog-proof glow, the reference look), 6 violet nebula billboards, 4 lazy bats.
- Hall showcase (8.4): bakeHallShowcase() — every interior vertex painted: cold vault above, warm chandelier pools below (19 meshes; carpet/runner keep their dyes).
- Mosswood: 3 parallax ground-fog cards (drift + opacity breathing); Ruins: 70-bloom flower meadow, 4 bobbing mote crystals, half-buried owl statue; Isle: foam ribbon (scrolling), sea vertex ripple (USE_RIPPLE), moon streak aimed at live moon azimuth.
- Ambience additions: violet petals, arcane motes (moonwell-gated), spores + canopy drips, sea sparkle glints, hall floor mist.
- Gates stabilized: huecheck multi-frame sampling (6× max-accent/mean-hue); feelcheck timing bounds documented for dt-clamped headless sim.

**Evidence read:** HUE GATE PASS 8/8 (numbers + tolerances in JUDGE.md M5 entry); kindlecheck PASS; traversecheck PASS; feelcheck PASS. Shots REVIEWED (reel verdicts in JUDGE.md): ruins w/ drifting Curator, gloomspire w/ green windows + nebula, hall vertex-light pools, mosswood fog cards + arch, isle + sea (streak, foam, causeway lamps), park/village/rooftops re-verified.

**Next action:** M6 — systems complete: light→zone completion wiring (stirs, trinkets), 12 Moon Brews, ghost cat follower, gargoyle watch logic, moon clock beats (30/38/40min), real lunar phase, Night's End + attract, persistence, autopilot, dev overlay, perf gate (incl. D6 draw-call work: zone visibility culling + merge).

**Learnings:**
- Fog eats distant emissives — glowing set-dressing needs noFog on BOTH pane and halo to read like the reference; check saturation loss from additive-over-fog compositing when gating on color.
- Single-frame color gates flake on flicker/sway phase — sample several frames; max for presence metrics, mean for hue.
- dt clamp (0.1s) makes sim time lag wall time on slow renderers — scale test waits, never assert wall-clock decay.

## 2026-07-24 ~07:40 UTC — M6 COMPLETE: systems complete (the whole night runs)

**Done:**
- `systems/progress.js`: zone completion → scripted stir + trinket (8, incl. D11 hen feather), 12 brews w/ woozy wink (camera roll + warm bloom + giggle unlock), Beldam gilds at 12, localStorage save `moonrest-save-v1`, beat log.
- `systems/nightflow.js`: 40-min moon clock (min30 warm bias, min38 bell toll, min40 or keep-brazier → Night's End: 6s/zone authored dolly reel over kindled zones → title card w/ night stats → reset), attract mode at 180s idle (cancelled by any input), real lunar phase (lunarAge, 29.53d synodic).
- NPC behaviors: gargoyle watches-only-when-unwatched (camera dot 0.75), ghost cat wakes at 6 hall sconces (follow-at-2m, teleport >20m, 30Hz AM purr), Mote one-eye stir, Nib sky constellations (line figures on the star shell).
- `autopilot()`: full-night self-play — teleport-hops all 37 lights zones-first, 12 brews, isle keep brazier last.
- D6 resolved — perf work: per-zone visibility groups (`grouped()`, culled at dist−r<95), `mergeStaticInGroups()` per-material merge with `userData.dyn` exemptions, window panes+halos merged into 3 flicker groups/kind, `mergeDirectChildren()` NPC bodies, fog-prop culling. 296 → 97 draw calls.
- Rig hygiene: `suppressNightEnd()` hook — kindle-all rigs no longer trigger the finale reel mid-screenshot (autopilot keeps the real trigger); `hud.sayLater()` so teleport's `clearSubtitle()` also cancels queued trinket lines.

**Evidence read:** AUTOPILOT CHECK PASS 14/14 (37 kindles, 8 zone-completes, 8 stirs, 8 trinkets, 12 brews, reel→card→reset, persistence through reload, console clean) — rerun green after the suppress guard landed. PERF GATE PASS (97 calls ≤120, 80,406 tris ≤150k, 177KB gz ≤1.2MB, p95 118ms software-GL baseline documented in JUDGE.md). HUE GATE PASS 8/8 post-merge. hall.png + gloomspire.png re-read: real framing, no HUD pollution. kindlecheck 13/13, traversecheck 11/11, feelcheck 12/12.

**Next action:** M7 — co-op: PeerJS host/join (4-letter codes), 10Hz transforms w/ 150ms interp, host-relayed kindle/brew events, nightT heartbeat, late-join snapshot, disconnect firefly fade, rune names, all 8 co-op moments, `scripts/coop-test.mjs` two-context gate.

**Learnings:**
- Test rigs that mutate global state (kindle-all) can trip real narrative triggers — every irreversible game event needs a rig-suppression path that the shipped game never sets.
- Delayed subtitles (setTimeout) escape a clear-current-subtitle call; route delayed says through the HUD so one clear cancels the queue too.
- Draw-call work that pays: distance-culled zone groups first (free wins), then per-material merges inside groups; keep dynamic meshes out via explicit markers, never by name matching.
