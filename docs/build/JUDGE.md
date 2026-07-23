# MOONREST — Judge Log

Protocol: docs/MASTER_PROMPT.md 12.4. Hard gates first (deterministic, scripted);
then rubric dimensions (a)–(j) scored 1–10 with evidence; then fresh-eyes reviewer
subagents; then ranked defect list and fixes.

Exit condition: (avg ≥ 8.5 AND no dimension < 7) for TWO consecutive passes, or two
consecutive passes with zero new defects and no score improvement. Minimum 3 passes.

No judge passes yet — begins at M9. Hard-gate scripts land earlier (hue check in M4,
perf capture in M6, co-op assertions in M7).
