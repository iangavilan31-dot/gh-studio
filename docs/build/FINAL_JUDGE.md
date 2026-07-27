# FINAL_JUDGE — MOONREST, the final run

Protocol: `docs/FINAL_PASS.md` Part 10. Two consecutive passing reviews are
required to ship. A pass needs **stop-scrolling ≥ 9.0**, **first-ten-minutes ≥
9.0**, and **no category below 8.5**, across twelve categories.

Every pass regenerates the poses, captures the opening, runs every
deterministic gate, and — this is the part that cannot be skipped or
self-served — puts the frames in front of **two fresh-context reviewer
subagents that built none of it**, competing to find the most serious problems.

## Standing note on how this file is to be used

Two things this run has already learned the hard way, recorded here because a
judge file is exactly where they get forgotten:

1. **Two consecutive greens from a flaky instrument mean nothing.** The
   composition gate reported `PASS (13/13)` twice in a row while the build
   underneath was an 11/13 (DECISIONS #15). The ship condition asks for two
   consecutive passing reviews; that is only evidence if the review is
   repeatable. Establish stability first, then count.
2. **Check what the instrument actually looked at.** A gate reported a perfect
   pacing score for a player wedged against a rock for nine sim minutes
   (DECISIONS #21), and a route that sampled under half a zone was read as
   evidence the zone was thin (DECISIONS #25). Read the numbers underneath the
   verdict.

---

## Pass 1 — pending

Frames regenerating on the current build; reviewers to follow.

**Known state going in, so the score is read in context.** Stages 1 and 2 are
complete (real lighting, post chain, grade, palette lock; the Blender factory).
Stage 3 (the Park finished — Antlered Sleeper, hero trees, rain, Beldam), Stage
5 (the Village) and Stage 6 (the Isle and Night's End) are **not built to the
Part 7 specification yet**. A low score on stop-scrolling, scale-and-awe or
handcraft is therefore expected and is the point: this pass exists to produce
the defect list that directs those stages, not to certify anything.

---

## Pass 1 — FAIL. Two independent reviewers, and they agree.

Reviewer A judged the frames as composition against the art law. Reviewer B
judged the opening as an experience. They were given different briefs and told
not to duplicate each other. **They converged on the same top three defects
anyway**, which is the strongest signal in this file.

### Scores (worst of the two reviewers where they differ)

| # | Category | Score | Ship bar |
|---|---|---|---|
| 1 | stop-scrolling | **3** | ≥9.0 |
| 2 | first ten minutes | **1** | ≥9.0 |
| 3 | composition | **3** | ≥8.5 |
| 4 | lighting | **5** | ≥8.5 |
| 5 | scale and awe | **1** | ≥8.5 |
| 6 | atmosphere | **4** | ≥8.5 |
| 7 | wordless clarity | **1** | ≥8.5 |
| 8 | movement and camera feel | **3** | ≥8.5 |
| 9 | audio | **not assessable** | ≥8.5 |
| 10 | performance at High | **not assessable** | ≥8.5 |
| 11 | stability | **3** | ≥8.5 |
| 12 | handcraft | **2** | ≥8.5 |

Two categories have **no evidence at all**. Audio was never captured; the
performance numbers in PERFORMANCE_AUDIT.md describe the *previous* game target
(480×270 retro), not this renderer. Scoring either from stills would be
fabrication. This pass cannot close until both have real evidence, and that is
a gap in the harness, not in the reviewers.

### The three findings both reviewers reached independently

**1. The zero-words rule is violated in live code, and my gate cannot see it.**
`ten/01-lit-1.png` carries four sentences of Beldam dialogue. Verified: **23
`hud.say`/`sayLater` call sites** carry English prose. `scripts/wordcheck.mjs`
samples the DOM at exactly two moments, so a timed subtitle is structurally
invisible to it — and it reported PASS. Third instance this run of an
instrument reporting green because it never looked (DECISIONS #15, #21, #24),
and this time it is one I built after learning that lesson.

**2. Every frame is value-inverted: the ground is brighter than the sky.**
Measured top-third vs bottom-third L\*: park 17.1/31.7 · lanternpool 21.3/34.7 ·
isle 12.4/25.8 · ten/02-lit-3 21.8/**41.5**. This holds in all thirteen images.
It is why the world reads as a snowfield rather than a wet night park, why no
dark foreground mass touches any edge, why the player in a pale robe is the
brightest thing in his own game, and why no focal point can form. Both
reviewers named it the single highest-value fix.

**3. None of the three mandated colossi exist.** No Antlered Sleeper in the
Park, no Long Sleeper on the Village horizon, no Drowned Choir ribcage on the
Isle. Nothing in any frame exceeds ~20m against a law demanding 60m+. Scale and
awe scores 1 because the promise is entirely unmade.

### Findings against my own instruments — the uncomfortable ones

- **`00-spawn.png` still contains the word "kindle".** The source fix landed;
  the screenshot was captured before it and never regenerated. I then wrote
  that the frames "confirm by eye that the zero-words fix landed" having looked
  at one frame that had no prompt showing. That is exactly the standing order
  in FINAL_PASS 1.2 — never mark anything done without looking at the evidence
  — and I broke it while claiming to satisfy it.
- **`composecheck.mjs` implements 3 of the 10 metrics DIRECTION Part 11.2
  mandates** — edge mass, foreground framing, focal point, depth planes, sky
  fraction, horizon straightness and emptiness are all absent. It reports
  13/13. Applying the missing edge-mass rule, **7 of 13 poses fail**. A gate
  that measures only what already passes manufactures confidence.
- **`composecheck.json` is older than the frames it certifies.** The green does
  not describe the committed images.
- **6 of 13 gated poses are archived zones** (rooftops, gloomspire, hall,
  mosswood, ruins, foglands) that Part 1 Rule 1 puts out of scope.
- The capture's "138 events" is **114 zone flip-flops** between village and the
  archived rooftops volume, against only **4 unique kindles**. Deduped, the
  worst real dead stretch is **168s** against a 12s threshold.

### Work order this produces

1. Delete `hud.say` prose everywhere; rewrite wordcheck to hook the HUD methods
   and poll across a full drive rather than sampling two moments.
2. Invert the value structure — cut terrain albedo hard, lift sky above ground,
   raise kindled emissive until lit lamps actually clear L\*75.
3. Block in the three colossi at correct scale, even untextured.
4. Implement the seven missing composition metrics; expect and record failure.
5. Cut the six archived poses from the registry.
6. Replace the moon billboard with an analytic disc (both reviewers called it
   the loudest "default asset" tell in the build).
7. Capture audio and real performance evidence, or the pass cannot close.

### Correction to Pass 1 — one reviewer finding was my instrument, not the game

Both reviewers reported that the capture showed **14 kindle events but only 4
unique light ids**, and read it as lights re-firing without an already-lit
guard. Reasonable from the data they were given. It is wrong, and the fault is
mine.

`world.kindle()` guards with `if (!light || light.kindled) return false`, and
`state.kindled` is derived as `lights.filter(l => l.kindled).map(l => l.id)` —
so duplicates are not representable. The game never double-counted.

The capture logged the newly-lit light as `kindled[length - 1]`. That array is
in **world order, not kindle order**, so it named whichever kindled light
happened to sit last in the world array — the same few ids over and over. 14
kindle events were 14 real lights, matching the "14 lamps" in the same summary
line. Fixed by diffing the id sets.

Everything else both reviewers found has been verified as real. This one is
recorded because a judge file that keeps a false finding is worse than one that
admits a correction — the next pass would have gone hunting for a bug that was
never there.
