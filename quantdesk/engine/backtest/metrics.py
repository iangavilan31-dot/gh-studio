"""Performance metrics, including the ones that tell you when you are fooling
yourself.

Most retail backtest reports show CAGR, win rate and max drawdown. Those are
the three numbers easiest to make look good by accident. The metrics that
matter for deciding whether an edge is real are further down this file:
Probabilistic Sharpe, Deflated Sharpe, and the trial count they depend on.

The core idea, from Bailey & Lopez de Prado: if you test 200 strategy
configurations and pick the best, its Sharpe ratio is biased upward by the
selection itself even when every strategy is worthless. The expected maximum
Sharpe from N independent worthless strategies grows roughly with
sqrt(2 log N). The Deflated Sharpe Ratio subtracts that expectation and asks
whether what remains is still significant. It very often is not, and finding
that out here is enormously cheaper than finding it out with money.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats

# Bars per year by timeframe, used to annualise.
BARS_PER_YEAR = {
    "1m": 525_600, "3m": 175_200, "5m": 105_120, "15m": 35_040,
    "30m": 17_520, "1h": 8_760, "2h": 4_380, "4h": 2_190,
    "6h": 1_460, "12h": 730, "1d": 365,
}


@dataclass
class Metrics:
    n_trades: int = 0
    total_return: float = 0.0
    cagr: float = 0.0
    sharpe: float = 0.0
    sortino: float = 0.0
    calmar: float = 0.0
    max_drawdown: float = 0.0
    max_dd_duration_bars: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy_r: float = 0.0
    avg_win_r: float = 0.0
    avg_loss_r: float = 0.0
    payoff_ratio: float = 0.0
    kelly_fraction: float = 0.0
    exposure: float = 0.0
    turnover_annual: float = 0.0
    total_fees: float = 0.0
    fees_pct_of_gross: float = 0.0
    avg_bars_held: float = 0.0
    skew: float = 0.0
    kurtosis: float = 0.0
    var_95: float = 0.0
    cvar_95: float = 0.0
    ulcer_index: float = 0.0
    psr: float = 0.0                    # Probabilistic Sharpe Ratio
    deflated_sharpe: float = 0.0
    n_trials: int = 1
    longest_losing_streak: int = 0
    tail_ratio: float = 0.0

    def to_dict(self) -> dict:
        return {k: (None if isinstance(v, float) and not np.isfinite(v) else v)
                for k, v in asdict(self).items()}


def _drawdown(equity: pd.Series) -> tuple[pd.Series, float, int]:
    peak = equity.cummax()
    dd = equity / peak - 1.0
    max_dd = float(dd.min()) if len(dd) else 0.0

    # Longest stretch spent below a prior peak.
    under = (equity < peak).to_numpy()
    longest = cur = 0
    for u in under:
        cur = cur + 1 if u else 0
        longest = max(longest, cur)
    return dd, abs(max_dd), int(longest)


def probabilistic_sharpe(sr: float, n: int, skew: float, kurt: float,
                         benchmark_sr: float = 0.0) -> float:
    """P(true Sharpe > benchmark), adjusting for non-normal returns.

    Trading returns are negatively skewed and fat-tailed, which makes the naive
    Sharpe overstate significance. This corrects for both.
    """
    if n < 3 or not np.isfinite(sr):
        return 0.0
    denom = 1.0 - skew * sr + ((kurt - 1.0) / 4.0) * sr ** 2
    if denom <= 0:
        return 0.0
    z = (sr - benchmark_sr) * np.sqrt(n - 1) / np.sqrt(denom)
    return float(stats.norm.cdf(z))


def deflated_sharpe(sr: float, n: int, skew: float, kurt: float,
                    n_trials: int, sr_variance: float | None = None) -> float:
    """Deflated Sharpe Ratio (Bailey & Lopez de Prado, 2014).

    Deflates the observed Sharpe by the expected maximum Sharpe achievable by
    chance across `n_trials` independent trials, then returns the probability
    that the remainder is real.

    Read the output like a p-value complement: below ~0.95 means the result is
    not distinguishable from the best of N coin flips. This is the single most
    useful number in the entire report, and it is the one that will most often
    tell you no.
    """
    if n_trials < 1 or n < 3 or not np.isfinite(sr):
        return 0.0
    if n_trials == 1:
        return probabilistic_sharpe(sr, n, skew, kurt, 0.0)

    v = sr_variance if sr_variance is not None else 1.0 / max(n - 1, 1)
    sigma = np.sqrt(max(v, 1e-12))

    # Expected maximum of N standard normals.
    euler = 0.5772156649
    e_max = (1 - euler) * stats.norm.ppf(1 - 1.0 / n_trials) + \
        euler * stats.norm.ppf(1 - 1.0 / (n_trials * np.e))
    sr0 = sigma * e_max
    return probabilistic_sharpe(sr, n, skew, kurt, sr0)


def compute(
    equity: pd.Series,
    trades: List,
    timeframe: str = "1h",
    starting_equity: float = 500.0,
    exposure: Optional[pd.Series] = None,
    n_trials: int = 1,
) -> Metrics:
    m = Metrics(n_trials=max(1, int(n_trials)))
    if equity is None or len(equity) < 2:
        return m

    ppy = BARS_PER_YEAR.get(timeframe, 8_760)
    rets = equity.pct_change().dropna()
    m.n_trades = len(trades)
    m.total_return = float(equity.iloc[-1] / starting_equity - 1.0)

    years = len(equity) / ppy
    if years > 0 and equity.iloc[-1] > 0:
        m.cagr = float((equity.iloc[-1] / starting_equity) ** (1 / years) - 1.0)

    if len(rets) > 2 and rets.std() > 0:
        m.sharpe = float(rets.mean() / rets.std() * np.sqrt(ppy))
        downside = rets[rets < 0]
        if len(downside) > 1 and downside.std() > 0:
            m.sortino = float(rets.mean() / downside.std() * np.sqrt(ppy))
        m.skew = float(stats.skew(rets))
        m.kurtosis = float(stats.kurtosis(rets, fisher=False))
        m.var_95 = float(np.percentile(rets, 5))
        tail = rets[rets <= m.var_95]
        m.cvar_95 = float(tail.mean()) if len(tail) else 0.0

        p95, p5 = np.percentile(rets, 95), np.percentile(rets, 5)
        m.tail_ratio = float(abs(p95 / p5)) if p5 != 0 else 0.0

        # Sharpe here is annualised; PSR/DSR need the per-observation Sharpe.
        sr_per_bar = m.sharpe / np.sqrt(ppy)
        m.psr = probabilistic_sharpe(sr_per_bar, len(rets), m.skew, m.kurtosis)
        m.deflated_sharpe = deflated_sharpe(
            sr_per_bar, len(rets), m.skew, m.kurtosis, m.n_trials
        )

    dd, max_dd, dd_dur = _drawdown(equity)
    m.max_drawdown = max_dd
    m.max_dd_duration_bars = dd_dur
    m.calmar = float(m.cagr / max_dd) if max_dd > 1e-9 else 0.0
    m.ulcer_index = float(np.sqrt((dd ** 2).mean())) if len(dd) else 0.0

    if exposure is not None and len(exposure):
        m.exposure = float((exposure.abs() > 0).mean())

    if trades:
        pnls = np.array([t.pnl for t in trades], dtype=float)
        rs = np.array([t.pnl_r for t in trades], dtype=float)
        wins, losses = pnls[pnls > 0], pnls[pnls <= 0]

        m.win_rate = float(len(wins) / len(pnls))
        gross_win, gross_loss = float(wins.sum()), float(abs(losses.sum()))
        m.profit_factor = gross_win / gross_loss if gross_loss > 1e-9 else float("inf")
        m.expectancy_r = float(rs.mean())
        m.avg_win_r = float(rs[rs > 0].mean()) if (rs > 0).any() else 0.0
        m.avg_loss_r = float(rs[rs <= 0].mean()) if (rs <= 0).any() else 0.0
        m.payoff_ratio = abs(m.avg_win_r / m.avg_loss_r) if m.avg_loss_r != 0 else 0.0

        # Kelly on the R distribution. Reported, deliberately not acted on --
        # full Kelly on an estimated edge is a fast route to ruin, and the
        # estimate is always worse than you think.
        if m.payoff_ratio > 0:
            w, b = m.win_rate, m.payoff_ratio
            m.kelly_fraction = float(max(0.0, w - (1 - w) / b))

        m.total_fees = float(sum(t.fees for t in trades))
        gross_pnl = float(sum(t.pnl for t in trades)) + m.total_fees
        m.fees_pct_of_gross = float(m.total_fees / abs(gross_pnl)) if abs(gross_pnl) > 1e-9 else 0.0
        m.avg_bars_held = float(np.mean([t.bars_held for t in trades]))

        streak = worst = 0
        for p in pnls:
            streak = streak + 1 if p <= 0 else 0
            worst = max(worst, streak)
        m.longest_losing_streak = int(worst)

        if years > 0:
            notional = float(sum(abs(t.entry_price * t.qty) for t in trades))
            m.turnover_annual = float(notional / starting_equity / years)

    return m


def summarize(results: Dict[str, Metrics]) -> pd.DataFrame:
    if not results:
        return pd.DataFrame()
    return pd.DataFrame({k: v.to_dict() for k, v in results.items()}).T


def verdict(m: Metrics) -> tuple[str, str]:
    """Blunt one-line judgement. Used by the dashboard and the CLI report.

    The thresholds are intentionally harsh. The literature's own guidance is
    that a t-statistic near 3 -- not the conventional 2 -- is the bar for
    claiming a real edge once multiple testing is accounted for.
    """
    if m.n_trades < 30:
        return "INSUFFICIENT", f"only {m.n_trades} trades; not enough to conclude anything"
    if m.deflated_sharpe < 0.90:
        return "LIKELY NOISE", (
            f"deflated Sharpe {m.deflated_sharpe:.2f} across {m.n_trials} trials -- "
            "indistinguishable from the best of N random strategies"
        )
    if m.profit_factor < 1.1:
        return "NO EDGE", f"profit factor {m.profit_factor:.2f} after costs"
    if m.expectancy_r < 0.05:
        return "MARGINAL", f"expectancy {m.expectancy_r:.3f}R barely covers execution risk"
    if m.max_drawdown > 0.35:
        return "TOO RISKY", f"max drawdown {m.max_drawdown:.0%} would likely end the account"
    if m.fees_pct_of_gross > 0.5:
        return "FEE BOUND", f"fees consume {m.fees_pct_of_gross:.0%} of gross profit"
    return "CANDIDATE", (
        f"DSR {m.deflated_sharpe:.2f}, PF {m.profit_factor:.2f}, "
        f"expectancy {m.expectancy_r:.2f}R -- worth paper trading"
    )
