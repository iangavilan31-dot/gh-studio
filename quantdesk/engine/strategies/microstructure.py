"""Microstructure and flow strategies.

Read this before trusting anything in this file.

Genuine microstructure edges -- queue position, order-book imbalance at the
touch, latency arbitrage -- live at millisecond resolution and are harvested by
firms with colocated hardware. You are polling a REST endpoint over the public
internet from a laptop, on a fifteen-second cadence. You are not competing in
that game and nothing here pretends otherwise.

What is left is the slower half-life residue of flow: volume surges that mark
exhaustion, liquidation cascades that overshoot, funding-rate extremes that
signal crowded positioning. These persist for minutes to hours, not
microseconds, which puts them inside your reach. They are weaker signals than
true microstructure and they are treated as such here.

The order-book strategies additionally need live depth data, which historical
OHLCV does not contain. Those are marked `requires_l2` and are excluded from
backtests rather than silently backtested against a fabricated book -- a
backtest of a signal you cannot reconstruct is worse than no backtest, because
it produces a number you might believe.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, hold, register


@register
class VolumeSpikeExhaustion(Strategy):
    name = "volume_exhaustion"
    family = "microstructure"
    timeframes = ("5m", "15m")
    description = (
        "Fade climactic volume spikes that close against the move -- the classic "
        "exhaustion bar. Mechanism: a volume spike into a wide-range bar that closes "
        "poorly means aggressive flow was absorbed by passive liquidity, and the "
        "aggressors are now offside."
    )
    params = (
        ParamSpec("vol_z", 3.0, [2.0, 2.5, 3.0, 4.0]),
        ParamSpec("close_frac", 0.35, [0.25, 0.35, 0.5]),
        ParamSpec("hold_bars", 8, [4, 8, 16]),
    )

    def _compute(self, df, ctx):
        vz = ta.volume_zscore(df, 96)
        rng = (df["high"] - df["low"]).replace(0, np.nan)
        close_pos = (df["close"] - df["low"]) / rng     # 0 = closed on low

        spike = vz >= self.p["vol_z"]
        # Big up-bar that closed near its low -> buyers exhausted -> fade short.
        up_exhaust = spike & (df["close"] > df["open"]) & (close_pos < self.p["close_frac"])
        dn_exhaust = spike & (df["close"] < df["open"]) & (close_pos > 1 - self.p["close_frac"])

        raw = pd.Series(np.nan, index=df.index)
        raw[dn_exhaust] = 1.0
        raw[up_exhaust] = -1.0
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame(
            {"signal": sig, "strength": (vz / 5).clip(0, 1), "reason": "vol_exhaust"},
            index=df.index,
        )


@register
class LiquidationCascade(Strategy):
    name = "liquidation_cascade"
    family = "microstructure"
    timeframes = ("5m", "15m")
    description = (
        "Detect forced-liquidation signatures -- a violent range expansion on extreme "
        "volume with a long rejection wick -- and fade the overshoot. Liquidations are "
        "price-insensitive forced selling, so they systematically overshoot fair value "
        "and snap back. One of the better-founded fade setups in leveraged crypto."
    )
    params = (
        ParamSpec("range_atr", 3.0, [2.0, 3.0, 4.0]),
        ParamSpec("vol_z", 2.5, [2.0, 2.5, 3.5]),
        ParamSpec("wick_frac", 0.5, [0.4, 0.5, 0.6]),
        ParamSpec("hold_bars", 12, [6, 12, 24]),
    )

    def _compute(self, df, ctx):
        a = ta.atr(df, 14)
        rng = df["high"] - df["low"]
        vz = ta.volume_zscore(df, 96)
        violent = (rng >= self.p["range_atr"] * a) & (vz >= self.p["vol_z"])

        body_hi = df[["open", "close"]].max(axis=1)
        body_lo = df[["open", "close"]].min(axis=1)
        upper_wick = (df["high"] - body_hi) / rng.replace(0, np.nan)
        lower_wick = (body_lo - df["low"]) / rng.replace(0, np.nan)

        # Long lower wick on a violent bar = downside liquidation absorbed = buy.
        long = violent & (lower_wick >= self.p["wick_frac"])
        short = violent & (upper_wick >= self.p["wick_frac"])

        raw = pd.Series(np.nan, index=df.index)
        raw[long] = 1.0
        raw[short] = -1.0
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "liq_cascade"}, index=df.index)


@register
class CvdDivergence(Strategy):
    name = "cvd_divergence"
    family = "microstructure"
    timeframes = ("5m", "15m")
    description = (
        "Price makes a new extreme but the cumulative-volume-delta proxy does not -- "
        "the move is not backed by aggressive flow. NOTE: true CVD needs tick data with "
        "aggressor flags; this uses a close-position approximation from OHLCV and is "
        "therefore a weaker signal than the same idea computed on real trade prints. "
        "Treat its backtest numbers with more suspicion than the rest."
    )
    params = (
        ParamSpec("lookback", 24, [12, 24, 48]),
        ParamSpec("hold_bars", 10, [6, 10, 20]),
    )

    def _compute(self, df, ctx):
        n = self.p["lookback"]
        cvd = ta.cvd_proxy(df)
        px_hi = df["close"].rolling(n, min_periods=n).max()
        px_lo = df["close"].rolling(n, min_periods=n).min()
        cv_hi = cvd.rolling(n, min_periods=n).max()
        cv_lo = cvd.rolling(n, min_periods=n).min()

        bear_div = (df["close"] >= px_hi) & (cvd < cv_hi)
        bull_div = (df["close"] <= px_lo) & (cvd > cv_lo)

        raw = pd.Series(np.nan, index=df.index)
        raw[bull_div] = 1.0
        raw[bear_div] = -1.0
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "cvd_div"}, index=df.index)


@register
class VwapBandFlow(Strategy):
    name = "vwap_flow"
    family = "microstructure"
    timeframes = ("5m", "15m")
    description = (
        "Trend-follow along session VWAP: long while price holds above VWAP with "
        "expanding volume, flat when it loses it. The mirror image of vwap_reversion, "
        "included so the backtest can decide which side of VWAP behaviour dominates "
        "on each symbol -- they cannot both be right at the same time."
    )
    params = (
        ParamSpec("confirm_bars", 3, [1, 3, 5]),
        ParamSpec("vol_z_min", 0.0, [-0.5, 0.0, 0.5]),
    )

    def _compute(self, df, ctx):
        vw = ta.vwap_session(df, "D")
        above = df["close"] > vw
        below = df["close"] < vw
        n = self.p["confirm_bars"]
        vz = ta.volume_zscore(df, 96)
        flow = vz >= self.p["vol_z_min"]

        held_above = above.rolling(n, min_periods=n).min().astype(bool)
        held_below = below.rolling(n, min_periods=n).min().astype(bool)

        sig = hold(held_above & flow, below, held_below & flow, above)
        return pd.DataFrame({"signal": sig, "reason": "vwap_flow"}, index=df.index)


@register
class IlliquidityVeto(Strategy):
    name = "liquidity_filter"
    family = "microstructure"
    timeframes = ("5m", "15m", "1h")
    description = (
        "Momentum that refuses to trade when the Amihud illiquidity ratio says your "
        "own order would move the market. Not a return generator -- a cost-avoidance "
        "overlay. On a $500 account this matters less than it would at size, but the "
        "measurement is worth having on the dashboard regardless."
    )
    params = (
        ParamSpec("illiq_max_pct", 0.70, [0.5, 0.7, 0.9]),
        ParamSpec("mom_lookback", 24, [12, 24, 48]),
    )

    def _compute(self, df, ctx):
        illiq = ta.amihud_illiquidity(df, 96)
        rank = illiq.rolling(384, min_periods=96).rank(pct=True)
        liquid = rank <= self.p["illiq_max_pct"]
        mom = np.sign(df["close"] - df["close"].shift(self.p["mom_lookback"]))
        return pd.DataFrame(
            {"signal": mom.where(liquid, 0.0), "reason": "liq_filter"}, index=df.index
        )


@register
class OrderBookImbalance(Strategy):
    name = "book_imbalance"
    family = "microstructure"
    timeframes = ("1m", "5m")
    requires_l2 = True
    description = (
        "Trade sustained top-of-book size imbalance. Order-book imbalance is a "
        "well-documented short-horizon predictor of the next price move -- the signal "
        "is real. What is not real is your ability to monetise it from a REST poll: "
        "its half-life is measured in seconds. EXCLUDED FROM BACKTESTS because "
        "historical OHLCV contains no depth data. Runs live only, in paper mode, so "
        "you can watch it and see for yourself."
    )
    params = (
        ParamSpec("imbalance_threshold", 0.65, [0.6, 0.65, 0.75]),
        ParamSpec("levels", 10, [5, 10, 20]),
        ParamSpec("confirm_ticks", 3, [1, 3, 5]),
    )

    def _compute(self, df, ctx):
        # No depth in OHLCV. Returning a flat signal is the honest outcome; the
        # live runner supplies real book snapshots through ctx.peers["_book"].
        book = ctx.peers.get("_book")
        if book is None or "imbalance" not in getattr(book, "columns", []):
            return pd.DataFrame({"signal": 0.0, "reason": "no_l2"}, index=df.index)

        imb = book["imbalance"].reindex(df.index).ffill()
        n = self.p["confirm_ticks"]
        t = self.p["imbalance_threshold"]
        bid_heavy = (imb >= t).rolling(n, min_periods=n).min().astype(bool)
        ask_heavy = (imb <= 1 - t).rolling(n, min_periods=n).min().astype(bool)

        sig = pd.Series(0.0, index=df.index)
        sig[bid_heavy] = 1.0
        sig[ask_heavy] = -1.0
        return pd.DataFrame({"signal": sig, "reason": "book_imb"}, index=df.index)


@register
class FundingRateSkew(Strategy):
    name = "funding_skew"
    family = "microstructure"
    timeframes = ("1h", "4h")
    requires_funding = True
    description = (
        "Fade extreme perpetual-futures funding. Deeply positive funding means longs "
        "are crowded and paying to stay long, which marks the positioning extremes that "
        "precede long squeezes. Requires a perp venue; on spot-only exchanges this "
        "returns flat rather than inventing data."
    )
    params = (
        ParamSpec("funding_z", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("lookback", 168, [72, 168, 336]),
        ParamSpec("hold_bars", 24, [8, 24, 48]),
    )

    def _compute(self, df, ctx):
        fund = ctx.peers.get("_funding")
        if fund is None:
            return pd.DataFrame({"signal": 0.0, "reason": "no_funding"}, index=df.index)

        f = fund["funding_rate"].reindex(df.index).ffill()
        z = ta.zscore(f, self.p["lookback"])
        raw = pd.Series(np.nan, index=df.index)
        raw[z >= self.p["funding_z"]] = -1.0     # longs crowded -> fade
        raw[z <= -self.p["funding_z"]] = 1.0
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "funding_skew"}, index=df.index)
