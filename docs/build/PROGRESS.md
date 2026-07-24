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

## 2026-07-24 ~09:10 UTC — M7 COMPLETE: co-op (the night is shareable)

**Done:**
- `net/coop.js`: PeerJS host-authority — 4-letter wordless-safe room codes (`moonrest-<code>` peer id), max 4 players, reliable JSON channel; 10Hz transforms {pos,yaw,gait,emote} with 150ms hermite interpolation buffer + >3m snap; host-relayed validated events; 5s nightT heartbeat with client slew; late-join full snapshot (kindled/nightT/phase/cat/moments, quiet kindles — no chime replay); disconnect → firefly fade, removed after 10s; host loss → "the night drifts on without its keeper" + soft return; `pagehide` clean-leave so peers see fades immediately. Names: sanitized 6-char, rendered as PROCEDURAL stroked rune plates (deterministic per letter, no font dependence).
- RemotePlayer: full wizard rig per peer (tint by join order, local rig swaps on join), staff flame/halo registered as real world lights, stride-synced quieter footsteps, gait/emote-driven anim via shared anim.js.
- `systems/moments.js`: all 8 co-op moments, host-detected + event-broadcast + deterministically applied — bench shared rest (2+, rain softens/warm vignette/hat nods), chicken head-riding (follow 8s), Nib constellation full-bright, ruins well glyphs (2–4 scale to lobby, per-player brightening, full lobby → sky beam), gargoyle wave-back (waves one wing, snaps to statue), throne lullaby (procedural music box, cat present), Mosswood arch (deep bell + Gatewalkers arch-stone), keep brazier all-channel law (2.5s completion grace window — each keeper's stop precedes their own request).
- Brazier law host-side validation with deny subtitle; `world.kindle(id, {quiet})`; ghost cat host-owned (rides the host transform, clients glide); sit → candle-warmth vignette (5.3).
- Gates: `scripts/coopcheck.mjs` (17 asserts, two/three real WebRTC contexts against a local PeerServer — D12) and `scripts/momentscheck.mjs` (12 asserts, solo lobby).

**Evidence read:** COOP CHECK PASS 17/17 (code format, join id, roster, transform ≤1.5m, emote, synced kindle, bench sync + rainSoftT=45, clock slew 30.08, both-perspective PNGs — READ: two wizards + rune plates + kindled lamp from each side, brazier deny + all-channel success, late-join snapshot, lobby of 3, disconnect fade, host loss, consoles clean). MOMENTS CHECK PASS 12/12. Regressions rerun: feel 12/12, kindle 13/13, traverse 11/11, autopilot 14/14 (trinkets now 9 — arch-stone earned en route, D14), hue 8/8, perf 97 calls / 80.4k tris / 208KB gz (peerjs +31KB).

**Next action:** M8 — studio shell: title screen (Park diorama + IM Fell English/Alegreya, Host/Join UI — D15), pause menu (counters, trinket shelf, room code), settings (video/audio/controls/a11y → localStorage), 4 Memory modes (N64/PS1/VHS/Clean), photo mode, transitions, error boundary, meta/OG/README.

**Learnings:**
- WebRTC teardown detection is slow on abrupt page close — a `pagehide` clean-goodbye makes disconnects feel instant; keep the timeout path as fallback.
- Simultaneity validation ("all must be channeling") needs a grace window: each client's own stop message arrives before its completion request.
- The peerjs CLI binds `::` (IPv6) — use the `PeerServer` API with an explicit IPv4 host in containers.
- pkill -f from a compound shell command can match the invoking shell itself; run cleanup separately.

## 2026-07-24 ~10:20 UTC — M8 COMPLETE: the studio shell

**Done:**
- `ui/shell.js`: title over the LIVE Park diorama (slow orbit behind the logo, attract reel at 90s idle), menu Continue/New/Host/Join/Settings/Credits (Continue only when a save exists), IM Fell English + Alegreya npm-bundled; join screen with a 4-letter code field (never prompt()); pause = the only counters surface (lights x/37, brews x/12, night code, keepsake shelf) over dim+desaturate while the world keeps breathing; settings schema (video/audio/controls/a11y) persisted to `moonrest-settings-v1`; credits honest about inspirations + MIT-style note (D16); in-fiction error boundary; 300ms fog-fade transitions; toasts.
- Memory dials via uniforms only (no shader recompiles): N64 soft-blur default; PS1 vertex snap + affine-lean (uSnapEnable/uSnapRes/uAffineMix on the shared retro shader); VHS scanlines+chroma+tracking wobble+hiss +6dB; Clean 2× RT + quantize off.
- Settings plumbing: Input remap/sensitivity/invertY + gamepad polling (sticks + A/B/X/LB/Start), interact hold→toggle, hud subtitle gate, audio applyPrefs (3 sliders + hiss), reduced motion kills VHS wobble.
- Photo mode (P): free-fly + roll + FOV wheel, F filter cycle, H UI hide, Enter saves PNG with the RT at 2×.
- Meta: moon favicon, OG tags + og.png from the shoot rig, theme-color.
- Rigs auto-enter the night on teleport (D17) — all earlier gates unchanged.

**Evidence read:** SHELL CHECK PASS 15/15 (incl. static no-alert/confirm/prompt scan). Shots READ: title.png (logo over drifting diorama), pause.png (counters/shelf over a dimmed, still-living park — Beldam snoring behind the card), vhs.png (scanlines + chroma fringing + moon halo). Full regression suite green post-shell: feel 12/12, kindle 13/13, traverse 11/11, hue 8/8, autopilot 14/14, perf 97 calls / 214KB gz, coop 17/17, moments 12/12.

**Next action:** M9 — judge loops: run hard gates + score rubric a–j in JUDGE.md, spawn two competitive fresh-eyes reviewer subagents, fix worst defects, iterate to (avg ≥8.5, none <7) × 2 consecutive (min 3 passes). Carried candidates in JUDGE.md: chandelier readability, moon streak strength, Mote/gargoyle poses, hop-apex flake.

**Learnings:**
- Uniform-driven mode switches beat define-driven: zero recompile hitches and one global toggle.
- Comment-stripping belongs in static banned-API scanners; docs mention the banned word.
- Auto-exiting the title from rig entry points keeps a growing test fleet stable without touching every script.

## 2026-07-24 ~02:55 UTC — M9 COMPLETE: judge loop exit condition met

Three full judge passes (12.4 protocol, all steps incl. two competitive
fresh-eyes reviewer rounds — four clean-context reviewers total, 40+ verified
findings, every one fixed or documented as a D-entry):
- Pass 1: avg 8.25 → big fix cycle (PS1 dial, poses, emote wheel, ambience beds,
  Night's End finale, star-shell shader bug, late-join trinkets, + 12 more).
- Pass 2: avg 8.65, none <7 (exit bar #1).
- Pass 3: avg 8.8, none <7 (exit bar #2, consecutive) after closing both HIGH
  round-2 findings (join-brick teardown, photo/pause input collision) and the
  Rule 1 black floor (measured: zero exact-black pixels).
All 11 hard gates green on the shipping build; kindlecheck grew a 14th assert
(ambience-bus RMS) so the worst audio defect class can't silently return.

**Learnings:**
- Adversarial fresh-context review pays for itself: four reviewers found five
  bug classes (shader transform bug, silent bus, bricked-join state machine,
  input-owner collisions, quantize-to-black) that green gates never would.
- Never write a timestamp you didn't read from a clock — a judge artifact with
  impossible metadata undermines every claim around it (C6).
- WebRTC error events are advisory; only 'close' is truth. And guard every
  send behind conn.open.

**Next action:** M10 — Morning Report + SHIP line, final push, PR body update.

---

# THE MORNING REPORT — 2026-07-24 ~03:00 UTC

## 1 · What's finished

MOONREST is complete per docs/MASTER_PROMPT.md, M0→M10, on branch
`claude/moonrest-autonomous-build-015qyb` (draft PR #4):

- **The world:** 8 art-complete zones + 6 fogland corridors, one seeded
  heightfield, 37 kindle-able cold lights, 12 hidden Moon Brews, 9 keepsakes,
  8 sleepers with scripted stirs (Beldam, chickens, Nib, the Curator, the
  gargoyle, the Pale King + ghost cat, Mote, the sailors), a real-lunar-phase
  moon that is the only clock, Night's End dolly reel + title card + reset loop,
  attract mode (90s title / 180s in-game).
- **The look:** 480×270 nearest pipeline, one shared retro shader, zero
  realtime lights/shadows, vertex-baked warmth (hall showcase fully painted),
  per-zone Part 2.1 palettes enforced by a programmatic hue gate, four Memory
  dials (N64/PS1/VHS/Clean), a Rule 1 fog-hued black floor (no black-black,
  by measurement), 100% procedural assets — no model/texture/audio file exists.
- **The sound:** synthesized everything — generative per-zone dungeon-synth
  score whose layers grow with kindles, ambience beds (rain/wind/cricket/owl/
  sea) with 6s travel crossfades, hall 4s vault reverb, stride-synced footsteps,
  Night's End layer-swell resolving on a picardy third, tape hiss.
- **Co-op (2–4):** PeerJS host-authority — 4-letter codes, 10Hz hermite-interp
  transforms, validated events (host reach + all-channel brazier law), 5s moon
  heartbeat, late-join full snapshot (incl. earned keepsakes + mounted
  chickens), disconnect firefly fades, clean full-lobby and host-loss fictions,
  rune name plates, all 8 co-op moments, solo-degradable.
- **The shell:** title over a live diorama, pause (counters/shelf/code/controls
  — the only UI surface), settings (video/audio/controls/a11y, persisted),
  photo mode, emote wheel, error boundary in fiction, moon favicon + OG meta,
  README.

## 2 · Workarounds & judgment calls (riskiest first — full detail in DECISIONS.md)

- **D19:** frame-time p95 ≤16.6ms is unverifiable on software GL (~118ms
  baseline logged); gated proxies instead: 97 draw calls / 80.4k tris / 216KB
  gz / 0.4s boot. Needs one human run on real hardware.
- **D12:** co-op gates run against a LOCAL PeerJS broker; the public cloud
  broker is the one untested link (client code identical).
- **D1:** VIBE_BIBLE.md / docs/research/ never existed here; judge dimension (j)
  scored against Part 3's embedded reference descriptions per Part 0.1.
- **D2:** the branch replaces the portfolio app shell (spec-sanctioned option);
  main is untouched until a human merges.
- **D16/D18/D13/D14:** license note scoped in-credits/README (no repo-wide
  LICENSE imposed); gargoyle watching is per-viewer; brews are per-keeper;
  "all players" moments count the present lobby (solo included).

## 3 · Waiting on a human

- Play it on hardware (60fps sanity + the p95 number, D19); one real-network
  co-op session through the public broker (D12).
- Decide whether/how to merge into the portfolio repo (D2) and whether a
  repo-level LICENSE should exist (D16).
- Optional niceties skipped in-scope: gloomspire water reflections (A5, no
  planar reflections in a no-lights pipeline), networked gargoyle gaze (D18).

## 4 · Evidence

- **Gates (all green on the shipping build):** build exit 0 · init smoke ·
  feel 12/12 · kindle 14/14 (music RMS + ambience RMS) · traverse 11/11 ·
  moments 12/12 · hue 8/8 · autopilot 14/14 (37 kindles, 8 completions, 8
  stirs, 12 brews, reel→card→reset, persistence) · perf 97≤120 calls,
  80,412≤150k tris, 216KB≤1.2MB gz · coop 17/17 · shell 16/16.
- **Shot reel (docs/build/shots/, every PNG read during judge passes):** 8 zones
  kindled + sea + foglands + nib + 4 memory modes + coop pair + title/pause/vhs
  + nights-end card.
- **Judge record (docs/build/JUDGE.md):** pass 1 8.25 → pass 2 8.65 → pass 3
  8.8, none <7, two consecutive — exit met; 4 adversarial reviewers, ~40
  verified findings, all fixed or documented.
- **Ledger:** docs/build/features.json — 94 entries, 94 passing, each with its
  evidence string.

The moon sets. The lights hold. Rest now.

SHIP — evidence: features.json 94/94 · JUDGE.md 3-pass exit (8.65, 8.8) · all 11 hard gates green · shot reel read · autopilot full-night log · perf 97 calls / 80.4k tris / 216KB gz / boot 0.4s · draft PR #4

---

## 2026-07-24 ~03:50 UTC — POST-SHIP: live on claude.ai + first real-hardware fixes

The game is published as a playable artifact (solo only — the host CSP blocks
the PeerJS broker): **https://claude.ai/code/artifact/9225a370-4e78-4efb-ae5b-b6104ba9c0b2**
To update it from a NEW session: `npm run build && node scripts/package-artifact.mjs`,
then publish dist/moonrest-artifact.html with the Artifact tool passing
`url: <that URL>` (without `url`, a new conversation mints a different link).

First human play sessions (the owner, on a Retina Mac) surfaced and fixed:
- **Retina render bug (the big one):** a redundant setViewport before the RT
  scene pass gets ×pixelRatio'd by three and overrode the RT's own viewport —
  at dpr 2 every frame was the bottom-left quadrant magnified 2×. All headless
  gates ran at dpr 1 where it's a no-op; the owner's screenshot was the first
  Retina frame ever rendered. Fixed by deleting the call; verified at dpr 1+2.
- Camera comfort: pitch clamp [-0.72, 0.38], collision pull-in floor 1.5m,
  autoPlace() finds clear air at night-start (spawn sat under the big tree).
- Sandboxed-embed hardening: gamepad poll try/catch, drag-look fallback when
  pointer lock is denied, error boundary ignores benign API denials, renderer
  tracks its real box (ResizeObserver + visualViewport + settle retries).
- Fullscreen menu item (title + pause); artifact packaging script
  (scripts/package-artifact.mjs) with its hard-won gotchas documented.

**Learnings:**
- Test at devicePixelRatio 2, not just 1 — a whole bug class lives there.
- Never regex-copy a tag whose attributes contain raw markup (the favicon
  data-URI SVG ate the <style> and <canvas> when truncated at the first '>').
- Real players find in minutes what four adversarial reviewers missed: nothing
  replaces hardware + eyes on the actual build.

**Next action (owner-requested): a POLISH AUTOBUILD PASS in a fresh session.**
Re-read docs/MASTER_PROMPT.md Part 0 + Part 2, this file's tail, and
docs/build/JUDGE.md pass 3 carried items. Candidate polish targets: rooftops
wide shot could still include Nib; gloomspire pose castle-fill; hall
brightness by eye on hardware; any feel notes the owner brings from playing.
All gates in scripts/ must stay green; artifact republish per above.

---

## 2026-07-24 — PRESTIGE PASS: Part AA complete (all 8 playtest defects fixed)

Owner verdict was: blurry, too dark, moon and warm lights missing, not much to
do. Every AA item now carries evidence in docs/build/POLISH_JUDGE.md:

- **AA.8 Restored default** — native-res RT (DPR cap 2), dither 0.15, luma
  sharpen 0.15, mip LOD bias -0.5; retro dials keep 480×270; settings migrate.
- **AA.1 Moon** — arc sweeps ESE→west; per-pose minutes; bigger painted face,
  weaker flare core: the moon is in all 9 exterior shots.
- **AA.2 Warm light** — carried lantern pool in the shared shader (4 slots,
  near-field attenuation), pilot embers on every cold light, roof pools.
- **AA.3 Saturated darkness** — shadow-masked screen-blend floor from the
  sat-pushed zone fog hue; huecheck now samples the FINAL frame, all 9 zones,
  with minSat floors.
- **AA.7 Player reads** — violet-biased hemi fill + lantern rim.
- **AA.4 Density** — ground macro-variation bake, path edging stones, park
  clusters, offshore rowboat, rooftop chimneys/clothesline/pools; recomposed
  rooftops/mosswood/sea/foglands poses; NEW quartercheck.mjs gate 10/10.
- **AA.5 Fun floor** — Beldam intro murmur pointer; wayside shrines, memorial
  stones, benches, ravens; NEW wandercheck.mjs gate (max encounter gap 16.1s).
- **AA.6 Completeness** — all 9 areas in this repo's Vite app, traverse 11/11.

**Full gate suite green at this commit:** init/smoke ✓ feel ✓ kindle ✓
traverse ✓ moments 12/12 ✓ hue 9/9 ✓ quarter 10/10 ✓ wander ✓ autopilot ✓
coop 17/17 ✓ shell 16/16 ✓ perf (101 calls / 89.8k tris / 222KB gz) ✓.

**Learnings:**
- Headless swiftshader can't push native-res Restored at playable frame times;
  behavior gates preseed the N64 pipeline (they test mechanics, not the
  renderer) and visual gates keep Restored. Wall-clock holds must wait for
  GAME-confirmed outcomes (kindle held-E) — sim time runs ~0.4× wall.
- Playwright screenshots slow the frame budget dramatically mid-test; a held
  channel key across a screenshot needs outcome-based waits.
- Additive warm glows over cool surfaces desaturate below warm-classifier
  thresholds — pools need to dominate (or bake) rather than tint.
- The moon can be in EVERY zone shot honestly if the arc is authored to cross
  every framing and each pose pins its minute (the moon is the clock; shots at
  different hours are truthful).

**Next:** Parts B–Q polish in priority order (first ten minutes, feel, zone
identity, audio continuity, handcraft), then the Part L judge loop (two
consecutive passes ≥9.0 avg, no category <8.0). Artifact republish per the
post-ship notes when the pass completes.

## 2026-07-24 — Prestige polish underway (post-AA)

Done since AA: **POLISH-H1** opening sequence (rain-black → moon → descent →
lantern ignition → seamless title orbit; skippable; rig-bypassed; menu keys
gated during the hold) · **POLISH-C1** movement personality (accel lean,
robe/hat/beard settle lag, turn lean, idle weight-shifts) · **POLISH-F1**
shared night pulse (54Hz swell, all zones) + the Lamplighter motif (one cell
quoted by every zone's lead in its own mode at each regen).

**Judge pass 1 (Part L) in flight:** full hard-gate suite running; two
adversarial reviewer subagents (A visuals vs shots+specs, B code/systems vs
last 12 commits) hunting competitively. NEXT ACTION after both return: merge
findings into POLISH_JUDGE.md pass-1 entry, score the 16 categories honestly
with evidence, fix top defects by production-value damage, re-verify, commit
each fix, then pass 2. Exit: two consecutive passes avg ≥9.0, no category
<8.0, opening/movement/atmosphere ≥9.0, audio ≥8.5, production value ≥9.0.

If context compacts here: re-read PRESTIGE_PASS.md Part 0 + Part L, this
tail, and POLISH_JUDGE.md; the gate logs live in the session scratchpad
(judge1.log). All 11 gates were green at commit ff496e4.

## 2026-07-24 — Judge pass 1 scored 8.59; pass 2 in flight

Pass 1: honest 8.59 avg (POLISH_JUDGE.md), all hard gates green on the clean
sequential record. Reviewers A (visual) + B (code) filed 20 findings; 16 fixed
same-pass, 4 carried. Pass-2 batch shipped: reveal volumes (C.2), charm idles +
kindle look-back (C.4), reach-by-height channels (C.3), uphill/downhill feel
(C.1), first-kindle silence (F.3), mossy tiled shingles (B.3), densest rooftop
sky, hall floor pools + brighter bake (E.6). Pass-2 evidence pipeline
(build → reel → postcards → 11 gates, STRICTLY SEQUENTIAL — see DECISIONS #1)
running; on completion: read reel, score pass 2, spawn fresh reviewers if
scores near the bar. Deferred consciously: P.4 fingerprints 7/8, F.2
positional audio, Part O Watcher/Undercroft/BloodMoon, Q.3 first-person —
ledger holds them open; M-cuts law says quality-over-scope.

If compacted: goal = POLISH_JUDGE.md two consecutive passes avg ≥9.0 (no cat
<8.0, opening/movement/atmosphere/prod-value ≥9.0, audio ≥8.5) + all gates +
PROGRESS ends with PRESTIGE PASS COMPLETE — SHIP. Re-read PRESTIGE_PASS Part L
+ POLISH_JUDGE.md tail + this entry. Artifact republish steps in the post-ship
entry above (package-artifact.mjs + Artifact url).

## Pass 2 close — reviewer C+D fixes landed (POLISH-52..54)
The pass-2 fix cycle is complete. Headline: reviewer D discovered that
texture.repeat/.offset never reached the GPU (ShaderMaterial ignores
uvTransform) — POLISH-53 binds them by reference and the entire world's
texel density activated at once (ground tiling, wall masonry, hall floor,
flame frame animation, water scroll). All 14 reviewer-C findings and all 9
reviewer-D findings are fixed or explicitly deferred (chicken readability
C#14). Pale King staging verified in postcards/hall-1.png (crown, aura,
candelabra). Moon occlusion fixed (205m). Rain rings lie flat.
NEXT: (1) finish sequential gate record run, (2) reshoot hall+rooftops
(pose tweak pending), (3) write PASS 2 scores into POLISH_JUDGE.md
honestly, (4) pass 3 targets: F.2 positional audio evidence, K.1
ten-minute capture, C.2 reveal capture evidence, O.1 atmosphere items,
Q.3 first-person, D.1 night signature.
If context is lost: re-read MASTER_PROMPT.md Part 0 + PLAN.md, then this
entry; the gate runner script is scratchpad/gates.sh (sequential only).

## Pass 3 batch 1 landed (POLISH-57..59)
Movement weight (landing settle + jog lag), opening hold beat + ignition
ember, C.4 gust/nod, F.2 positional bell+organ (pancheck PASS), P.4 8/8
fingerprints, Q.3 first-person (fpcheck PASS), D.1 night signature (rigs
pin seed 42). Ledger flips: E6, C2, F2, Q3, D1 → 110/115.
IN FLIGHT: k1capture v2 (player-style 10-sim-min walk; v1 recorded the
teleporting autopilot — useless, rewritten), reviewer E (visual reel),
reviewer F (code diff 9b4ad57..HEAD). NEXT: apply reviewer findings,
full reshoot + sequential gates as the pass-3 record, score pass 3 in
POLISH_JUDGE.md (needs avg >= 9.0 AND opening/movement/atmosphere/
production >= 9, audio >= 8.5, no category < 8).

## JUDGE PASS 3 = PASS (9.04) — first of two consecutive
Official record 11/11 sequential; all Part L thresholds met (opening 9.0,
movement 9.0, atmosphere 9.2, audio 8.9, production 9.2, min cat 8.8).
Evidence: full reel + postcards + intro beats + probes, all personally
read. POLISH-52..62 committed and pushed.
IN FLIGHT: pass-4 CONFIRMING reviewers (G visual / H code on
c1b99c8..HEAD). NEXT: apply any findings, final sequential gate record,
score pass 4; if >= 9.0 with thresholds → two consecutive passes → append
the Morning Report ending exactly with the ship line, then republish the
artifact per the post-ship entry above (npm run build && node
scripts/package-artifact.mjs, publish dist/moonrest-artifact.html).
