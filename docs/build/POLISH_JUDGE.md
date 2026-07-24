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

### Reviewer B findings → outcomes
1. Intro shortened fresh nights by 4 min (MED) → FIXED: startNight resets the
   clock to dusk.
2. quartercheck sky exemption unconditional (MED) → FIXED: top quadrants
   exempt only with a measured vertical-gradient sky signature.
3. C1/F1 missing ledger entries (MED) → FIXED (seeded with evidence).
4. Sub-150ms blur could latch keys (MED) → FIXED: refocus clears too.
5. Shrine lean stomped by place() (LOW) → FIXED: yaw passed through.
6. Raven head owl-spin across ±π (LOW) → FIXED: wrapped delta.
7. Reversed smoothstep UB in floor mask (LOW) → FIXED: 1-smoothstep.
8. Intro keyboard-only skip (LOW) → FIXED: pointerdown skips.
9. Latency bound loosened + wander console hygiene (LOW) → FIXED: 220ms bound
   restored; wandercheck gains the standard console guard.
Cleared by B: ledger ratchet intact, fog==horizon untouched, no realtime
lights, no per-frame allocs in the new paths, wayside zone id safe, v2
settings migration, palette readback validity, motif degrees in range.

### Pass 1 — hard-gate record (clean sequential run, build 9daedc9)
build ✓ shoot ✓ postcards ✓ feel ✓ kindle ✓ traverse ✓ moments 12/12 ✓
hue 9/9 ✓ quarter 10/10 ✓ (after sky-signature hardening) wander ✓ (max gap
14.5s after memorial POIs) perf ✓ (101 calls / 89.8k tris / 222KB gz)
autopilot ✓ coop 17/17 ✓ shell 16/16 ✓. Console clean in every rig.
Note: quarter/wander verdicts are from the close-out build (memorial POI
surface + gate hardening only — no gameplay delta); all others from the
pipeline build. Concurrency lesson recorded in DECISIONS #1.

### Pass 1 — scores (1–10, evidence-grounded; reel READ end to end)
1. opening impact **8.5** — rain-black → moon reveal → descent → ignition →
   seamless title lands; the descent easing is still linear-mechanical.
2. movement feel **8.5** — accel lean/settle/turn lean/idle shifts; latency
   one-frame; no foot slide (phase-by-distance). Uphill/downhill effort absent.
3. camera quality **8.0** — orbit/collision/assist solid; NO reveal volumes at
   zone entrances yet (C.2), interior shoulder work pending.
4. character charm **8.0** — silhouette/rim/idle glances good; C.4 rare
   micro-behaviors (hat blow, proud nod, lantern-warm hands) absent.
5. zone composition **8.5** — park/gloomspire/ruins/isle/sea strong postcard
   frames; rooftops remains the weak sister (bare mid-frame, near-pole tangent).
6. material readability **8.0** — cobble/plaster/bark/carpet read; village
   shingles read as masonry slabs (A-11); water better with streak.
7. atmosphere **9.0** — saturated zone hues, fog=horizon, particles/mist
   everywhere, ember pilots breathing, the moon owns every sky.
8. environmental storytelling **8.5** — shrines/memorials/ravens/odd sock/
   boat/sleepers; P.4 fingerprints 1/8 placed.
9. interaction satisfaction **8.5** — kindle bloom/chime/layer add + pilots
   advertising targets; C.3 per-type channel variations absent.
10. audio quality **8.5** — layered generative score + shared pulse + motif +
    beds, RMS-asserted; F.2 positional landmarks and F.3 silence design open.
11. co-op companionship **8.5** — 17/17 verified moments, shared pools/reel.
12. UI presentation **9.0** — crisp DPR type, live diorama, intro, in-fiction
    error boundary.
13. performance **9.5** — 101/150 calls, 90k/250k tris, 222KB/1.4MB gz.
14. stability **9.5** — every rig console-clean; adversarial review×2 fixed.
15. emotional memorability **8.5** — the moon language + Beldam's pointer +
    wayside melancholy; Hall/Isle climaxes not yet at full weight.
16. perceived production value **8.5** — the blur/black/empty era is over;
    hall interior and rooftops still read budget.

**Average 8.59 — honest fail vs the 9.0 bar (expected at pass 1).**
Thresholds: opening 8.5 (<9 ✗), movement 8.5 (<9 ✗), atmosphere 9.0 ✓,
audio 8.5 ✓, production value 8.5 (<9 ✗).

### Pass 2 target list (by production-value damage)
1. Rooftops zone rebuild-lite: moss shingle repaint + row rhythm (also fixes
   village B.3), densest starfield, pose tangent fix. (cats 5,6,16)
2. Hall showcase phase 2: brighter pool bake + throne staging + reverb-visible
   candle reflections via painted floor sheen. (cats 5,16)
3. C.2 reveal volumes at 3 hero entrances (village downhill, gloomspire
   causeway, isle causeway) + jog camera lag. (cat 3)
4. C.4 charm: 3 rare idles (lantern-warm hands, hat gust in mosswood, look-back
   at freshly lit street) + C.3 kindle variation by target height. (cats 4,9)
5. Opening: eased dolly curves + moon-reveal hold beat. (cat 1)
6. Movement: uphill lean / careful downhill steps. (cat 2)
7. F.3 silence before first kindle + F.2 positional bell/organ. (cat 10)
8. P.4: place remaining 7 fingerprints. (cats 8,16)

### Reviewer D (pass 2, code/systems) — findings → outcomes
1. HIGH co-op late joiner gets silent night (score never starts from quiet
   snapshot kindles) → FIXED main.js applySnapshot: score.start() when
   audio.started && kindledCount>0. (POLISH-53)
2. HIGH texture.repeat/.offset silent no-ops on ShaderMaterial → FIXED:
   uMapRepeat/uMapOffset bound by reference; world-wide tiling + flame
   frame anim + water scroll activated. Ribbon/shingle redundant repeats
   removed to preserve approved looks. (POLISH-53, DECISIONS #6)
3. MED focus-clear leaves held keys dead (e.repeat dropped) → FIXED:
   repeat events re-register held keys without justPressed.
4. MED charm idle fires inside lie/sleep/channel → FIXED: gated !st.action.
5. MED-LOW headLook snaps ~25° on expiry → FIXED: eases to zero, releases
   at |headLook|<0.02.
6. LOW-MED shrine leanYaw un-aligned pilot ember/light registration →
   FIXED: registration rotated by leanYaw.
7. LOW lookBack+rumble fired on remote/autopilot kindles → FIXED: remote
   flag threaded world.kindle → onKindle; local-only feedback gated.
8. LOW channelHeight not replicated → FIXED: 'chan' event carries h.
9. LOW reveals covered 5/7 zones vs ledger claim → FIXED: rooftops + hall
   added to LANDMARKS. (C.2 capture evidence still owed before flip.)

### Reviewer C carry-overs closed this cycle
- Pale King readability: candelabra pair + soft bake (gain 0.4 r 5.5) +
  king scaled 1.3 seated at throne face — postcards/hall-1.png READ.
- Isle moon-over-headland (#8): moon at 205m, planes rescaled — isle.png
  shows the headland occluding the halo correctly.
- Per-fixture flame variation (#9): flame textures were already per-fixture
  clones; activation of offsets makes each fixture flicker independently.
- Splash rings (new, from tiling reshoot): flat ground basis — no more
  floating circles in player.png.
