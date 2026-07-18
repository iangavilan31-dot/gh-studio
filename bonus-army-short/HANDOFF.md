# Session handoff — Bonus Army short

State of the build and the exact next steps. Written for a fresh Claude Code
session continuing on branch `claude/bonus-army-youtube-short-yv6260`
(draft PR: https://github.com/iangavilan31-dot/gh-studio/pull/1).

## Governing documents

1. The MASTER BRIEF (Vox techniques A1-A9, tool stack, retention science,
   12-beat script, asset list) — in the original session prompt.
2. The FOLLOW-UP brief (supersedes on conflict): reference-clone gate,
   Chatterbox/whisper upgrades, global 12fps stepped rule, build order.

## Approval gates (DO NOT SKIP)

1. **reference-analysis.md** — rip https://www.youtube.com/watch?v=qjafHzNJLQ0
   0:03-0:13 (yt-dlp, `-f "bv*[height<=1080]"`), extract every 2nd frame,
   study, write the analysis (layer stack, per-layer motion with real numbers,
   derived easing, event timing, sampled colors). **User must approve before
   any scene/component work.**
2. **10s proof of beats 1-2** with side-by-side frame strip vs reference.
   User approves before the full build.

## Done (this branch)

- Remotion 4.0.490 project, comps evaluate + render against the
  pre-installed chrome-headless-shell (`remotion.config.ts` points at it)
- `pipeline/`: script.json (12 beats, chunk/word/event data) → vo_local.py
  (offline Mimic3 VITS scratch voice) → assemble.py (61.7s vo.wav,
  timing.json with 76 event anchors, captions.json) → sfx.py (procedural
  SFX/music kit) → preview_mix.py (sound-narrative demo)
- `src/timing.ts`: everything timing reads `public/timing.json`; helpers
  `ev("b7.armyCut")`, `beatFrames("b3")`
- TimingScope diagnostic comp (unstyled, shows anchors firing)
- Bootstrap: `bash pipeline/setup.sh` rebuilds venv + voice models (~2 min)

## Next steps in order (network now Full)

1. `bash pipeline/setup.sh`
2. Gate 1: reference rip + `reference-analysis.md` → STOP for approval
3. Real assets (fetch + treat): NARA 24730 newsreel pulls, LOC Harris & Ewing
   (hec.36872, hec.36889), Underwood Capitol-lawn camp, Horydczak Anacostia
   wides, Chronicling America front pages (July 29 1932 WaPo "ONE SLAIN, 60
   HURT AS TROOPS ROUT B.E.F."; June 18 Senate defeat), portraits (MacArthur/
   Patton/Eisenhower/Hoover/FDR/Hushka), bonus certificate, 1932 DC map.
   Headlines sharp, 1932 article body text blurred (copyright).
4. Final VO: `pip install chatterbox-tts` → `python pipeline/vo_chatterbox.py`
   → `python pipeline/assemble.py` → `node scripts/whisper-captions.mjs`
   (deep measured read; -14 LUFS chain is already in assemble.py)
5. CC0 SFX/music from Pixabay to replace procedural stand-ins (same filenames)
6. Components per master brief section A + reference numbers; global stepped
   12fps rule for decorative graphics (Math.floor(frame/2)*2), camera and
   highlights smooth
7. Gate 2 proof (beats 1-2) → approval → full build → self-QA (section F.6:
   frames 0-90 stranger-swipe check, loop frame pixel-match end vs start)

## Known notes

- Video currently 61.7s; aim ≤58s after Chatterbox re-record (tighten gaps in
  script.json, re-run assemble.py — comps re-time automatically)
- Commits must be authored `Claude <noreply@anthropic.com>` (stop-hook checks)
- git push works via the platform proxy now (GitHub App installed 2026-07-18)
- Loop construction: final frame must pixel-match frame 1 (beat 12 lands on
  beat 1's opening newspaper mid-punch frame)
- Too-fast-to-catch moment: MACARTHUR/PATTON/EISENHOWER stamps 4 frames apart
  on "generals" (`ev("b1.generals")`)
- Music: dead stop at `ev("b7.armyCut")`, 2 frames black, room tone only;
  drone re-enters `ev("b8.start")`
