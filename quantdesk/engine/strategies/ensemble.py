"""Ensemble / voting strategies.

Combining weakly-correlated signals is the one reliable way to improve
risk-adjusted returns without finding a new edge. If you have k strategies with
the same Sharpe and average pairwise correlation p, the ensemble Sharpe is
multiplied by sqrt(k / (1 + (k-1)p)). At p = 0.2 and k = 5 that is roughly a
1.7x improvement -- for free, from strategies you already have.

The catch is that the improvement is entirely in the "weakly correlated" clause.
Five trend-following strategies are one strategy wearing five hats, and
averaging them buys you nothing but extra fees. The correlation penalty in
`DiversifiedVote` is there to make that visible rather than letting you assume
diversification you do not have.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .base import Context, ParamSpec, Strategy, all_strategies, get, register


class _Combiner(Strategy):
    """Shared plumbing for strategies that aggregate other strategies."""

    def _members(self) -> list[Strategy]:
        names = [n.strip() for n in str(self.p["members"]).split(",") if n.strip()]
        out = []
        for n in names:
            try:
                out.append(get(n)())
            except KeyError:
                continue
        return out

    def _member_signals(self, df: pd.DataFrame, ctx: Context) -> pd.DataFrame:
        cols = {}
        for m in self._members():
            try:
                cols[m.name] = m.generate(df, ctx)["signal"]
            except Exception:
                # A member that cannot run on this symbol/timeframe abstains
                # rather than taking the whole ensemble down with it.
                continue
        if not cols:
            return pd.DataFrame(index=df.index)
        return pd.DataFrame(cols, index=df.index)


@register
class MajorityVote(_Combiner):
    name = "majority_vote"
    family = "ensemble"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Take a position only when a supermajority of member strategies agree. "
        "Fewer trades, higher conviction, and materially lower turnover -- which in a "
        "26bps-per-side market is itself a source of return."
    )
    params = (
        ParamSpec("members", "ts_momentum,supertrend,donchian,zscore_reversion,vol_regime"),
        ParamSpec("threshold", 0.60, [0.5, 0.6, 0.75]),
        ParamSpec("min_voters", 3, [2, 3, 4]),
    )

    def _compute(self, df, ctx):
        sigs = self._member_signals(df, ctx)
        if sigs.empty:
            return pd.DataFrame({"signal": 0.0, "reason": "no_members"}, index=df.index)

        voters = sigs.abs().sum(axis=1)
        net = sigs.sum(axis=1)
        agreement = (net / voters.replace(0, np.nan)).fillna(0.0)

        enough = voters >= self.p["min_voters"]
        t = self.p["threshold"]
        sig = pd.Series(0.0, index=df.index)
        sig[enough & (agreement >= t)] = 1.0
        sig[enough & (agreement <= -t)] = -1.0
        return pd.DataFrame(
            {"signal": sig, "strength": agreement.abs().clip(0, 1), "reason": "vote"},
            index=df.index,
        )


@register
class DiversifiedVote(_Combiner):
    name = "diversified_vote"
    family = "ensemble"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Majority vote weighted by how uncorrelated each member is with the rest. "
        "Members that merely echo the consensus get down-weighted, so the ensemble "
        "cannot fool itself into believing five correlated trend strategies constitute "
        "diversification."
    )
    params = (
        ParamSpec("members", "ts_momentum,zscore_reversion,donchian,vwap_reversion,liquidation_cascade"),
        ParamSpec("corr_window", 500, [250, 500, 1000]),
        ParamSpec("threshold", 0.35, [0.25, 0.35, 0.5]),
    )

    def _compute(self, df, ctx):
        sigs = self._member_signals(df, ctx)
        if sigs.shape[1] < 2:
            return pd.DataFrame({"signal": 0.0, "reason": "too_few"}, index=df.index)

        w = self._diversification_weights(sigs, self.p["corr_window"])
        score = (sigs * w).sum(axis=1) / max(w.sum(), 1e-9)

        t = self.p["threshold"]
        sig = pd.Series(0.0, index=df.index)
        sig[score >= t] = 1.0
        sig[score <= -t] = -1.0
        return pd.DataFrame(
            {"signal": sig, "strength": score.abs().clip(0, 1), "reason": "div_vote"},
            index=df.index,
        )

    @staticmethod
    def _diversification_weights(sigs: pd.DataFrame, window: int) -> pd.Series:
        """Weight = 1 - mean absolute correlation with the other members.

        Computed once over the trailing window rather than per-bar. That is a
        deliberate simplification: per-bar rolling correlation across every pair
        is expensive and the weights are not sensitive enough to justify it.
        """
        tail = sigs.tail(window)
        if len(tail) < 30:
            return pd.Series(1.0, index=sigs.columns)
        c = tail.corr().abs().to_numpy(copy=True)
        np.fill_diagonal(c, np.nan)
        # A member whose signal never varies has undefined correlation with
        # everything. Treat that as "uncorrelated" (weight 1.0) rather than
        # letting an all-NaN row emit a warning and fall through to 0.
        with np.errstate(invalid="ignore"):
            valid = ~np.all(np.isnan(c), axis=1)
            means = np.zeros(c.shape[0])
            if valid.any():
                means[valid] = np.nanmean(c[valid], axis=1)
        mean_corr = pd.Series(means, index=tail.columns).fillna(0.0)
        return (1.0 - mean_corr).clip(0.1, 1.0)


@register
class RegimeRouter(_Combiner):
    name = "regime_router"
    family = "ensemble"
    timeframes = ("15m", "1h")
    description = (
        "Route to a trend strategy when the efficiency ratio says the market is "
        "trending and to a reversion strategy when it says the market is choppy. "
        "Rather than blending incompatible logics into mush, this picks one. Encodes "
        "the single most important structural fact in intraday crypto: the correct "
        "strategy is a function of regime, not of preference."
    )
    params = (
        ParamSpec("trend_member", "supertrend"),
        ParamSpec("revert_member", "zscore_reversion"),
        ParamSpec("er_window", 20, [14, 20, 34]),
        ParamSpec("er_split", 0.35, [0.25, 0.35, 0.45]),
    )

    def _compute(self, df, ctx):
        from .. import indicators as ta

        er = ta.efficiency_ratio(df["close"], self.p["er_window"])
        trending = er >= self.p["er_split"]

        try:
            t_sig = get(self.p["trend_member"])().generate(df, ctx)["signal"]
            r_sig = get(self.p["revert_member"])().generate(df, ctx)["signal"]
        except KeyError:
            return pd.DataFrame({"signal": 0.0, "reason": "bad_member"}, index=df.index)

        sig = t_sig.where(trending, r_sig)
        reason = pd.Series("revert", index=df.index)
        reason[trending] = "trend"
        return pd.DataFrame({"signal": sig, "reason": reason}, index=df.index)
