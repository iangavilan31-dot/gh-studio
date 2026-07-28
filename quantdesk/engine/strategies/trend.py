"""Trend / momentum strategies.

This is the family with the strongest published evidence in crypto. Time-series
momentum in particular replicates across the academic literature with Sharpe
ratios in the 0.5-1.5 range on daily-to-weekly horizons, and it survives the
usual robustness checks better than anything else here.

The catch, and it is a large one: those results are mostly measured on daily
bars with monthly rebalancing and negligible turnover. Compressed onto 15m bars
the same logic trades ~50x more often, and at 26bps taker each way that turnover
is a headwind of several hundred percent a year. The backtester applies the full
cost model precisely so you can watch that happen rather than discover it live.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, cross_over, cross_under, hold, register


@register
class EmaCross(Strategy):
    name = "ema_cross"
    family = "trend"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Fast EMA over slow EMA, gated by ADX so it stands aside in chop. "
        "The oldest idea in the book; the ADX gate is what makes it survivable, "
        "because an unfiltered MA cross bleeds to death in ranging markets."
    )
    params = (
        ParamSpec("fast", 21, [9, 12, 21, 34]),
        ParamSpec("slow", 55, [50, 55, 89, 144]),
        ParamSpec("adx_min", 20, [0, 15, 20, 25]),
    )

    def _compute(self, df, ctx):
        f = ta.ema(df["close"], self.p["fast"])
        s = ta.ema(df["close"], self.p["slow"])
        adx, _, _ = ta.adx(df, 14)
        trending = adx >= self.p["adx_min"]

        sig = hold(
            cross_over(f, s) & trending, cross_under(f, s),
            cross_under(f, s) & trending, cross_over(f, s),
        )
        return pd.DataFrame(
            {"signal": sig, "strength": (adx / 50).clip(0, 1), "reason": "ema_cross"},
            index=df.index,
        )


@register
class TimeSeriesMomentum(Strategy):
    name = "ts_momentum"
    family = "trend"
    timeframes = ("1h", "4h")
    description = (
        "Pure time-series momentum: long if the trailing N-bar return is positive, "
        "short if negative. This is the strategy with the best academic pedigree in "
        "crypto (Sharpe ~1.5 at 28d/5d in the literature). Deliberately simple -- "
        "its edge comes from having almost nothing to overfit."
    )
    params = (
        ParamSpec("lookback", 96, [48, 96, 168, 336]),
        ParamSpec("vol_target", 0, [0, 1]),   # 1 = scale size by inverse vol
        ParamSpec("min_move_atr", 0.5, [0.0, 0.5, 1.0]),
    )

    def _compute(self, df, ctx):
        n = self.p["lookback"]
        ret = df["close"] / df["close"].shift(n) - 1.0
        a = ta.atr(df, 14) / df["close"]
        # Require the move to be large relative to noise, otherwise the sign of
        # a tiny return is coin-flip and you pay fees to flip the coin.
        move = ret.abs() / (a * np.sqrt(n)).replace(0, np.nan)
        sig = np.sign(ret).where(move >= self.p["min_move_atr"], 0.0)

        strength = pd.Series(1.0, index=df.index)
        if self.p["vol_target"]:
            inv = (a.rolling(96, min_periods=96).median() / a).clip(0.2, 2.0)
            strength = (inv / 2.0).clip(0, 1)

        return pd.DataFrame(
            {"signal": sig, "strength": strength, "reason": "tsmom"}, index=df.index
        )


@register
class SupertrendFollow(Strategy):
    name = "supertrend"
    family = "trend"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Always-in ATR band regime follower. Flips only when price closes beyond a "
        "ratcheting volatility band, which makes it far stickier than an MA cross "
        "and cuts turnover -- the main reason it can clear crypto fees."
    )
    params = (
        ParamSpec("period", 10, [7, 10, 14, 21]),
        ParamSpec("mult", 3.0, [2.0, 2.5, 3.0, 4.0]),
    )

    def _compute(self, df, ctx):
        st = ta.supertrend(df, self.p["period"], self.p["mult"])
        return pd.DataFrame({"signal": st, "reason": "supertrend"}, index=df.index)


@register
class MacdTrend(Strategy):
    name = "macd_trend"
    family = "trend"
    timeframes = ("15m", "1h", "4h")
    description = (
        "MACD histogram sign, filtered by a long-horizon regime EMA so it only takes "
        "signals aligned with the dominant trend. Counter-trend MACD signals are where "
        "this indicator earns its bad reputation."
    )
    params = (
        ParamSpec("fast", 12, [8, 12, 16]),
        ParamSpec("slow", 26, [21, 26, 34]),
        ParamSpec("signal", 9, [7, 9, 12]),
        ParamSpec("regime", 200, [0, 100, 200]),
    )

    def _compute(self, df, ctx):
        line, sigl, histo = ta.macd(df["close"], self.p["fast"], self.p["slow"], self.p["signal"])
        raw = np.sign(histo)
        if self.p["regime"]:
            reg = np.sign(df["close"] - ta.ema(df["close"], self.p["regime"]))
            raw = raw.where(raw == reg, 0.0)
        return pd.DataFrame({"signal": raw, "reason": "macd"}, index=df.index)


@register
class KamaTrend(Strategy):
    name = "kama_trend"
    family = "trend"
    timeframes = ("15m", "1h")
    description = (
        "Price vs Kaufman adaptive MA, entered only when the efficiency ratio says the "
        "market is actually trending. Adaptive smoothing plus a chop filter is the "
        "cheapest known fix for whipsaw."
    )
    params = (
        ParamSpec("period", 20, [10, 20, 30]),
        ParamSpec("er_min", 0.30, [0.2, 0.3, 0.4]),
    )

    def _compute(self, df, ctx):
        k = ta.kama(df["close"], self.p["period"])
        er = ta.efficiency_ratio(df["close"], self.p["period"])
        ok = er >= self.p["er_min"]
        sig = np.sign(df["close"] - k).where(ok, 0.0)
        return pd.DataFrame(
            {"signal": sig, "strength": er.clip(0, 1), "reason": "kama"}, index=df.index
        )


@register
class DualMomentum(Strategy):
    name = "dual_momentum"
    family = "trend"
    timeframes = ("1h", "4h")
    description = (
        "Absolute momentum (is the asset rising?) AND relative momentum (is it beating "
        "the benchmark?). Requiring both is what separates dual momentum from naive "
        "trend following -- it keeps you out of assets rising only because the whole "
        "market is, which is where correlated drawdowns come from."
    )
    params = (
        ParamSpec("lookback", 168, [72, 168, 336]),
        ParamSpec("long_only", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        n = self.p["lookback"]
        own = df["close"] / df["close"].shift(n) - 1.0
        rel = own
        if ctx.benchmark is not None and len(ctx.benchmark):
            b = ctx.benchmark["close"].reindex(df.index).ffill()
            rel = own - (b / b.shift(n) - 1.0)

        long = (own > 0) & (rel > 0)
        short = (own < 0) & (rel < 0)
        sig = pd.Series(0.0, index=df.index)
        sig[long] = 1.0
        if not self.p["long_only"]:
            sig[short] = -1.0
        return pd.DataFrame({"signal": sig, "reason": "dual_mom"}, index=df.index)


@register
class AdxDirectional(Strategy):
    name = "adx_di"
    family = "trend"
    timeframes = ("15m", "1h")
    description = (
        "Directional-index crossover with an ADX strength floor. Trades the moment "
        "trend strength confirms rather than waiting for a price MA to catch up."
    )
    params = (
        ParamSpec("period", 14, [10, 14, 20]),
        ParamSpec("adx_min", 25, [20, 25, 30]),
    )

    def _compute(self, df, ctx):
        adx, pdi, mdi = ta.adx(df, self.p["period"])
        strong = adx >= self.p["adx_min"]
        sig = pd.Series(0.0, index=df.index)
        sig[strong & (pdi > mdi)] = 1.0
        sig[strong & (mdi > pdi)] = -1.0
        return pd.DataFrame(
            {"signal": sig, "strength": (adx / 60).clip(0, 1), "reason": "adx_di"},
            index=df.index,
        )


@register
class HmaSlope(Strategy):
    name = "hma_slope"
    family = "trend"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Hull MA slope sign. Low-lag by construction, so it turns early -- which cuts "
        "both ways: earlier entries, more false turns. Included as the fast end of the "
        "trend family for the cost model to judge against the slow end."
    )
    params = (
        ParamSpec("period", 34, [16, 34, 55]),
        ParamSpec("slope_bars", 2, [1, 2, 3]),
    )

    def _compute(self, df, ctx):
        h = ta.hma(df["close"], self.p["period"])
        slope = h - h.shift(self.p["slope_bars"])
        return pd.DataFrame(
            {"signal": np.sign(slope), "reason": "hma_slope"}, index=df.index
        )


@register
class TripleScreen(Strategy):
    name = "triple_screen"
    family = "trend"
    timeframes = ("15m", "1h")
    description = (
        "Elder's triple screen, adapted: higher-timeframe trend sets the permitted "
        "direction, an oscillator pullback times the entry, and a breakout of the prior "
        "bar confirms. Buying dips only in uptrends is one of the few classical setups "
        "with a defensible reason to work."
    )
    params = (
        ParamSpec("htf_mult", 4, [4, 8]),
        ParamSpec("trend_ema", 50, [34, 50, 89]),
        ParamSpec("rsi_pullback", 45, [40, 45, 50]),
    )

    def _compute(self, df, ctx):
        m = self.p["htf_mult"]
        # Higher-timeframe trend approximated by scaling the EMA period, which
        # avoids resampling and the alignment bugs that come with it.
        htf = ta.ema(df["close"], self.p["trend_ema"] * m)
        up, dn = df["close"] > htf, df["close"] < htf
        r = ta.rsi(df["close"], 14)

        long = up & (r < self.p["rsi_pullback"]) & (df["high"] > df["high"].shift(1))
        short = dn & (r > 100 - self.p["rsi_pullback"]) & (df["low"] < df["low"].shift(1))
        exit_l = df["close"] < htf
        exit_s = df["close"] > htf
        sig = hold(long, exit_l, short, exit_s)
        return pd.DataFrame({"signal": sig, "reason": "triple_screen"}, index=df.index)
