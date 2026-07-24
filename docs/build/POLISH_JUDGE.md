# MOONREST — Polish Judge (PRESTIGE_PASS Part L)

Review passes append below. Part AA evidence ledger comes first — nothing else
counts until all eight AA items carry screenshot evidence here.

## PART AA EVIDENCE

### AA.8 — Restored mode default ✅ 2026-07-24
- Implementation: native-res RT (letterbox viewport × DPR cap 2), no downscale;
  dither 0.15 (film grain); luma sharpen 0.15; mip LOD bias -0.5 with nearest
  mag (crisp texels at distance, no shimmer); retro dials (N64/PS1/VHS) keep the
  480×270 path; settings migrate old saves to the new default (settingsV 2).
- Evidence READ: `shots/park.png`, `shots/village.png` — single-pixel texel
  edges on cobble/bark/plaster at 1920×1080; `shots/pause.png` — menu text
  razor-sharp; side-by-side vs `shots/aa8-before-old-default.png` (the old
  480×270 upscale) shows the blur is gone.
- Gates: shellcheck 16/16 (asserts rtW 1920, dither ≤0.15, sharpen >0);
  perfgate PASS (96 calls / 80.4k tris / 218KB gz vs Q.4 budgets 150/250k/1.4MB).

### AA.1 — moon ✅ 2026-07-24
- Arc reauthored: ESE rise → whole-sky sweep → sets in western fog (elev 0.68→0.04,
  azim 1.95→-2.85); each zone pose pins the night minute where its authored framing
  honestly crosses the arc. Face 34u + halo 84u; maria contrast up; flare core
  0.55→0.26 so the painted face reads; emissive #9d97c2.
- Evidence READ: all 9 exterior poses contain the moon (park through trees,
  village over the street, gloomspire crowning the castle, ruins behind the
  façade + Curator, isle/sea low over the water, mosswood over the arch,
  foglands beside the breadcrumb lantern, rooftops high in the cobalt sky).
- Known follow-ups logged for AA.4: rooftops pose lost its subject; mosswood
  snore-Z clips frame edge; foglands sky band too dark (AA.3 scope).
### AA.2 — warm light ✅ 2026-07-24
- Carried lantern pool: shared-shader per-vertex warm falloff (7m, near-field
  attenuated so the wearer gets a rim, not a bath) fed by local + remote staff
  lanterns with flicker; ember pilot-glows breathe on every unkindled light
  (additive dot, distance-culled); kindled pools unchanged (baked vertex warm).
- Evidence READ: lanternpool.png (player alone in open dark: ground pool, fence
  rim, distant pilots), hall.png (sconce pilots + chandelier + carpet),
  park/village (pilots + warm windows). huecheck PASS 3/3 (park warmth 0.00645
  vs 0.0015 floor); perfgate PASS (98 calls — pilots are culled).
### AA.3 — saturated darkness ✅ 2026-07-24
- Post floor rebuilt: zone fog hue, saturation pushed (×1.45+0.08), screen-blend
  masked to shadows (smoothstep lum 0.4→0.05) — darkness colorizes toward the
  zone hue, warm accents keep their fire. Floor brightness 0.05→0.085 peak.
- Gate hardened for AA.3: huecheck now samples the FINAL frame
  (samplePaletteFinal reads the default framebuffer post-pipeline), covers all
  9 zones (was 3) and asserts per-zone saturation floors (minSat on
  hueStrength). 9/9 PASS.
- Evidence READ: village.png (rich indigo night, warm windows pop), hall.png
  (readable, though E.6 candle-pool showcase work remains), park/gloomspire/
  mosswood/isle/foglands reshot. Park warmth margin is thin (0.00152 vs
  0.0015) — AA.4 density adds honest warm content to that frame.
### AA.4 — density ✅ 2026-07-24
- Global: low-frequency painted ground variation (mossy drifts, dry patches)
  baked into vertex colors; path edging stones along every road ribbon (one
  merged draw call, clustered with gaps per P.1); water wavelet contrast up.
- Park: mushroom story-clusters sized to read + lawn boulders in 2s/3s.
- Rooftops: ridge chimneys + sagging clothesline (with P.4's odd sock), roof
  lantern warm pools; pose recomposed along the prop line, moon over the
  western roofs. Mosswood: pose recomposed — Mote sleeping mid-left, arch
  subject, snore-z inside frame. Sea: true across-the-water frame with the
  spec's offshore rowboat + causeway leading line. Foglands: near breadcrumb
  lantern + edging in frame.
- NEW HARD GATE: scripts/quartercheck.mjs — per-quadrant luminance stddev +
  edge energy on every zone shot; ground quadrants must be differentiated
  (sky quadrants exempt as authored gradient). 10/10 PASS. huecheck 9/9,
  perfgate PASS (101 calls / 89.8k tris).
### AA.5 — fun floor ✅ 2026-07-24
- First kindle staged: Beldam murmurs the pointer ("...lamp went cold again.
  right here, beside my bench, friend... zzz") ~7s after control; the cold
  lamp advertises itself 1.9m from spawn with its pilot ember.
- The open country got content: 6 wayside shrines (O.2 hooded figures, optional
  amber cold lights), 3 leaning memorial stones, a lone bench + a sea-view
  bench, 3 ravens on weathered posts (head-track passers, one caw each).
- NEW HARD GATE: scripts/wandercheck.mjs — seeded 3-minute random walk;
  actionable/discoverable encounter (light/brew/sign/crumb/bench/sleeper/raven
  within 16m) at least every 20s. PASS: max gap 16.1s. Autopilot PASS
  (all 37 required kindles + 8 stirs + reel + reset).
### AA.6 — content completeness ✅ 2026-07-24
- All 8 zones + Foglands live in THIS repo's Vite app (src/game/*): traverse
  gate walks them on foot 11/11; the full Restored-mode reel exists and was
  read shot-by-shot through AA.1–AA.4. No published-artifact-only content.
### AA.7 — player readability ✅ 2026-07-24
- Character hemisphere gains a violet-biased fill so the #4B3B6E robe tint and
  silhouette never crush to black; carried-lantern rim (AA.2) warms the hat
  brim and shoulders. Evidence READ: player.png (hat + head + beard clearly
  identifiable beside the bench), lanternpool.png (plum-violet robe, halo rim,
  full silhouette against open dark).

---

## POLISH REVIEW PASS 1 — 2026-07-24

**Protocol:** full hard-gate suite (sequential; three concurrency flakes re-run
solo), full Restored reel + postcards regenerated and READ, two competing
fresh-context reviewers (A: visuals vs specs; B: code/systems vs last 12
commits). Findings merged below; fixes applied within this pass are marked.

### Reviewer A findings → outcomes
1. Rooftops warm accent unreadable (HIGH) → FIXED: normal-blend ember cores in
   every pilot (additive orange over cobalt read purple); huecheck kindled
   warmth 0.0032–0.0065 passes; unkindled reel now shows true-orange embers.
2. Carried pool invisible in lanternpool.png (HIGH) → FIXED: radius 7→8,
   warm gain 0.38→0.6; reshoot READ — pool clearly lands on the grass.
3. Hall showcase absent (HIGH) → PARTIAL: pool gain ×2.0, vault fade, drifting
   floor mist ×4, two moon shafts; hall.png improved, still shy of "prestige
   interior" — carried to pass 2 (POLISH-E6 stays open).
4. Rooftops moss palette missing (MED) → carried to pass 2 (shingle repaint).
5. Rooftops starfield not densest (MED) → carried to pass 2.
6. Robe reads teal-black (MED) → FIXED: hemisphere tint desaturated 35% on
   characters; robe now plum-violet in reshoots.
7. No moon reflection on water (MED) → FIXED: streak follows the viewer along
   the moon azimuth, clamped to open water; visible in sea.png reshoot.
8. Postcards missing (MED) → FIXED this pass (8 authored cards + rig).
9. Ledger lacks B–Q entries (MED) → FIXED: 12 entries seeded (115 total).
10. Foglands quadrants pass by gradient (LOW) → documented in DECISIONS #3.
11. Village shingle texel scale (LOW) → carried with #4.
