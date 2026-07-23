# MOONREST (branch claude/moonrest-autonomous-build-015qyb)

Mission: build MOONREST — a cozy-dread N64-style 3D night-walk with co-op — exactly per
`docs/MASTER_PROMPT.md`. That document is the complete spec and operating protocol.

## Tech constraints (non-negotiable)
- Runtime deps: `three` + `peerjs` only (+ existing repo deps; @fontsource fonts are
  static assets permitted by spec Part 10). No other libraries, no CDN, no fetched assets.
- ALL assets procedural (textures painted to canvas, meshes from primitives, audio
  synthesized in WebAudio). No model/texture/audio files, ever.
- Renderer: 480×270 nearest-filtered target, custom ShaderMaterial, no realtime lights
  in the exterior world, no shadows, vertex-color baked lighting.
- Never use alert()/confirm()/prompt(). No text chat in co-op.

## Verification commands
- `bash scripts/init.sh` — build + smoke test (start of every work cycle)
- `node scripts/shoot.mjs` — zone screenshots to docs/build/shots/ (READ the PNGs)
- `npm run build` — must exit 0 at every commit

## State files (single source of truth — keep current)
- `docs/build/features.json` — feature ledger (never remove entries; flip passes only with evidence)
- `docs/build/PLAN.md` / `PROGRESS.md` / `JUDGE.md` / `DECISIONS.md`

# Compact instructions
When compacting, preserve: the mission (build MOONREST per docs/MASTER_PROMPT.md),
current milestone from docs/build/PLAN.md, build status, and the instruction to re-read
MASTER_PROMPT.md Part 0 + PLAN.md before continuing.
