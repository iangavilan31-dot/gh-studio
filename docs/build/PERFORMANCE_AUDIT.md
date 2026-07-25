# PERFORMANCE_AUDIT — DREAMSCRAP feel + perf numbers (Part 5)

All feel numbers are SIM TICKS at fixed 60Hz (16.667ms/tick), measured by
scripts/fightfeel.mjs manual stepping (DECISIONS #8) — deterministic,
contention-proof.

## F1 kinematics record (first green run)
- input→action: jump consumed on tick 1 of the press; live path is
  event → same-frame snapshot → next tick ⇒ ≤2 ticks = 33.3ms ✓ (gate ≤34ms)
- input buffer: 6 ticks (tap 4-before-land fires; 9-before does not) ✓
- coyote time: 5 ticks (free jump at +3, double-jump consumed at +7) ✓
- run speed 6.4 m/s; jump apex ≈2.2m @23 ticks; dj apex ≈1.8m
  (raised from 9.6/8.6 — the FIRST gate run caught 3.0m platforms being
  unreachable; feel bug fixed before any art existed)
- fast-fall ×1.8 (measured faster descent) ✓ · no wall-stick (vy keeps
  growing beside slabs) ✓ · ledge snap 0.35m · drop-through down+jump ✓
- landing lag 2–8 by move weight: plumbed (aerialWeight), GATED IN F2
  when moves exist — not yet claimed.

## Perf budget notes
- Dream scene draw calls (F1 blockout): trivial. Budget tracking begins
  when fighters+items+hazards land (F5/F6); MOONREST budgets apply
  unchanged (≤150 calls, ≤250k tris).
