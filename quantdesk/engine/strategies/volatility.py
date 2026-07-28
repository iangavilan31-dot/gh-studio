"""Volatility-regime strategies.

These do not predict direction. They trade the one property of financial time
series that is genuinely, reliably forecastable: volatility clustering. Big
moves follow big moves, quiet follows quiet, and the autocorrelation of
absolute returns is strongly positive at every horizon anyone has tested.

Because direction is not forecast, these are mostly used two ways: as regime
filters that switch other strategies on and off, and as size modulators. A
strategy that halves its size when realised vol doubles has materially better
risk-adjusted returns than the same strategy at constant size -- volatility
targeting is close to free Sharpe, and it is the single highest-value idea in
this file.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, hold, register


@register
class VolRegimeFilter(Strategy):
    name = "vol_regime"
    family = "volatility"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Trade the prevailing trend, but only while realised volatility sits in a "
        "workable band. Too quiet and moves do not cover costs; too wild and stops get "
        "hit by noise before the thesis resolves. Both tails are unprofitable for "
        "different reasons."
    )
    params = (
        ParamSpec("vol_window", 48, [24, 48, 96]),
        ParamSpec("lo_pct", 0.25, [0.1, 0.25, 0.4]),
        ParamSpec("hi_pct", 0.90, [0.8, 0.9, 0.95]),
        ParamSpec("trend_ema", 100, [50, 100, 200]),
    )

    def _compute(self, df, ctx):
        nv = ta.natr(df, 14)
        rank = nv.rolling(self.p["vol_window"] * 8, min_periods=self.p["vol_window"]).rank(pct=True)
        ok = (rank >= self.p["lo_pct"]) & (rank <= self.p["hi_pct"])
        trend = np.sign(df["close"] - ta.ema(df["close"], self.p["trend_ema"]))
        sig = trend.where(ok, 0.0)
        return pd.DataFrame(
            {"signal": sig, "strength": (1 - rank).clip(0, 1), "reason": "vol_regime"},
            index=df.index,
        )


@register
class VolTargetTrend(Strategy):
    name = "vol_target_trend"
    family = "volatility"
    timeframes = ("1h", "4h")
    description = (
        "Time-series momentum with inverse-volatility position scaling. Size is cut "
        "when volatility rises and raised when it falls, holding risk contribution "
        "roughly constant. The most reliable Sharpe improvement in this codebase and "
        "the one technique here used by essentially every real systematic fund."
    )
    params = (
        ParamSpec("lookback", 96, [48, 96, 192]),
        ParamSpec("vol_window", 48, [24, 48, 96]),
        ParamSpec("target_vol", 0.60, [0.4, 0.6, 0.8]),
    )

    def _compute(self, df, ctx):
        ret = df["close"] / df["close"].shift(self.p["lookback"]) - 1.0
        sig = np.sign(ret)

        rv = ta.realised_vol(df["close"], self.p["vol_window"])
        scale = (self.p["target_vol"] / rv.replace(0, np.nan)).clip(0.1, 1.0)
        return pd.DataFrame(
            {"signal": sig, "strength": scale.fillna(0.3), "reason": "vol_target"},
            index=df.index,
        )


@register
class AtrCompressionExpansion(Strategy):
    name = "atr_expansion"
    family = "volatility"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Detect ATR contraction to a percentile floor, then trade the direction of the "
        "first expansion bar. A direct play on volatility clustering: the compression "
        "is the forecastable part, the expansion bar supplies the direction."
    )
    params = (
        ParamSpec("compress_pct", 0.20, [0.1, 0.2, 0.3]),
        ParamSpec("expand_mult", 1.8, [1.5, 1.8, 2.2]),
        ParamSpec("hold_bars", 12, [6, 12, 24]),
    )

    def _compute(self, df, ctx):
        a = ta.atr(df, 14)
        rank = a.rolling(384, min_periods=96).rank(pct=True)
        compressed = rank.shift(1) <= self.p["compress_pct"]
        tr = ta.true_range(df)
        expanding = tr > self.p["expand_mult"] * a.shift(1)

        fire = compressed & expanding
        direction = np.sign(df["close"] - df["open"])

        raw = pd.Series(np.nan, index=df.index)
        raw[fire] = direction[fire]
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "atr_expand"}, index=df.index)


@register
class ParkinsonRegimeSwitch(Strategy):
    name = "regime_switch"
    family = "volatility"
    timeframes = ("15m", "1h")
    description = (
        "Explicit two-regime switch: run breakout logic in high-volatility regimes and "
        "reversion logic in low-volatility ones. Encodes the most useful structural "
        "fact about intraday crypto -- that the same market is trending and "
        "mean-reverting at different times, and the mistake is applying one rule to "
        "both."
    )
    params = (
        ParamSpec("vol_window", 30, [20, 30, 50]),
        ParamSpec("split_pct", 0.60, [0.5, 0.6, 0.7]),
        ParamSpec("z_entry", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("breakout_n", 34, [20, 34, 55]),
    )

    def _compute(self, df, ctx):
        pv = ta.parkinson_vol(df, self.p["vol_window"])
        rank = pv.rolling(384, min_periods=96).rank(pct=True)
        high_vol = rank > self.p["split_pct"]

        lo, hi = ta.donchian(df, self.p["breakout_n"])
        bo = pd.Series(0.0, index=df.index)
        bo[df["close"] > hi] = 1.0
        bo[df["close"] < lo] = -1.0

        z = ta.zscore(df["close"], 20)
        rev = pd.Series(0.0, index=df.index)
        rev[z <= -self.p["z_entry"]] = 1.0
        rev[z >= self.p["z_entry"]] = -1.0

        sig = bo.where(high_vol, rev)
        return pd.DataFrame({"signal": sig, "reason": "regime_switch"}, index=df.index)


@register
class VolOfVolCaution(Strategy):
    name = "vol_of_vol"
    family = "volatility"
    timeframes = ("15m", "1h")
    description = (
        "Trend following that stands down when the volatility of volatility spikes. "
        "Unstable volatility means the ATR your stop is sized from is itself unreliable, "
        "so risk control degrades exactly when you need it. Standing aside there is a "
        "risk decision more than a return one."
    )
    params = (
        ParamSpec("trend_ema", 55, [34, 55, 89]),
        ParamSpec("vov_window", 48, [24, 48]),
        ParamSpec("vov_max_pct", 0.85, [0.75, 0.85, 0.95]),
    )

    def _compute(self, df, ctx):
        nv = ta.natr(df, 14)
        vov = nv.rolling(self.p["vov_window"], min_periods=self.p["vov_window"]).std()
        rank = vov.rolling(384, min_periods=96).rank(pct=True)
        calm = rank <= self.p["vov_max_pct"]

        trend = np.sign(df["close"] - ta.ema(df["close"], self.p["trend_ema"]))
        return pd.DataFrame(
            {"signal": trend.where(calm, 0.0), "reason": "vov"}, index=df.index
        )
