"""Monte Carlo stress testing.

Your backtest produced one equity curve. That curve is a single sample from a
distribution of paths your strategy could plausibly have produced -- not the
truth about it. The trades happened to arrive in one particular order; had the
three worst losses clustered in the same week instead of being spread across a
year, the same set of trades would have produced a much deeper drawdown and
possibly a margin call.

This module resamples your realised trades to estimate that distribution. The
outputs that matter:

    p_ruin          probability the account falls below the ruin threshold
    dd_p95          drawdown you should expect to see 1 time in 20
    p_profit        probability of ending up at all

The drawdown a small aggressive account should actually plan around is dd_p95,
not the backtest's single realised max drawdown. The realised number is very
often the optimistic tail of this distribution.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Optional

import numpy as np
import pandas as pd


@dataclass
class MonteCarloResult:
    runs: int
    method: str
    p_profit: float
    p_ruin: float
    ruin_threshold: float
    median_return: float
    mean_return: float
    return_p05: float
    return_p95: float
    dd_median: float
    dd_p95: float
    dd_worst: float
    median_final_equity: float
    worst_final_equity: float
    longest_losing_streak_p95: int
    equity_bands: dict

    def to_dict(self) -> dict:
        return asdict(self)


def _paths_from_trades(
    trade_returns: np.ndarray,
    runs: int,
    method: str,
    rng: np.random.Generator,
) -> np.ndarray:
    """Generate `runs` alternative sequences of the same trades.

    bootstrap  -- sample with replacement. Assumes trades are independent, which
                  overstates confidence when the strategy has serial dependence
                  (most trend strategies do -- their wins cluster in trends).
    shuffle    -- permute the actual trades. Preserves the exact multiset of
                  outcomes and only varies their order. More conservative about
                  what it assumes, so it is the default.
    block      -- resample contiguous blocks, preserving local clustering. The
                  most realistic of the three for strategies whose results are
                  autocorrelated.
    """
    n = len(trade_returns)
    if method == "shuffle":
        return np.array([rng.permutation(trade_returns) for _ in range(runs)])
    if method == "block":
        block = max(2, int(np.sqrt(n)))
        out = np.empty((runs, n))
        for r in range(runs):
            seq = []
            while len(seq) < n:
                s = rng.integers(0, max(1, n - block))
                seq.extend(trade_returns[s:s + block])
            out[r] = seq[:n]
        return out
    return rng.choice(trade_returns, size=(runs, n), replace=True)


def run(
    trades: List,
    starting_equity: float = 500.0,
    runs: int = 2000,
    method: str = "shuffle",
    ruin_threshold: float = 0.5,
    seed: int = 7,
) -> Optional[MonteCarloResult]:
    """Resample trade sequences and summarise the outcome distribution.

    `ruin_threshold` is a fraction of starting equity -- 0.5 means "lost half".
    For a $500 account that is $250, at which point position sizes are small
    enough that recovery is a genuinely different problem.
    """
    if not trades or len(trades) < 10:
        return None

    # Work in fractional returns per trade so compounding is modelled properly.
    # A fixed dollar P&L series would understate the damage of an early
    # drawdown, which is exactly the risk being measured.
    rets = np.array([t.pnl for t in trades], dtype=float) / starting_equity
    rng = np.random.default_rng(seed)
    paths = _paths_from_trades(rets, runs, method, rng)

    curves = starting_equity * np.cumprod(1.0 + paths, axis=1)
    curves = np.hstack([np.full((runs, 1), starting_equity), curves])

    finals = curves[:, -1]
    peaks = np.maximum.accumulate(curves, axis=1)
    dds = 1.0 - curves / np.maximum(peaks, 1e-9)
    max_dds = dds.max(axis=1)

    ruin_level = starting_equity * ruin_threshold
    p_ruin = float((curves.min(axis=1) <= ruin_level).mean())

    # Longest losing streak across resampled paths.
    streaks = np.zeros(runs, dtype=int)
    for r in range(min(runs, 500)):        # 500 paths is plenty for a p95
        cur = worst = 0
        for x in paths[r]:
            cur = cur + 1 if x <= 0 else 0
            worst = max(worst, cur)
        streaks[r] = worst
    nonzero = streaks[streaks > 0]

    qs = [5, 25, 50, 75, 95]
    bands = {f"p{q}": np.percentile(curves, q, axis=0).tolist() for q in qs}

    return MonteCarloResult(
        runs=runs,
        method=method,
        p_profit=float((finals > starting_equity).mean()),
        p_ruin=p_ruin,
        ruin_threshold=ruin_threshold,
        median_return=float(np.median(finals) / starting_equity - 1.0),
        mean_return=float(finals.mean() / starting_equity - 1.0),
        return_p05=float(np.percentile(finals, 5) / starting_equity - 1.0),
        return_p95=float(np.percentile(finals, 95) / starting_equity - 1.0),
        dd_median=float(np.median(max_dds)),
        dd_p95=float(np.percentile(max_dds, 95)),
        dd_worst=float(max_dds.max()),
        median_final_equity=float(np.median(finals)),
        worst_final_equity=float(finals.min()),
        longest_losing_streak_p95=int(np.percentile(nonzero, 95)) if len(nonzero) else 0,
        equity_bands=bands,
    )


def risk_of_ruin_analytic(win_rate: float, payoff: float, risk_frac: float,
                          n_trades: int = 200) -> float:
    """Closed-form-ish risk of ruin by simulation of a fixed-fractional bettor.

    Kept separate from the trade resampler because it answers a different
    question: given only a win rate and payoff ratio, how dangerous is this
    position size? Useful for sanity-checking a risk setting BEFORE you have any
    trades to resample -- for instance, checking what 5% per trade implies.
    """
    if not (0 < win_rate < 1) or payoff <= 0 or risk_frac <= 0:
        return 1.0
    rng = np.random.default_rng(11)
    sims = 5000
    eq = np.ones(sims)
    ruined = np.zeros(sims, dtype=bool)
    for _ in range(n_trades):
        wins = rng.random(sims) < win_rate
        delta = np.where(wins, risk_frac * payoff, -risk_frac)
        eq = eq * (1.0 + delta)
        ruined |= eq <= 0.5
    return float(ruined.mean())
