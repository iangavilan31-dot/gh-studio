"""Walk-forward analysis and parameter optimisation.

A single backtest over all your history answers the wrong question. It tells you
what the best parameters would have been *if you had known the future*. Walk-
forward asks the right one: if I had re-optimised periodically using only past
data, and traded the winner forward, what would have actually happened?

Structure per fold:

    [------- train (optimise here) -------][-- test (trade, never tune) --]
                    then roll forward by `step` and repeat

Only the concatenated TEST segments count. The training results are diagnostics
and nothing more.

The number you should care about most is `efficiency` -- out-of-sample return
divided by in-sample return. Above ~0.5 suggests the edge survives outside the
fitting window. Below ~0.3 means you optimised noise. Efficiency near or above
1.0 is not a triumph; it usually means your parameter grid barely mattered,
which is worth knowing too.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from ..strategies.base import Context, Strategy
from . import metrics as M
from .engine import Backtester, BacktestResult


@dataclass
class Fold:
    index: int
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    best_params: dict
    train_metric: float
    test_metrics: M.Metrics
    n_trades_test: int


@dataclass
class WalkForwardResult:
    strategy: str
    symbol: str
    timeframe: str
    folds: List[Fold] = field(default_factory=list)
    stitched_equity: pd.Series | None = None
    stitched_metrics: M.Metrics | None = None
    total_trials: int = 0
    param_stability: float = 0.0     # how often the optimiser picked the same params
    efficiency: float = 0.0

    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "n_folds": len(self.folds),
            "total_trials": self.total_trials,
            "param_stability": self.param_stability,
            "efficiency": self.efficiency,
            "metrics": self.stitched_metrics.to_dict() if self.stitched_metrics else {},
            "folds": [
                {
                    "index": f.index,
                    "train_start": str(f.train_start),
                    "test_start": str(f.test_start),
                    "test_end": str(f.test_end),
                    "best_params": f.best_params,
                    "train_metric": f.train_metric,
                    "test_sharpe": f.test_metrics.sharpe,
                    "test_return": f.test_metrics.total_return,
                    "test_pf": f.test_metrics.profit_factor,
                    "n_trades": f.n_trades_test,
                }
                for f in self.folds
            ],
        }


def _param_combos(grid: Dict[str, list], cap: int = 400) -> List[dict]:
    """Cartesian product of the grid, capped.

    The cap is a real constraint on credibility, not just compute: every
    additional combination inflates the selection bias the Deflated Sharpe has
    to subtract. When the cap bites, a deterministic stride is used rather than
    random sampling so results are reproducible across runs.
    """
    keys = list(grid)
    combos = [dict(zip(keys, vals)) for vals in product(*(grid[k] for k in keys))]
    if len(combos) <= cap:
        return combos
    stride = max(1, len(combos) // cap)
    return combos[::stride][:cap]


def _objective(m: M.Metrics) -> float:
    """What the optimiser maximises.

    Not raw return, and not raw Sharpe. Return alone selects the single luckiest
    parameter set; Sharpe alone ignores whether there were enough trades to
    matter. This penalises thin samples and heavy drawdowns, which is closer to
    what you actually want to own.
    """
    if m.n_trades < 5 or not np.isfinite(m.sharpe):
        return -99.0
    sample_penalty = min(1.0, m.n_trades / 30.0)
    dd_penalty = 1.0 / (1.0 + 3.0 * max(0.0, m.max_drawdown - 0.15))
    return m.sharpe * sample_penalty * dd_penalty


def optimise(
    strategy_cls: type[Strategy],
    df: pd.DataFrame,
    bt: Backtester,
    ctx: Context,
    grid_cap: int = 400,
) -> Tuple[dict, float, int]:
    """Grid-search on one window. Returns (best_params, best_objective, n_trials)."""
    probe = strategy_cls()
    combos = _param_combos(probe.grid(), grid_cap)

    best_params, best_score = dict(probe.p), -np.inf
    for combo in combos:
        try:
            strat = strategy_cls(**combo)
            sigs = strat.generate(df, ctx)
            res = bt.run(df, sigs, ctx.symbol, strat.name, ctx.timeframe)
            m = M.compute(res.equity, res.trades, ctx.timeframe,
                          bt.starting_equity, res.exposure, n_trials=1)
            score = _objective(m)
        except Exception:
            continue
        if score > best_score:
            best_score, best_params = score, combo

    return best_params, float(best_score), len(combos)


def walk_forward(
    strategy_cls: type[Strategy],
    df: pd.DataFrame,
    bt: Backtester,
    ctx: Context,
    train_bars: int = 5000,
    test_bars: int = 1250,
    step_bars: int = 1250,
    min_trades_per_fold: int = 15,
    grid_cap: int = 200,
    progress: Optional[Callable[[str], None]] = None,
) -> WalkForwardResult:
    out = WalkForwardResult(strategy=strategy_cls.name, symbol=ctx.symbol, timeframe=ctx.timeframe)

    n = len(df)
    if n < train_bars + test_bars:
        return out

    equity_pieces: List[pd.Series] = []
    all_trades: List = []
    param_choices: List[tuple] = []
    is_returns, oos_returns = [], []

    start = 0
    fold_i = 0
    while start + train_bars + test_bars <= n:
        train = df.iloc[start:start + train_bars]
        test = df.iloc[start + train_bars:start + train_bars + test_bars]

        if progress:
            progress(f"fold {fold_i}: train {train.index[0].date()} -> test {test.index[-1].date()}")

        best_params, train_score, n_trials = optimise(strategy_cls, train, bt, ctx, grid_cap)
        out.total_trials += n_trials

        # In-sample return for the efficiency ratio.
        try:
            s_is = strategy_cls(**best_params)
            r_is = bt.run(train, s_is.generate(train, ctx), ctx.symbol, s_is.name, ctx.timeframe)
            is_returns.append(r_is.equity.iloc[-1] / bt.starting_equity - 1.0)
        except Exception:
            is_returns.append(0.0)

        # Out-of-sample: fixed parameters, no peeking, no re-tuning.
        try:
            strat = strategy_cls(**best_params)
            sigs = strat.generate(test, ctx)
            res = bt.run(test, sigs, ctx.symbol, strat.name, ctx.timeframe)
            m = M.compute(res.equity, res.trades, ctx.timeframe,
                          bt.starting_equity, res.exposure, n_trials=1)
        except Exception:
            start += step_bars
            fold_i += 1
            continue

        oos_returns.append(res.equity.iloc[-1] / bt.starting_equity - 1.0)
        param_choices.append(tuple(sorted(best_params.items())))

        if len(res.trades) >= min_trades_per_fold or True:
            # Folds below the trade minimum are still stitched -- excluding them
            # would be survivorship bias at the fold level -- but the count is
            # recorded so thin folds are visible in the report.
            equity_pieces.append(res.equity)
            all_trades.extend(res.trades)

        out.folds.append(
            Fold(
                index=fold_i,
                train_start=train.index[0], train_end=train.index[-1],
                test_start=test.index[0], test_end=test.index[-1],
                best_params=best_params, train_metric=train_score,
                test_metrics=m, n_trades_test=len(res.trades),
            )
        )
        start += step_bars
        fold_i += 1

    if equity_pieces:
        out.stitched_equity = _stitch(equity_pieces, bt.starting_equity)
        out.stitched_metrics = M.compute(
            out.stitched_equity, all_trades, ctx.timeframe,
            bt.starting_equity, None, n_trials=max(1, out.total_trials),
        )

    if param_choices:
        most = max(set(param_choices), key=param_choices.count)
        out.param_stability = param_choices.count(most) / len(param_choices)

    if is_returns and oos_returns:
        tot_is, tot_oos = float(np.sum(is_returns)), float(np.sum(oos_returns))
        out.efficiency = float(tot_oos / tot_is) if abs(tot_is) > 1e-9 else 0.0

    return out


def _stitch(pieces: List[pd.Series], start_equity: float) -> pd.Series:
    """Chain fold equity curves multiplicatively.

    Each fold restarts the backtester at `start_equity`, so the pieces are
    compounded by their returns rather than concatenated by level -- otherwise
    the curve would reset to the starting balance at every fold boundary.
    """
    out, level = [], start_equity
    for p in pieces:
        if len(p) < 2:
            continue
        rel = p / p.iloc[0]
        scaled = rel * level
        out.append(scaled)
        level = float(scaled.iloc[-1])
    if not out:
        return pd.Series(dtype=float)
    return pd.concat(out).sort_index()


def holdout_split(df: pd.DataFrame, holdout_frac: float = 0.20) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Chronological split. The holdout is touched exactly once, at the end.

    If you look at holdout results and then change anything, it is no longer a
    holdout -- it has become part of your training set through you. There is no
    technical enforcement of this; it is on you.
    """
    cut = int(len(df) * (1 - holdout_frac))
    return df.iloc[:cut], df.iloc[cut:]
