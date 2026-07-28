"""Breakout strategies.

Breakouts are the highest-variance family here: low win rate (often 30-40%),
carried entirely by a small number of large winners. That profile has two
consequences you should internalise before trusting any backtest of them.

First, they need far more trades than reversion strategies before the results
mean anything -- with a 35% win rate, 40 trades tells you almost nothing.
Second, they are the family most damaged by slippage, because by definition you
are buying into a fast move where the book is thinning. The cost model charges
extra slippage as a fraction of ATR for exactly this reason.

The false-breakout problem is real and the standard fix is a confirmation
requirement: volume expansion, a close (not a wick) beyond the level, or a
retest. Each is implemented and parameterised so you can measure what the
confirmation actually costs you in missed moves.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, hold, register


@register
class DonchianBreakout(Strategy):
    name = "donchian"
    family = "breakout"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Turtle-style channel breakout: buy the N-bar high, exit on the M-bar low. "
        "The original systematic trend strategy and still a reasonable baseline. "
        "Asymmetric exit (shorter than the entry channel) is what keeps giveback down."
    )
    params = (
        ParamSpec("entry_n", 55, [20, 34, 55, 100]),
        ParamSpec("exit_n", 20, [10, 20, 34]),
        ParamSpec("vol_confirm", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        _, hi_e = ta.donchian(df, self.p["entry_n"])
        lo_e, _ = ta.donchian(df, self.p["entry_n"])
        lo_x, hi_x = ta.donchian(df, self.p["exit_n"])

        long = df["close"] > hi_e
        short = df["close"] < lo_e
        if self.p["vol_confirm"]:
            vz = ta.volume_zscore(df, 96)
            long &= vz > 0.5
            short &= vz > 0.5

        sig = hold(long, df["close"] < lo_x, short, df["close"] > hi_x)
        return pd.DataFrame({"signal": sig, "reason": "donchian"}, index=df.index)


@register
class OpeningRangeBreakout(Strategy):
    name = "orb"
    family = "breakout"
    timeframes = ("5m", "15m")
    description = (
        "Opening-range breakout adapted to 24/7 crypto by anchoring to the UTC daily "
        "roll, which is where the bulk of derivatives settlement and volume seam sits. "
        "Trades only once per side per session -- the repeated re-entry version of "
        "this strategy is a fee incinerator."
    )
    params = (
        ParamSpec("range_bars", 12, [6, 12, 24]),
        ParamSpec("buffer_atr", 0.25, [0.0, 0.25, 0.5]),
        ParamSpec("flat_at_session_end", 1, [0, 1]),
    )

    def _compute(self, df, ctx):
        day = ta.session_periods(df.index, "D")
        bar_of_day = df.groupby(day).cumcount()
        n = self.p["range_bars"]

        in_range = bar_of_day < n
        # Range high/low frozen once the opening window closes.
        rng_hi = df["high"].where(in_range).groupby(day).cummax().groupby(day).ffill()
        rng_lo = df["low"].where(in_range).groupby(day).cummin().groupby(day).ffill()

        a = ta.atr(df, 14)
        buf = self.p["buffer_atr"] * a
        tradable = ~in_range

        long = tradable & (df["close"] > rng_hi + buf)
        short = tradable & (df["close"] < rng_lo - buf)

        # One shot per side per day.
        first_long = long & ~long.groupby(day).cumsum().shift(1).fillna(0).astype(bool)
        first_short = short & ~short.groupby(day).cumsum().shift(1).fillna(0).astype(bool)

        session_end = bar_of_day >= (df.groupby(day)["close"].transform("size") - 1)
        exit_l = (df["close"] < rng_lo) | (session_end if self.p["flat_at_session_end"] else False)
        exit_s = (df["close"] > rng_hi) | (session_end if self.p["flat_at_session_end"] else False)

        sig = hold(first_long, exit_l, first_short, exit_s)
        return pd.DataFrame({"signal": sig, "reason": "orb"}, index=df.index)


@register
class SqueezeBreakout(Strategy):
    name = "squeeze_breakout"
    family = "breakout"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Trade the expansion out of a volatility squeeze (Bollinger inside Keltner). "
        "Volatility clustering is one of the few genuinely robust facts about financial "
        "time series, so 'compression precedes expansion' has real statistical footing "
        "-- though the squeeze tells you nothing about direction, which is why the "
        "momentum tiebreak is required."
    )
    params = (
        ParamSpec("period", 20, [14, 20, 30]),
        ParamSpec("min_squeeze_bars", 6, [3, 6, 12]),
        ParamSpec("momentum_lookback", 12, [6, 12, 20]),
    )

    def _compute(self, df, ctx):
        sq = ta.squeeze_on(df, self.p["period"]).fillna(False)
        # Count consecutive squeeze bars.
        grp = (~sq).cumsum()
        run = sq.groupby(grp).cumsum()
        primed = (run.shift(1).fillna(0) >= self.p["min_squeeze_bars"]) & (~sq)

        mom = df["close"] - df["close"].rolling(
            self.p["momentum_lookback"], min_periods=self.p["momentum_lookback"]).mean()

        long = primed & (mom > 0)
        short = primed & (mom < 0)
        # Exit when volatility recompresses -- the move is over.
        sig = hold(long, sq, short, sq)
        return pd.DataFrame({"signal": sig, "reason": "squeeze"}, index=df.index)


@register
class VolatilityBreakout(Strategy):
    name = "vol_breakout"
    family = "breakout"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Larry Williams style: enter when price moves more than k x yesterday's range "
        "from the open. Crude, extremely well-studied, and one of the few intraday "
        "breakout rules with published out-of-sample survival across decades and "
        "markets."
    )
    params = (
        ParamSpec("k", 0.6, [0.4, 0.5, 0.6, 0.8]),
        ParamSpec("range_bars", 96, [48, 96, 192]),
        ParamSpec("hold_bars", 24, [12, 24, 48]),
    )

    def _compute(self, df, ctx):
        rng = (df["high"].rolling(self.p["range_bars"], min_periods=self.p["range_bars"]).max()
               - df["low"].rolling(self.p["range_bars"], min_periods=self.p["range_bars"]).min())
        trigger = self.p["k"] * rng.shift(1)
        anchor = df["open"]

        long = df["high"] >= anchor + trigger
        short = df["low"] <= anchor - trigger

        n = self.p["hold_bars"]
        raw = pd.Series(np.nan, index=df.index)
        raw[long] = 1.0
        raw[short & ~long] = -1.0
        sig = raw.ffill(limit=n).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "vol_breakout"}, index=df.index)


@register
class RangeExpansionRetest(Strategy):
    name = "breakout_retest"
    family = "breakout"
    timeframes = ("15m", "1h")
    description = (
        "Break a confirmed swing level, then wait for the retest before entering. "
        "Trades far less than a naive breakout and misses the runaway moves entirely, "
        "but sidesteps most false breaks. Included specifically so the backtest can "
        "settle whether patience beats participation in crypto -- the answer is "
        "regime-dependent."
    )
    params = (
        ParamSpec("pivot_lr", 4, [3, 4, 6]),
        ParamSpec("retest_bars", 10, [5, 10, 20]),
        ParamSpec("retest_atr", 0.5, [0.25, 0.5, 1.0]),
    )

    def _compute(self, df, ctx):
        lr = self.p["pivot_lr"]
        is_high, is_low = ta.swing_points(df, lr, lr)
        # Most recent confirmed pivot levels, carried forward.
        res = df["high"].where(is_high).ffill()
        sup = df["low"].where(is_low).ffill()
        a = ta.atr(df, 14)

        broke_up = (df["close"] > res) & (df["close"].shift(1) <= res.shift(1))
        broke_dn = (df["close"] < sup) & (df["close"].shift(1) >= sup.shift(1))

        n = self.p["retest_bars"]
        recent_up = broke_up.rolling(n, min_periods=1).max().astype(bool)
        recent_dn = broke_dn.rolling(n, min_periods=1).max().astype(bool)
        tol = self.p["retest_atr"] * a

        long = recent_up & (df["low"] <= res + tol) & (df["close"] > res)
        short = recent_dn & (df["high"] >= sup - tol) & (df["close"] < sup)

        sig = hold(long, df["close"] < sup, short, df["close"] > res)
        return pd.DataFrame({"signal": sig, "reason": "retest"}, index=df.index)


@register
class NDayHighMomentum(Strategy):
    name = "n_day_high"
    family = "breakout"
    timeframes = ("1h", "4h")
    description = (
        "Long on new N-bar highs, flat on new M-bar lows. The simplest possible "
        "breakout rule, long-only. Useful mainly as a control: any more elaborate "
        "breakout strategy that cannot beat this one is complexity without payoff."
    )
    allow_short = False
    params = (
        ParamSpec("high_n", 100, [50, 100, 200]),
        ParamSpec("low_n", 50, [25, 50, 100]),
    )

    def _compute(self, df, ctx):
        _, hi = ta.donchian(df, self.p["high_n"])
        lo, _ = ta.donchian(df, self.p["low_n"])
        sig = hold(df["close"] >= hi, df["close"] <= lo,
                   pd.Series(False, index=df.index), pd.Series(False, index=df.index))
        return pd.DataFrame({"signal": sig, "reason": "n_day_high"}, index=df.index)
