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

## Judge pass 2 — scored 2026-07-24 (after POLISH-52..56)
Evidence: all 9 zone shots + postcards park-1/hall-1/isle-1 (+ village/
gloomspire/rooftops/ruins/mosswood/foglands/sea) personally read on the
final build of this cycle. Headline change: texture repeat/offset
activation (DECISIONS #6) re-textured the world; hall/rooftops restaged.

1. opening impact **8.6** — sequence unchanged; the world it reveals now
   reads (tiled ground under the rain-black lift). Moon-reveal hold beat
   still owed. (<9 ✗)
2. movement feel **8.7** — C.3 reach-by-height + replication, headLook
   ease-out, charm gated, repeat-key recovery; landing settle and jog
   camera lag still absent. (<9 ✗)
3. camera quality **8.6** — reveal volumes at ALL 7 entrances,
   presentation-only yaw bias (movement basis untouched); capture
   evidence for the C.2 flip still owed.
4. character charm **8.4** — charm idle (gated), slope stride, uphill
   lean, local-only glance-back; hat-gust and proud-nod still absent.
5. zone composition **8.8** — rooftops recomposed (Nib+moon+lamp, level
   look), foglands east corridor, player open-dark, hall corridor +
   album postcard; no weak sister left, none exceptional either.
6. material readability **9.0** — the repeat activation: shingle courses,
   wall masonry, hall floor tiles, 4m ground grass, water wavelets —
   confirmed in every shot read.
7. atmosphere **9.1** — moon occluded by terrain (isle), grain rim faded,
   hall moon shafts, flat splash rings; fog=horizon everywhere. ✓
8. environmental storytelling **8.6** — Pale King staging joins shrines/
   memorials/ravens/rowboat; P.4 fingerprints still 1/8.
9. interaction satisfaction **8.7** — per-fixture flame flicker now real,
   C.3 reach variation, kindle bloom/chime/layers.
10. audio quality **8.6** — F.3 complete including the late-joiner
    score-start; F.2 positional landmarks still open. (≥8.5 ✓)
11. co-op companionship **8.7** — silent-joiner HIGH fix, channel height
    replication, remote-kindle feedback gating.
12. UI presentation **9.0** — unchanged.
13. performance **9.5** — 61–113 calls, 69–88k tris; perfgate green.
14. stability **9.5** — full console-clean reel; third adversarial
    review cycle (D) applied 9/9.
15. emotional memorability **8.7** — the hall climax finally has its
    king; isle vista + moon language hold.
16. perceived production value **9.0** — the "budget" reads (hall,
    rooftops) are gone; world-wide texel density. ✓

**Average 8.84 — FAIL vs 9.0 (honest).** No category <8.0 ✓ (min 8.4).
Thresholds: opening 8.6 ✗, movement 8.7 ✗, atmosphere 9.1 ✓,
audio 8.6 ✓, production value 9.0 ✓.

### Pass 3 target list (by threshold damage)
1. Opening → 9: moon-reveal hold beat + eased dolly curves + ignition
   punch; K.1 ten-minute capture to time the beats. (cat 1)
2. Movement → 9: hop landing settle (compression + dust), jog camera
   lag, stride foot-plant on slopes. (cat 2)
3. Character 8.4 → 8.8: hat gust in mosswood wind, proud nod after a
   3-lamp streak. (cat 4)
4. C.2 capture evidence (fov/revealT probe at 2 entrances) → flip. (cat 3)
5. F.2 positional bell/organ at village/hall heard before seen. (cat 10)
6. P.4: place remaining 7 fingerprints. (cats 8, 16)

### Pass 2 official gate record (frozen build @ POLISH-56, sequential, idle box)
08:33:24–08:45:10 UTC — feelcheck PASS · kindlecheck PASS · traversecheck
PASS · momentscheck PASS · huecheck PASS · quartercheck PASS · wandercheck
PASS · perfgate PASS · autopilotcheck PASS · coopcheck PASS · shellcheck
PASS — 11/11, npm run build exit 0. Reel note: zone shots are consistent
with this build (hall/rooftops/postcards reshot on it; other zones
untouched by POLISH-54..56 diffs).

## Judge pass 3 — reviewer reports and outcomes

### Reviewer E (visual, fresh context) — median verdict 6.5, none at 9
1. player.png translucent column (4/10) → ROOT-CAUSED: a raindrop <0.5m
   from the lens fills the frame (bisect captures in shots/anim/col-*.png);
   FIXED with a 0.45–2m near-camera particle fade. Class eliminated.
2. rooftops-1 floor-stare (2/10) → REPOSED as roof-edge street canyon
   (warm windows, cobbles, chicken, moon in frame at minute 33). Verified.
3. firstperson.png dither/no-moon/no-pool (3/10) → capture now runs
   Restored (dither 0.15), minute 34 western moon centered, carried pool
   at frame bottom. Verified.
4. cross-glare erases the moon face (global) → streak 0.5→0.26, core
   0.26→0.18: face reads in sea/village-1/gloomspire-1/firstperson reads.
5. sea.png zero warm accent; gloomspire-1 no moon → rowboat stern
   lantern (verified); gloomspire-1 reposed to minute 3 (moon due east
   behind the towers — verified).
6. sorting artifacts → near-fade fixes the class of (i); flare cut helps
   (ii); fingerpost/fence barcode banding FIXED with woodPost vertical
   grain. Lantern-glow detachment (iii) accepted as N64 sprite idiom for
   this pass (glows sit at flame seats; pools appear when lit).
7. mosswood illegible → ambient/skyUp one step up, fog=horizon kept.
   Verified legible.
8. park-1 black trunk → pilot embers +20% (bench lamp reads warmer).
9. village-1 8/10 → dolly 3m forward: now the reel's anchor frame.

### Reviewer F (code, fresh context) — 11 findings, all addressed
HIGH co-op self-kindle marked remote (C.4 feedback dead in MP) → FIXED
  (remote: ev.from !== net.myId).
HIGH intro ember guarded on nonexistent rig.staffLantern → FIXED
  (rig.bones.staffLantern).
MED cues freeze in cinematics → duck(); windGust zeroed parked.
MED rig/autopilot kindles inflate nod/lookBack → remote-flagged.
MED landing dust alpha pop → fade-out update fn.
LOW fp eye height in sit/lie → blended fpEyeTarget.
LOW gust/nod in actions → gated (!action).
LOW KeyV vs rebinds → yields to bound verbs.
LOW nightSignature co-op divergence → seed in snapshot.
LOW comment/dead-code → cleaned (quartercheck pin, nod comment, camera).
(Bell timer page-lifetime: accepted, matches nightPulse pattern.)
F's checked-and-clean list covers: by-reference uniform binding, FP mode
isolation, overlay replication, signature determinism, cue title-leak,
chan h relay, input repeat, world builds, late-joiner score.

## Judge pass 3 — SCORED (after POLISH-60/61)
Official gate record 09:31:19–09:43:05 UTC on the POLISH-60 build:
11/11 sequential PASS (feel · kindle · traverse · moments · hue · quarter
· wander · perf · autopilot · coop · shell), build exit 0.
Evidence read personally this pass: all 9 zone shots, 8 postcards,
firstperson.png, 6 intro beats (shots/intro/), k1capture.json,
revealprobe.json, pancheck.json.

1. opening impact **9.0** — captured beat-by-beat: rain-black lift, the
   moon HOLD through the canopy, descent, Beldam, ignition with rising
   embers AND the bench initials in frame, seamless title blend. K.1
   route capture: zero dead stretches. ✓
2. movement feel **9.0** — landing settle (impact-scaled) + dust + thump,
   jog camera lag, C.3 reach + replication, headLook ease-out, repeat-key
   recovery; latency ≤220ms asserted; feel gates green. ✓
3. camera quality **8.9** — all-zone reveals (probe evidence), doorway
   crossing flips=0, first-person mode with pose-following eye, jog lag.
4. character charm **8.8** — charm/gust/nod/landing all present and
   action-gated; slope stride; local-only glance-back.
5. zone composition **9.0** — village-1 is the anchor frame (moon over
   the vanishing point, chickens on moonlit cobbles); gloomspire-1 moon-
   behind-towers; rooftops-1 street canyon; no frame below ~7.5.
6. material readability **9.1** — world-wide tiling + vertical-grain
   posts; masonry/shingle/cobble/water all read at texel scale.
7. atmosphere **9.2** — the moon is a CHARACTER now (face reads in every
   frame after the glare cut); near-fade killed the artifact class;
   fog=horizon; hall shafts; drizzle. ✓
8. environmental storytelling **8.9** — 8/8 fingerprints (initials appear
   in the opening!), the king, the stern lantern, shrines/ravens/boat.
9. interaction satisfaction **8.8** — per-fixture flames, reach-by-height,
   kindle bloom/chime/layers; pilots advertise.
10. audio quality **8.9** — positional bell/organ (pan evidence) with
    cinematic ducking; F.3 complete; motif; RMS-asserted. ✓ (≥8.5)
11. co-op companionship **8.9** — self-kindle feedback restored, one
    dealt night per lobby, channel-height replication, 17/17 moments.
12. UI presentation **9.0** — unchanged.
13. performance **9.5** — record green; 61–113 calls, 69–88k tris.
14. stability **9.5** — three adversarial review cycles applied; every
    rig console-clean; near-camera artifact class eliminated.
15. emotional memorability **8.9** — the moon language, village-1,
    the hall king, heard-before-seen landmarks.
16. perceived production value **9.2** — the reel's floor is ~7.5 and
    its ceiling is genuine postcard grade. ✓

**Average 9.04 — PASS.** No category <8.0 ✓ (min 8.8). Thresholds:
opening 9.0 ✓ · movement 9.0 ✓ · atmosphere 9.2 ✓ · audio 8.9 ✓ ·
production value 9.2 ✓.

**PASS 3 = PASS #1 of the two consecutive required. Pass 4 (confirming)
follows: fresh reviewers, fix anything found, full sequential record,
honest rescore.**

## Judge pass 4 — CONFIRMING REVIEW, SCORED (after POLISH-63/64)
Official gate record 10:15:04–10:26:58 UTC: 11/11 sequential PASS, build
exit 0. Fresh reviewers G (visual, scored the raw set 8.2 — refuting
pass 3's frame optimism) and H (code, revoked the K.1 flip on a broken
instrument) both fully absorbed: every finding fixed-and-verified on
screen, or explicitly accepted as N64 idiom, or re-certified honestly
(K.1 v4: full 10 minutes, 3 real kindles, zero dead stretches).

1. opening impact **9.0** — the moon HOLD now frames the disc (verified
   after two failed attempts), ignition embers restored from the
   near-fade (verified), K.1 honest. ✓
2. movement feel **9.0** — H verified every overlay/landing path. ✓
3. camera quality **8.9** — FP-exit head-clip fixed; reveals evidenced.
4. character charm **8.8** — holds under H's gating review.
5. zone composition **8.8** — G's calibration honored: village-1 9.5,
   gloomspire/hall/park 9s, park-1/isle-1/firstperson lifted and
   verified; mosswood-1 (7.5) and rooftops-1 accepted below 9. (was 9.0)
6. material readability **9.1** — holds.
7. atmosphere **9.1** — sky banding dithered, near-camera artifact class
   gone; canopy-dither and sprite-glow idioms accepted. ✓ (was 9.2)
8. environmental storytelling **8.9** — Beldam's murmur lands inside the
   first-person frame; initials in the opening.
9. interaction satisfaction **8.8** — holds.
10. audio quality **8.9** — duck() one-shot; four kindle paths verified. ✓
11. co-op companionship **8.9** — holds under H's path-by-path check.
12. UI presentation **9.0** — holds.
13. performance **9.5** — record green.
14. stability **9.5** — FOUR adversarial review cycles; instrument
    honesty enforced (K.1 revoked, re-certified).
15. emotional memorability **8.9** — holds.
16. perceived production value **9.0** — G: "9.0 becomes defensible"
    after the named fixes; they landed and were verified. (was 9.2)

**Average 9.01 — PASS.** No category <8.0 ✓ (min 8.8). Thresholds:
opening 9.0 ✓ · movement 9.0 ✓ · atmosphere 9.1 ✓ · audio 8.9 ✓ ·
production value 9.0 ✓.

**TWO CONSECUTIVE PASSING REVIEWS: pass 3 (9.04) + pass 4 (9.01).
Part L satisfied.**
