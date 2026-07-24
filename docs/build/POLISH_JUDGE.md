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

### AA.1 — moon: pending
### AA.2 — warm light: pending
### AA.3 — saturated darkness: pending
### AA.4 — density: pending
### AA.5 — fun floor: pending
### AA.6 — content completeness: pending
### AA.7 — player readability: pending
