# MOONREST — Judge Log

Protocol: docs/MASTER_PROMPT.md 12.4. Hard gates first (deterministic, scripted);
then rubric dimensions (a)–(j) scored 1–10 with evidence; then fresh-eyes reviewer
subagents; then ranked defect list and fixes.

Exit condition: (avg ≥ 8.5 AND no dimension < 7) for TWO consecutive passes, or two
consecutive passes with zero new defects and no score improvement. Minimum 3 passes.

No judge passes yet — begins at M9. Hard-gate scripts land earlier (hue check in M4,
perf capture in M6, co-op assertions in M7).

---

## M4 hue-gate tolerances (documented per 12.1 M4)

Measured from the pre-post 480×270 RT via `__MOONREST__.samplePalette()` with all
zone lights kindled and nightT=24:
- **Dominant hue**: saturation·value-weighted circular mean must fall in the zone's
  Part 2.1 hue window — park 150–220° (teal), village 215–280° (indigo),
  rooftops 210–260° (cobalt).
- **Darkness**: median luminance < 0.28 (saturated cool dark, Rule 1).
- **Warm accent presence** (Rule 2): fraction of pixels with hue 15–60°, s>0.25,
  l>0.12 must exceed 0.0015 — EXCEPT rooftops (0.0006, red hue 0–15/345–360 also
  counts): its Part 2.1 accent is the gnome-hat red, one small hat+lantern vignette
  in a huge cobalt sky; scarcity is the zone's design (Rule 2), so the gate checks
  presence, not quantity.
- M4 result: park PASS (168.7°, lum .073, warmth .0018), village PASS (227.4°,
  lum .082, warmth .0053), rooftops PASS (236.7°, lum .116, warmth .0007).

Known composition notes for M9 judges: Nib reads only in the close `nib` pose
(garden-gnome scale — by design, but the wide shot leans on the lantern);
under-canopy AO bake is subtle at night ambient; feelcheck hop-apex assert is
timing-flaky under swiftshader (passed on rerun).

---

## M5 reel review (all 8 zones, side-by-side — 12.1 M5)

Hue gate PASS 8/8 (6-frame sampling: accent fields take max across frames since
flames flicker and lanterns sway; hue is the mean). Zone-accent literalism per
Part 2.1: gloomspire checks GREEN presence (>0.001, s>0.2/l>0.12 tuned for
additive-over-fog compositing), isle checks moon-glow brightness (l>0.45 frac
>0.004), hall counts carpet red as warmth, ruins asserts no warm requirement
(cold cyan accent by spec).

Shot verdicts (all REVIEWED this pass):
- park.png — teal night; kindled lamp + warm vertex pool; rain streaks; Beldam on
  the Long Bench; moon + halo; stars; fences/mushrooms/birdbath present. STRONG.
- village.png — indigo; S-curve cobble street uphill (Rule 9); amber crossbar
  windows (hearth-breathing); 4 kindled posts recede; spire w/ handless clock. STRONG.
- rooftops.png — cobalt sky dominant; kindled hook-lantern vignette + moths;
  pine; Nib close-up in nib.png (red hat reads). GOOD (wide shot leans on lantern).
- ruins.png — violet; Curator ghost drifting the colonnade (translucent, dusting
  patrol); petals; cyan glyph + sconce glints; moon violet-cast. STRONG.
- gloomspire.png — luminous toxic-green windows through fog (noFog emissive panes
  + halos); nebula billboards; warm causeway lanterns; red door; moat. STRONG.
- hall.png — 100% vertex-lit showcase: warm chandelier pools on columns/floor,
  cold vault, red carpet + emerald runner, lit sconces; mist sheets spawn. GOOD
  (chandelier rings themselves read weakly — M9 candidate).
- mosswood.png — deepest fog; layered fog cards w/ parallax; colossal trunks
  vignette; kindled arch + trail lanterns; spores/drips systems live. STRONG.
- isle.png + sea.png — keep + crenellations; palm; moon + cross-flare; kindled
  causeway lamps; sea w/ ripple + scrolling wavelets + moon streak (faint but
  present); foam ribbon; seabirds + cove hammock sailors (snore-z). GOOD.

Defect candidates carried to M9: chandelier ring readability; moon streak
strength; Mote/gargoyle only visible up close (no dedicated poses yet); draw-call
budget still unmerged (D6).

---

## M9 — JUDGE PASS 1 (2026-07-24 ~11:00 UTC)

### Step 1 — hard gates (all green, runs within this pass window)
build ✓ · init.sh smoke ✓ · feel 12/12 · kindle 13/13 · traverse 11/11 ·
hue 8/8 · autopilot 14/14 · perf (97 calls / 80.4k tris / 214KB gz) ·
coop 17/17 · moments 12/12 · shell 15/15.

### Step 2 — full reel regenerated + READ
All poses --kindled + 4 memory modes (mode-*.png) + coop pair + title/pause/vhs.
Every PNG personally read this pass.

### Step 3 — scores (1–10, evidence-grounded)
- (a) palette fidelity: **8.5** — hue gate 8/8; park/village/ruins/gloomspire/hall/mosswood
  match 2.1 by eye; rooftops foreground desaturates to near-black slabs, isle very dim.
- (b) silhouette/composition: **7** — village S-curve, mosswood trunk vignette, hall
  nave STRONG; foglands pose is a lamp close-up (corridor unreadable), rooftops
  foreground is empty slab, isle keep too faint to landmark.
- (c) atmosphere: **8** — every zone has live particles; rooftops shot shows sparse
  stars for the "densest starfield" zone; isle sea sparkle out of frame.
- (d) character feel: **8.5** — feel gates green (latency logged, no foot-slide,
  hop/turn easing); action overlays read; giggle/wink charm present.
- (e) audio: **8** — kindle 13/13 (layer adds + RMS assert); zone keys/scores; bell,
  music box; loop-boundary seamlessness only indirectly asserted.
- (f) co-op: **8.5** — coop 17/17 (sync, moments, brazier law, late join, fades);
  rune plates read in both coop shots; interp visually smooth in stills.
- (g) performance: **9** — 97 ≤120 calls, 80.4k ≤150k tris, 214KB ≤1.2MB gz,
  boot ~370ms ≤3s; p95 software-GL baseline documented.
- (h) UX shell: **8.5** — shell 15/15; title/pause/settings/credits/photo complete;
  a11y present (subtitles default-on, no-strobe, hold-toggle, remap, gamepad).
- (i) stability: **9** — all gates console-clean; error boundary in-fiction;
  state files survived two worker restarts mid-build.
- (j) reference-likeness: **7.5** — park/village/gloomspire/hall genuinely read like
  the reference stills; rooftops/isle don't yet; PS1 dial currently breaks the look.

**Average 8.25 — below exit (need ≥8.5, none <7 ×2). Continue.**

### Step 5 — defects (builder pass), ranked by vibe-damage
1. **PS1 Memory dial affine warp destroys near geometry** (mode-ps1.png: street
   melts into stretched triangles). Affine 0.8 + half-res snap far too strong.
2. **Foglands pose shoots the inside of a lantern** (foglands.png) — the
   breadcrumb corridor, the whole point of the Foglands, is not in frame.
3. **Rooftops shot**: pitch-black AO pools (Rule 1: darkness must stay saturated
   cool), sparse stars in the densest-star zone, Nib/gnome not in frame.
4. **Isle shot too dim/empty**: keep landmark faint, sea/foam/sparkle out of
   frame, kindled keep brazier invisible — composition fails Rule 9 landmark pull.
5. **Mosswood arch top reads as a broken "C"** from the approach (torus arc
   opens sideways instead of spanning the pillars).
6. Village plaster walls read bright white against the #111b19 dominant field
   (they wash the indigo mood at night; should sit darker/cooler).
7. Carried: hall chandelier rings faint; moon streak weak; Mote/gargoyle lack
   dedicated poses (they exist only in ambient framing).

Fresh-eyes findings (step 4) to be merged below when both reviewers return.

### Pass 1 fixes applied (builder defects 1–7) — all re-verified
1. PS1 affine 0.8 → 0.35 + full-RT snap grid: street no longer melts
   (mode-ps1.png re-read: intact cobbles + era jitter). shellcheck updated + green.
2. Foglands pose reframed to the first breadcrumb lamp: warm pool + fog wall +
   faint spire silhouette (foglands.png re-read — the corridor statement reads).
3. Rooftops pose reframed onto the roof strip looking west: hook lantern focal +
   moths + chimney smoke + 50% cobalt sky (rooftops.png re-read). Stars sized
   0.7–2.05 (was 0.55–1.7).
4. Isle pose moved onto the causeway: keep + crenellations + kindled brazier glow
   + cove beacon + palm + moon (isle.png re-read; landmark pull restored).
5. Arch top: removed the sideways Z-rotation — the arc now SPANS the pillars
   (mosswood.png re-read: proper gate, STRONG).
6. Village plaster dimmed/cooled via vertex tint [0.72,0.75,0.88].
7. Hall chandelier halos 3.4→4.3 / 0.6→0.78 (hall.png re-read: rings read);
   moon streak 0.4→0.62 opacity, 9→11 wide.
Re-verified: hue 8/8, shell 15/15, perf 96 calls, feel 12/12 — all green.

### Step 4 — fresh eyes, competitive (two clean-context reviewers)
Reviewer B (systems sweep) found 16 real issues; Reviewer A (art/evidence sweep)
found 9 (several overlapping my already-applied pass-1 fixes, which A read
pre-fix). B takes the five points (16 vs 9 verified). Merged + actioned:

**Fixed this cycle (all re-verified green):**
- Emote wheel existed nowhere (B1, HIGH): Tab/Y hold-wheel (wave/point/giggle*/
  sleep) + digit picks + gamepad Y + net emote broadcast. shellcheck 16/16.
- Star shell pinned to origin in the shader (A1, HIGH): modelMatrix applied —
  village/rooftops skies restored (shots re-read).
- Ambience bus was silent (B2): procedural rain/wind/cricket/owl/sea beds per
  zone, 6s travel crossfades, bench-rest softens the rain SOUND too.
- Night's End had no musical finale (B3): all layers swell over the reel,
  picardy third on the title card.
- Zone music hard-cut on travel (B5): 6s ring-down/bloom-in crossfade.
- Late joiners never got earned trinkets (B4): syncCompletedZones + archstone
  from momentsDone.
- hold-to-toggle a11y setting was dead (B6): implemented in interact.
- Hall 4s reverb was dead code (B7): roomMix/hallMix crossfade on hall entry.
- Trinket ids showed raw on the shelf (B8): keys aligned to progress ids.
- Pause lacked the controls reference (B9/A6): added.
- Camera auto-frame off-switch (B10): settings row + wiring.
- Gamepad remapped to the 4.2 table + kindle rumble (B11); staff halo now
  pulses with footsteps (4.1).
- Moon clock ran at the title (B12): night.paused while mode==='title'.
- 5th joiner got "host lost" (B14): clean "night is full" deny + reject.
- Host kindle requests now reach-checked at 8m (B16).
- Stale ledger evidence corrected; missing spec rows added as m9-* entries (A2).

**Documented, not coded:** gargoyle watching stays per-viewer (D18); frame-time
p95 waiver (D19/A3/B15).

**Carried to pass 2:** hall overall luminance (A4 — halos boosted, re-judge);
gloomspire pose lacks water reflections (A5 — no reflections in a no-lights
pipeline, judge in pass 2); Nib texture flatness (A8); sea-plane far-edge seam
(A9); foglands mood vs Rule 1 floor (A7 — reframed already, re-judge).

**Environment learning:** a half-dead `peerjs` CLI process from an earlier
EAFNOSUPPORT crash was still claiming port 9101 and silently poisoned two
coopcheck runs (client "host-lost" seconds after join). Kill stale brokers
before blaming the netcode.

---

## M9 — JUDGE PASS 2 (2026-07-24 ~13:20 UTC)

### Step 1 — hard gates on the final fix build
init smoke ✓ · feel 12/12 · kindle 13/13 · traverse 11/11 · moments 12/12 ·
hue 8/8 · autopilot 14/14 · perf 97 calls / 80.4k tris / 216KB gz ·
coop 17/17 (twice, consecutively) · shell 16/16 · build exit 0.

### Step 2 — reel regenerated + read after every fix
park/village/rooftops (stars restored — modelMatrix fix verified in-frame),
ruins, gloomspire, hall (chandeliers read), mosswood (arch spans), isle
(causeway landmark), sea (horizon seam GONE — plane extended past far plane),
foglands (breadcrumb), nib (painted plaster texels + snore-Z), 4 memory modes
(PS1 intact), coop pair, title/pause/vhs.

### Step 3 — scores
- (a) palette fidelity: **9** — hue 8/8; every zone reads its 2.1 field by eye now.
- (b) silhouette/composition: **8** — arch/foglands/isle/rooftops fixed; soft spots:
  gloomspire castle under half-frame, Nib absent from the rooftops wide (nib.png covers).
- (c) atmosphere: **8.5** — full starfields everywhere + all particle layers; the AIR
  side now matched by ambience beds.
- (d) character feel: **8.5** — gates green; emote wheel real; staff pulses with strides.
- (e) audio: **8.5** — beds fill the once-silent bus, 6s zone crossfades, hall vault
  reverb, Night's End swell + picardy; kindle layer/RMS asserts green.
- (f) co-op: **9** — 17/17 twice; host reach validation; full-lobby fiction; the
  join-race flake was root-caused (non-fatal ICE 'error' events + pre-open sends).
- (g) performance: **9** — 97/80.4k/216KB, boot ~0.4s; p95 waiver documented (D19).
- (h) UX shell: **9** — 16/16; controls reference; camera-assist toggle; full a11y row.
- (i) stability: **9** — all gates console-clean; net teardown now only on real closes.
- (j) reference-likeness: **8** — the reel reads like the reference footage
  consistently; isle/foglands are honest scenes now rather than empty frames.

**Average 8.65, no dimension < 7 → pass 2 MEETS the exit bar (1st of 2 needed).**

### Step 5 — defects carried to pass 3 (minor)
- Gloomspire pose: castle could fill more frame / moat in shot.
- Rooftops wide could include Nib himself (nib.png currently carries him).
