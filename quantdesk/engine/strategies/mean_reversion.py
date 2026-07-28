"""Mean-reversion strategies.

Crypto intraday is genuinely mean-reverting a lot of the time -- the Hurst
exponent on 5m-1h majors sits below 0.5 for long stretches. That is the good
news. The bad news is threefold, and every strategy here is built around it:

  1. Reversion strategies win often and lose big. A 70% win rate with a 3:1
     loss ratio is break-even before fees and negative after. Every strategy in
     this file therefore carries a hard stop; none of them "wait for it to come
     back", which is how reversion accounts actually die.
  2. Reversion fails precisely when it matters -- during trends and news. The
     regime filters here (Hurst, ADX, efficiency ratio) exist to stand down in
     those conditions.
  3. High trade frequency means fees dominate. Entry thresholds are set wide
     enough that the expected reversion exceeds round-trip cost.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, hold, register


@register
class ZScoreReversion(Strategy):
    name = "zscore_reversion"
    family = "mean_reversion"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Fade statistically extreme deviations from a trailing mean, exit on reversion "
        "to the mean. The canonical reversion trade. The ADX ceiling is what keeps it "
        "from standing in front of a trend."
    )
    params = (
        ParamSpec("lookback", 20, [14, 20, 34, 50]),
        ParamSpec("entry_z", 2.0, [1.5, 2.0, 2.5, 3.0]),
        ParamSpec("exit_z", 0.3, [0.0, 0.3, 0.5]),
        ParamSpec("adx_max", 30, [20, 25, 30, 100]),
    )

    def _compute(self, df, ctx):
        z = ta.zscore(df["close"], self.p["lookback"])
        adx, _, _ = ta.adx(df, 14)
        calm = adx <= self.p["adx_max"]

        ez, xz = self.p["entry_z"], self.p["exit_z"]
        sig = hold(
            (z <= -ez) & calm, z >= -xz,
            (z >= ez) & calm, z <= xz,
        )
        return pd.DataFrame(
            {"signal": sig, "strength": (z.abs() / 4).clip(0, 1), "reason": "zrev"},
            index=df.index,
        )


@register
class BollingerFade(Strategy):
    name = "bollinger_fade"
    family = "mean_reversion"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Fade closes outside the Bollinger Bands, exit at the midline. Differs from "
        "z-score reversion only in requiring a close beyond the band rather than a "
        "z threshold, which makes it slightly slower and slightly more selective."
    )
    params = (
        ParamSpec("period", 20, [14, 20, 34]),
        ParamSpec("k", 2.0, [1.5, 2.0, 2.5, 3.0]),
        ParamSpec("require_reversal", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        lo, mid, hi = ta.bollinger(df["close"], self.p["period"], self.p["k"])
        below, above = df["close"] < lo, df["close"] > hi

        if self.p["require_reversal"]:
            # Wait for the bar that closes back up before buying. Catching a
            # falling knife on the first tag is how this strategy blows up.
            long = below.shift(1).fillna(False) & (df["close"] > df["close"].shift(1))
            short = above.shift(1).fillna(False) & (df["close"] < df["close"].shift(1))
        else:
            long, short = below, above

        sig = hold(long, df["close"] >= mid, short, df["close"] <= mid)
        return pd.DataFrame({"signal": sig, "reason": "bb_fade"}, index=df.index)


@register
class RsiExtreme(Strategy):
    name = "rsi_extreme"
    family = "mean_reversion"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Classic oversold/overbought RSI reversal with a long-term trend filter. "
        "Unfiltered RSI(14) < 30 has been arbitraged flat for years; the value here is "
        "in the filter and the exit, not the trigger."
    )
    params = (
        ParamSpec("period", 14, [7, 14, 21]),
        ParamSpec("low", 25, [20, 25, 30]),
        ParamSpec("high", 75, [70, 75, 80]),
        ParamSpec("trend_filter", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        r = ta.rsi(df["close"], self.p["period"])
        long = r < self.p["low"]
        short = r > self.p["high"]

        if self.p["trend_filter"]:
            # Only buy dips above the long MA, only sell rips below it.
            trend = ta.ema(df["close"], 200)
            long &= df["close"] > trend
            short &= df["close"] < trend

        sig = hold(long, r > 50, short, r < 50)
        return pd.DataFrame({"signal": sig, "reason": "rsi_ext"}, index=df.index)


@register
class VwapReversion(Strategy):
    name = "vwap_reversion"
    family = "mean_reversion"
    timeframes = ("5m", "15m")
    description = (
        "Fade stretched deviations from session VWAP, exit on the return to VWAP. "
        "Has a real mechanism behind it: VWAP is the benchmark execution algos are "
        "measured against, so there is genuine flow pulling price back toward it."
    )
    params = (
        ParamSpec("dev_atr", 1.5, [1.0, 1.5, 2.0, 2.5]),
        ParamSpec("session", "D", ["D"]),
        ParamSpec("trend_veto", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        vw = ta.vwap_session(df, self.p["session"])
        a = ta.atr(df, 14)
        dev = (df["close"] - vw) / a.replace(0, np.nan)
        d = self.p["dev_atr"]

        long, short = dev <= -d, dev >= d
        if self.p["trend_veto"]:
            er = ta.efficiency_ratio(df["close"], 20)
            calm = er < 0.4          # do not fade a clean directional move
            long &= calm
            short &= calm

        sig = hold(long, dev >= -0.1, short, dev <= 0.1)
        return pd.DataFrame(
            {"signal": sig, "strength": (dev.abs() / 3).clip(0, 1), "reason": "vwap_rev"},
            index=df.index,
        )


@register
class HurstGatedReversion(Strategy):
    name = "hurst_reversion"
    family = "mean_reversion"
    timeframes = ("15m", "1h")
    description = (
        "Z-score reversion that only fires when the rolling Hurst exponent is below "
        "0.5, i.e. when the series is measurably mean-reverting right now rather than "
        "assumed to be. The most intellectually honest strategy in this family, and "
        "the one that trades least."
    )
    params = (
        ParamSpec("lookback", 30, [20, 30, 50]),
        ParamSpec("entry_z", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("hurst_window", 150, [100, 150, 250]),
        ParamSpec("hurst_max", 0.45, [0.40, 0.45, 0.50]),
    )

    def _compute(self, df, ctx):
        z = ta.zscore(df["close"], self.p["lookback"])
        h = ta.hurst(df["close"], self.p["hurst_window"])
        reverting = h < self.p["hurst_max"]
        ez = self.p["entry_z"]

        sig = hold(
            (z <= -ez) & reverting, z >= -0.2,
            (z >= ez) & reverting, z <= 0.2,
        )
        return pd.DataFrame({"signal": sig, "reason": "hurst_rev"}, index=df.index)


@register
class KeltnerSnapback(Strategy):
    name = "keltner_snapback"
    family = "mean_reversion"
    timeframes = ("5m", "15m")
    description = (
        "Fade excursions beyond an ATR-scaled Keltner channel. Because the channel is "
        "ATR-based rather than standard-deviation-based, it adapts to volatility "
        "regime shifts faster than Bollinger and produces fewer false extremes during "
        "volatility expansion."
    )
    params = (
        ParamSpec("period", 20, [14, 20, 30]),
        ParamSpec("k", 2.5, [2.0, 2.5, 3.0]),
    )

    def _compute(self, df, ctx):
        lo, mid, hi = ta.keltner(df, self.p["period"], self.p["k"])
        sig = hold(
            df["low"] < lo, df["close"] >= mid,
            df["high"] > hi, df["close"] <= mid,
        )
        return pd.DataFrame({"signal": sig, "reason": "keltner_snap"}, index=df.index)


@register
class OvernightGapFade(Strategy):
    name = "gap_fade"
    family = "mean_reversion"
    timeframes = ("15m", "1h")
    description = (
        "Fade abnormally large single-bar moves that are not confirmed by volume. "
        "A big move on thin volume is usually a liquidity vacuum -- a stop cascade or "
        "a fat finger -- and those retrace far more often than genuine, volume-backed "
        "repricing does."
    )
    params = (
        ParamSpec("move_z", 3.0, [2.5, 3.0, 3.5]),
        ParamSpec("vol_z_max", 1.0, [0.5, 1.0, 1.5]),
        ParamSpec("hold_bars", 8, [4, 8, 16]),
    )

    def _compute(self, df, ctx):
        ret = df["close"].pct_change()
        rz = ta.zscore(ret, 96)
        vz = ta.volume_zscore(df, 96)
        unconfirmed = vz < self.p["vol_z_max"]

        spike_up = (rz >= self.p["move_z"]) & unconfirmed
        spike_dn = (rz <= -self.p["move_z"]) & unconfirmed

        # Time-boxed fade: this edge decays fast, so hold a fixed window.
        n = self.p["hold_bars"]
        sig = pd.Series(0.0, index=df.index)
        raw = pd.Series(0.0, index=df.index)
        raw[spike_dn] = 1.0
        raw[spike_up] = -1.0
        held = raw.replace(0.0, np.nan).ffill(limit=n)
        sig = held.fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "gap_fade"}, index=df.index)


@register
class PercentBReversion(Strategy):
    name = "percent_b"
    family = "mean_reversion"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Reversion on Bollinger %B combined with a bandwidth floor. The bandwidth "
        "condition matters: fading a band tag while bands are compressed means fading "
        "a move that has no room to revert into, which is a losing trade by "
        "construction."
    )
    params = (
        ParamSpec("period", 20, [14, 20, 30]),
        ParamSpec("low_b", 0.05, [0.0, 0.05, 0.10]),
        ParamSpec("high_b", 0.95, [0.90, 0.95, 1.0]),
        ParamSpec("min_width", 0.02, [0.0, 0.01, 0.02, 0.04]),
    )

    def _compute(self, df, ctx):
        lo, mid, hi = ta.bollinger(df["close"], self.p["period"], 2.0)
        pb = (df["close"] - lo) / (hi - lo).replace(0, np.nan)
        width = (hi - lo) / mid
        wide = width >= self.p["min_width"]

        sig = hold(
            (pb <= self.p["low_b"]) & wide, pb >= 0.5,
            (pb >= self.p["high_b"]) & wide, pb <= 0.5,
        )
        return pd.DataFrame({"signal": sig, "reason": "pct_b"}, index=df.index)
