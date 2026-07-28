# MOONREST — Handcraft ledger (PRESTIGE_PASS Part P)

Status per tell, with evidence. Open items carry to the next judge pass.

## P.1 Composition tells
- **Nothing evenly spaced** — DONE for: path edging stones (44% gap chance,
  jittered offsets), wayside shrines (per-shrine lean yaw, one extra-leaning),
  memorial stones (individual leans, random yaw), park mushroom clusters (3s
  and 5s, mixed radii), lawn boulders (2s/3s). OPEN: village lamp posts retain
  loop spacing (audit pass 2).
- **A broken/mended/crooked thing per scene** — PARTIAL: leaning shrines,
  leaning memorial stones, raven fence stubs (the rest of the fence long
  gone), clothesline's lonely sock. OPEN: village needs one patched shutter or
  crooked sign; hall needs one askew sconce.
- **Wear where use lives** — PARTIAL: ground macro-variation darkens/mosses by
  drift, dirt path polished by the walked ribbon itself. OPEN: bench seat
  darkening in two person-sized patches (shore + Long Bench).
- **Phase-offset every loop** — DONE: flames (per-flame frame offsets), sways
  (position-seeded phases), pilot embers (flickerSeed), green windows
  (per-window random walks), hall mist (seeded drift).

## P.2 Language tells
- Names: Beldam, Nib, Mote, Emberwick, Gloomspire — blunt Anglo-weird ✓.
  No "X of Y", no apostrophes, no generator soup ✓ (title tagline "a small
  night, kept" is a clause, not a construction).
- Tired-folk voice, no exclamation marks, sentences under 12 words: verified
  across hud.say strings (Beldam intro murmur: "...mm. lamp went cold again.
  right here, beside my bench, friend... zzz").
- OPEN: signage archaic-spelling audit (fingerposts read plain).

## P.3 Visual/UI tells
- No component-library look: rune-ring focus, wax-seal toggles, lantern-wick
  sliders (shell.css) ✓. No emoji, no glassmorphism, no pill buttons ✓.
- Emissive variance: green windows flicker individually; warm windows on
  hearth-flicker groups; candle flames on per-flame random walks ✓.
- Default-three.js look unfindable: custom tone (quantize+gamma+floor), authored
  fog everywhere, no clear-color grey ✓ (console-clean gates would catch a
  stray unlit placeholder as a visual defect in shots — reel READ).
- The moon's painted cross-glow is the only flare in the game ✓.

## P.4 The human fingerprint (one per zone, never referenced by any system)

- Park: initials "N + B" scratched under the Long Bench seat (scratchTag
  card, world.js buildPark) — PLACED.
- Village: chipped mug on a stool by the bakery door (glazed teal, dark
  rim notch; the well lives in the ruins, so the mug waits where the
  baker left it) — PLACED.
- Rooftops: the clothesline's lonely odd sock — PLACED (earlier cycle).
- Ruins: a child's five-pebble tower balanced at a colonnade base
  (replaces the dust-cloth idea; stone reads better at N64 texel scale)
  — PLACED.
- Gloomspire: stones-game tally scratched beside the gate (three gates of
  four and an unfinished score line) — PLACED.
- Hall: the Pale King's book on the dais with a pressed-flower bookmark
  — PLACED.
- Mosswood: a faded red ribbon tied around the south arch pillar, knot
  still hanging (replaces the boot print; reads at distance) — PLACED.
- Isle: a corked message bottle half-buried at the causeway landfall —
  PLACED.

## P.5 Runtime tells
- No console noise (hard-gated in every rig) ✓. No TODO/lorem in UI strings ✓.
- Favicon is the moon ✓. No alert()/confirm()/prompt() (shellcheck static
  scan) ✓.
- Nothing pops within view: zone culling hides beyond fog reach; pilots cull at
  80m (inside fog) ✓.
- Anti-repetition: footsteps pitch-jittered per surface; clucks/snores
  randomized; idle shifts on slow incommensurate sines ✓.
