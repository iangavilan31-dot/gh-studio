# CLAUDE.md

Godot vertical slice recreating `docs/reference.png` (a moonlit swamp scene: player
frog-samurai, ally frogs, torii gate, shrine, giant moth/spider creature, fog, water,
lily pads, lotus).

## Known blockers

**BLOCKER: docs/reference.png is missing. Required before Phase 1. On arrival, run
the reference verification (expect 1672x940, mean luma 0.2713, std 0.1158,
p95 0.4519) and then the compare script with reference.png as BOTH arguments,
which must report 13/13 and exit 0. Do not start Phase 1 until both pass.**

## Locked constants

  Camera3D.position          Vector3(1.02, 0.92, 3.95)
  Camera3D.rotation_degrees  Vector3(6.2, 0.0, 0.0)   <- POSITIVE X = pitched UP
  Camera3D.fov               40.0                      <- VERTICAL, not horizontal
  near 0.05, far 400
  WATER_SURFACE_Y 0.30, SWAMP_FLOOR_Y 0.00, PLAYER_HEIGHT 1.20 (floor to hat top)

Full derivation, world placement table, and photometric targets: see
`docs/CAMERA_SOLVE.md`. Read-only, do not re-derive or "improve" any number there.

## Build target

- Godot 4.6.x standard build, NOT 4.7.
- Forward+ renderer.
- GDScript only.
- Blender 4.5 LTS for any authored meshes.
- Target 1920x1080 at 60 FPS.
- Never run Godot with `--headless` when capturing. Headless uses the dummy
  rasterizer and writes black frames.

## THE LOOP

Applies to every visual change, no exceptions:

1. Change ONE thing.
2. `godot --path project --resolution 1920x1080 -- --capture=res://captures/<tag>.png --frames=90`
3. READ the PNG with the Read tool, actually look at it.
4. `python3 tools/compare_reference.py docs/reference.png captures/<tag>.png --out captures/<tag>_diff`
5. Read the diff PNG and JSON.
6. Append one row to `docs/VISUAL_REVIEW.md`: tag, what changed, gates passed, three
   worst bands, top remaining mismatch.
7. If the top mismatch is unchanged after 2 consecutive iterations, STOP, write down
   the theory you tested and why it failed, and ask.

Cap: 8 iterations per phase, then stop and report.

## Priority order (do not invert)

camera transform (already solved) -> exposure and tonemap -> fog structure -> player
scale -> lighting hierarchy -> water -> silhouettes -> creature -> movement feel ->
animation, audio, interaction -> detail and optimization.

Do not model props while exposure, fog, or scale are wrong. Composition and
atmosphere are ~80% of the perceived match; assets are ~20%.

## Rules

- The compare script's exit code is authoritative, do not override it.
- Do not award the final visual score, report gate results.
- Never write a review entry for a capture that was not read.
- Never fabricate a command result or a gate outcome.
- Anything the fog hides, do not model.
- Player character uses a CC0 base mesh (Quaternius, Kenney) restyled, never built
  from Blender primitives.
- Repeated foliage is MultiMeshInstance3D only.
- Far trees and wings are alpha-cut billboards, not geometry.
- No paid tools.
- If a Godot API call fails, look up the exact 4.6 signature; two failed guesses in a
  row means stop and ask.

## Do not build

Multiplayer, procedural generation, inventory, crafting, skill trees, dialogue,
roguelite loop, multiple biomes, enemy AI, streaming, quests, menus beyond
pause/settings, HUD beyond fading key prompts.
