# MOONREST — Polish Audit (PRESTIGE_PASS Part A.1)

Date: 2026-07-24. Basis: baseline `scripts/init.sh` green (build 0, smoke OK,
console clean); full shot reel in docs/build/shots/ READ; JUDGE.md 3-pass
history; PROGRESS.md tail; owner playtest verdict ("blurry, too dark, moon and
warm lights missing, not much to do").

## Ranked issue list (player-visible impact × frequency × emotional damage ÷ cost)

Part AA findings are pre-seeded at the top, already ranked. Nothing below AA
begins until every AA item has screenshot evidence in POLISH_JUDGE.md.

| Rank | ID | Issue | Evidence |
|---|---|---|---|
| 1 | POLISH-AA8 | Blurry: 480×270 upscale smears everything at 1080p; soft-blur 0.6 default worsens it | every PNG in shots/ (texel mush, soft menu text) |
| 2 | POLISH-AA1 | Moon weak/missing: washed-out disc partially in frame in park.png; absent from village/gloomspire/mosswood/ruins shots | park.png, village.png, gloomspire.png |
| 3 | POLISH-AA3 | Crushed grey-black darkness: hall.png near-black; village mid-frame crushes; floor uFloor #04060c is nearly neutral | hall.png, village.png, gloomspire.png |
| 4 | POLISH-AA2 | Warm light scarce/dim: single lantern pinpricks; no lantern-staff pool on ground around player; unkindled lights unreadable | park.png (one lamp), hall.png (candles invisible) |
| 5 | POLISH-AA4 | Empty flat world: screen-quarters of bare grass/sky; trunk-heavy trees; wide featureless path; castle a distant stamp in empty frame | park.png, gloomspire.png |
| 6 | POLISH-AA5 | "Not much to do": nothing advertises itself; first kindle not staged; no wander-test gate | owner verdict; no discoverability evidence in ledger |
| 7 | POLISH-AA7 | Player reads as black blob: robe renders near-black, hat merges with background | park.png center |
| 8 | POLISH-AA6 | Content completeness: 8 zones + Foglands DO exist in this repo's Vite app (verify against Part 3 after AA.8 reshoot) | shots reel exists; re-verify |
| 9 | POLISH-B2 | Layered depth missing: no foreground framing elements in most poses; no distant silhouette layer beyond fog | village.png (bare sky), gloomspire.png |
| 10 | POLISH-E5 | Gloomspire castle silhouette quality: blocky wall grid, no layered towers, no water reflection visible in pose | gloomspire.png |
| 11 | POLISH-E6 | Hall "prestige interior" is the weakest shot in the reel: candle pools unreadable, ceiling a black mass without shape | hall.png |
| 12 | POLISH-C1 | Movement personality: no lean/settle/foot-planting polish visible in captures; idle variety minimal | feel capture history |
| 13 | POLISH-K1 | First ten minutes: no staged opening (rain→moon→lamp→title); title arrives as plain menu | title.png |
| 14 | POLISH-F1 | Audio continuity: zone loops crossfade but share no night pulse/motif (score.js layers are per-zone islands) | score.js review |
| 15 | POLISH-P1 | AI tells: even prop spacing (village lamps), uniform emissive windows, no broken/mended thing anywhere | village.png |

## Five strongest existing elements
1. The retro pipeline itself (quantize/dither/modes) — solid, tested, fast.
2. Co-op stack: 17/17 two-context checks, join/leave/late-join hardened.
3. Systems completeness: 94-entry ledger, full-night autopilot, all sleepers/trinkets/brews wired.
4. The isle pose composition (leading line + keep + moon streak) — best shot.
5. Deterministic gate suite (feel/kindle/traverse/moments/hue/perf/coop/shell) — real regression armor.

## Ten most visibly unfinished/cheap elements
1. Upscale blur over everything (AA.8). 2. Hall darkness (AA.3/E.6).
3. Castle wall = repeated block grid (E.5). 4. Trunk-only trees, canopy cards
sparse (AA.4). 5. Bare grass quarters in Park (AA.4). 6. Village sky quadrant
empty indigo (B.2). 7. Player robe unreadable black (AA.7). 8. Unkindled lamps
invisible at 10m (AA.2). 9. Moon washed-out/absent (AA.1). 10. Path edges:
straight-cut grass/cobble seam, no edging stones (AA.4).

## Five moments where attention drops
1. Walking Park→Village foglands (nothing actionable en route). 2. Arrival in
Gloomspire before the causeway lamps (dark on dark). 3. Hall entry (can't see
the room). 4. Long Isle causeway mid-section. 5. Post-kindle lulls: no ambient
micro-events between lights (AA.5).

## Three weakest zones
Gloomspire (silhouette quality), Hall (readability), Foglands (pure corridor).

## Three strongest shots
isle.png, park.png (composition, not clarity), rooftops nib.png.

## Three weakest shots
hall.png, gloomspire.png, foglands.png.

## Most repetitive interaction
Kindle hold: identical stages/sfx for every light type (C.3 variations absent).

## Least convincing animation
Walk cycle foot contact (slide under acceleration); robe is rigid.

## Weakest audio transition
Zone crossfade: 6s linear gain swap, no shared pulse carried across (F.1).

## Largest performance cost
World static merges are fine (97 calls / 80k tris). Headroom exists for
Restored-mode native RT (the post pass runs at RT size; native RT ×~8 pixels
is the risk to measure in PERFORMANCE_AUDIT.md).

## Feels procedural in a bad way
Village lamp spacing (even), window emissive uniformity, texture splotch
uniformity on large walls, straight zone-boundary grass seams.

## Debug/placeholder feel
F3 overlay is fine (dev only). Foglands fingerposts render floating text
sprites — acceptable but plain. No lorem/TODO found in UI strings.

## Vibe Constitution violations (Part 2, checked against shots)
Rule 1 (saturated darkness) — violated in Hall/Village mid-tones (AA.3).
Rule 6 (moon is UI, visible every exterior) — violated (AA.1).
Rule 2 (warmth scarce-but-present) — violated in practice: scarce to invisible (AA.2).

## AI tells (Part P checklist hits)
Even spacing, uniform emissives, no mended/crooked object, no wear-where-use,
no human fingerprint details yet (P.4 list to author).
