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
