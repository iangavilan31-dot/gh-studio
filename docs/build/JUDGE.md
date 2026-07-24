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
