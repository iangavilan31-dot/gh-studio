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
