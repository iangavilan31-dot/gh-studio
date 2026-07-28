"""Statistical arbitrage -- cointegration and cross-sectional strategies.

The appeal is market-neutral returns: long one asset, short a related one, so
the direction of the overall market cancels out and only the relationship
matters. In crypto that is unusually attractive, because the dominant risk in
every other strategy here is simply "BTC went down and took everything with it."

The honest constraints for a $500 spot account:

  * A true pair trade needs a short leg. On spot you cannot short without
    margin. You can approximate it with a perp short, but then you pay funding
    and carry liquidation risk. The `long_only_tilt` parameter exists for this
    -- it degrades the strategy to a long-the-cheap-leg tilt, which is not
    market neutral and should not be described as if it were.
  * Two legs means double the fees. A round trip on a pair is four taker fills,
    roughly 104bps at Kraken's base tier. The spread has to move meaningfully
    for that to be worth paying.
  * Cointegration is not stable. Pairs that cointegrated for two years decouple
    permanently when one project's fundamentals change. The rolling
    re-estimation and the half-life check here are the defence, and they are
    partial at best -- structural breaks are not predictable.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import indicators as ta
from .base import Context, ParamSpec, Strategy, hold, register


def _rolling_hedge_ratio(y: pd.Series, x: pd.Series, n: int) -> pd.Series:
    """Trailing OLS beta of y on x.

    Re-estimated every bar on a trailing window rather than fitted once over the
    whole sample. Fitting the hedge ratio in-sample and then trading it is one of
    the most common and most flattering forms of lookahead in pair-trading code.
    """
    cov = y.rolling(n, min_periods=n).cov(x)
    var = x.rolling(n, min_periods=n).var()
    return cov / var.replace(0, np.nan)


@register
class PairSpreadReversion(Strategy):
    name = "pair_spread"
    family = "statarb"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Trade the z-score of a rolling-hedge-ratio spread between two correlated "
        "assets. Enter when the spread is stretched, exit when it reverts. Includes a "
        "half-life gate that refuses the trade when the spread has no measurable "
        "reversion speed -- without it you are just holding a random walk and paying "
        "four legs of fees for the privilege."
    )
    params = (
        ParamSpec("peer", "BTC/USD", ["BTC/USD", "ETH/USD"]),
        ParamSpec("beta_window", 200, [100, 200, 400]),
        ParamSpec("z_window", 100, [50, 100, 200]),
        ParamSpec("entry_z", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("exit_z", 0.3, [0.0, 0.3, 0.5]),
        ParamSpec("max_half_life", 200, [50, 100, 200]),
        ParamSpec("long_only_tilt", 0, [0, 1]),
    )

    def _compute(self, df, ctx):
        peer_df = ctx.peers.get(self.p["peer"])
        if peer_df is None or ctx.symbol == self.p["peer"]:
            return pd.DataFrame({"signal": 0.0, "reason": "no_peer"}, index=df.index)

        y = np.log(df["close"])
        x = np.log(peer_df["close"].reindex(df.index).ffill())
        if x.isna().all():
            return pd.DataFrame({"signal": 0.0, "reason": "no_peer"}, index=df.index)

        beta = _rolling_hedge_ratio(y, x, self.p["beta_window"])
        spread = y - beta * x
        z = ta.zscore(spread, self.p["z_window"])

        # Reject the pair outright when reversion is too slow to be tradable.
        hl = ta.half_life(spread.dropna().tail(2000))
        if not np.isfinite(hl) or hl > self.p["max_half_life"]:
            return pd.DataFrame({"signal": 0.0, "reason": "half_life_reject"}, index=df.index)

        ez, xz = self.p["entry_z"], self.p["exit_z"]
        sig = hold(z <= -ez, z >= -xz, z >= ez, z <= xz)
        if self.p["long_only_tilt"]:
            sig = sig.clip(lower=0)

        return pd.DataFrame(
            {"signal": sig, "strength": (z.abs() / 3).clip(0, 1), "reason": "pair_spread"},
            index=df.index,
        )


@register
class RatioReversion(Strategy):
    name = "ratio_reversion"
    family = "statarb"
    timeframes = ("15m", "1h", "4h")
    description = (
        "Simpler cousin of the spread trade: fade the z-score of a plain price ratio "
        "with no hedge-ratio estimation. Fewer parameters means less to overfit, and "
        "for tightly-linked pairs the fixed 1:1 ratio is often no worse than an "
        "estimated beta."
    )
    params = (
        ParamSpec("peer", "BTC/USD", ["BTC/USD", "ETH/USD"]),
        ParamSpec("z_window", 100, [50, 100, 200]),
        ParamSpec("entry_z", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("min_corr", 0.60, [0.4, 0.6, 0.75]),
    )

    def _compute(self, df, ctx):
        peer_df = ctx.peers.get(self.p["peer"])
        if peer_df is None or ctx.symbol == self.p["peer"]:
            return pd.DataFrame({"signal": 0.0, "reason": "no_peer"}, index=df.index)

        px = peer_df["close"].reindex(df.index).ffill()
        ratio = df["close"] / px.replace(0, np.nan)
        z = ta.zscore(ratio, self.p["z_window"])
        corr = ta.rolling_corr(df["close"], px, self.p["z_window"])
        linked = corr >= self.p["min_corr"]

        ez = self.p["entry_z"]
        sig = hold((z <= -ez) & linked, z >= -0.3, (z >= ez) & linked, z <= 0.3)
        return pd.DataFrame({"signal": sig, "reason": "ratio_rev"}, index=df.index)


@register
class BetaNeutralResidual(Strategy):
    name = "beta_residual"
    family = "statarb"
    timeframes = ("1h", "4h")
    description = (
        "Strip out the asset's BTC-beta and trade the residual's reversion. Because "
        "nearly all crypto beta is BTC beta, the residual is the closest thing to an "
        "idiosyncratic, market-neutral signal available without a full factor model."
    )
    params = (
        ParamSpec("beta_window", 168, [96, 168, 336]),
        ParamSpec("z_window", 96, [48, 96, 192]),
        ParamSpec("entry_z", 2.0, [1.5, 2.0, 2.5]),
    )

    def _compute(self, df, ctx):
        bench = ctx.benchmark
        if bench is None or len(bench) == 0:
            return pd.DataFrame({"signal": 0.0, "reason": "no_bench"}, index=df.index)

        b = bench["close"].reindex(df.index).ffill()
        ra, rb = df["close"].pct_change(), b.pct_change()
        beta = ta.rolling_beta(df["close"], b, self.p["beta_window"])
        resid = (ra - beta * rb).fillna(0.0).cumsum()

        z = ta.zscore(resid, self.p["z_window"])
        ez = self.p["entry_z"]
        sig = hold(z <= -ez, z >= -0.3, z >= ez, z <= 0.3)
        return pd.DataFrame({"signal": sig, "reason": "beta_resid"}, index=df.index)


@register
class CrossSectionalMomentum(Strategy):
    name = "xs_momentum"
    family = "statarb"
    timeframes = ("1h", "4h")
    description = (
        "Rank the universe by trailing return and go long the top decile, short the "
        "bottom. Well documented in crypto (weekly Sharpe ~1.3 for winners in the "
        "literature), though the published results consistently favour time-series "
        "momentum over the cross-sectional version -- ts_momentum is the fairer "
        "comparison, and this one exists partly to demonstrate that."
    )
    params = (
        ParamSpec("lookback", 168, [72, 168, 336]),
        ParamSpec("top_frac", 0.30, [0.2, 0.3, 0.4]),
        ParamSpec("skip_recent", 12, [0, 12, 24]),
    )

    def _compute(self, df, ctx):
        if not ctx.peers:
            return pd.DataFrame({"signal": 0.0, "reason": "no_universe"}, index=df.index)

        n, skip = self.p["lookback"], self.p["skip_recent"]

        def _mom(frame: pd.DataFrame) -> pd.Series:
            c = frame["close"]
            # Skipping the most recent bars is standard: the newest move tends to
            # revert, and including it contaminates momentum with reversal.
            return c.shift(skip) / c.shift(skip + n) - 1.0

        own = _mom(df)
        peer_mom = {}
        for sym, pdf in ctx.peers.items():
            if sym.startswith("_"):
                continue
            peer_mom[sym] = _mom(pdf.reindex(df.index).ffill())
        if not peer_mom:
            return pd.DataFrame({"signal": 0.0, "reason": "no_universe"}, index=df.index)

        panel = pd.DataFrame(peer_mom)
        panel[ctx.symbol] = own
        rank = panel.rank(axis=1, pct=True)[ctx.symbol]

        tf = self.p["top_frac"]
        sig = pd.Series(0.0, index=df.index)
        sig[rank >= 1 - tf] = 1.0
        sig[rank <= tf] = -1.0
        return pd.DataFrame({"signal": sig, "reason": "xs_mom"}, index=df.index)


@register
class LeadLagFollow(Strategy):
    name = "lead_lag"
    family = "statarb"
    timeframes = ("5m", "15m")
    description = (
        "BTC leads, alts follow -- trade the lag. There is a real information-diffusion "
        "mechanism here and the effect is documented, but it is also the fastest-decaying "
        "edge in this file: as venues have gotten more efficient the lag has compressed "
        "from minutes toward seconds. Expect the backtest to look better on older data "
        "than recent data, and treat that decay as the actual finding."
    )
    params = (
        ParamSpec("lead_bars", 2, [1, 2, 3, 5]),
        ParamSpec("move_z", 2.0, [1.5, 2.0, 2.5]),
        ParamSpec("hold_bars", 6, [3, 6, 12]),
        ParamSpec("min_corr", 0.5, [0.3, 0.5, 0.7]),
    )

    def _compute(self, df, ctx):
        bench = ctx.benchmark
        if bench is None or len(bench) == 0 or ctx.symbol == "BTC/USD":
            return pd.DataFrame({"signal": 0.0, "reason": "is_leader"}, index=df.index)

        b = bench["close"].reindex(df.index).ffill()
        lead_ret = b.pct_change(self.p["lead_bars"])
        lz = ta.zscore(lead_ret, 96)
        corr = ta.rolling_corr(df["close"], b, 96)
        linked = corr >= self.p["min_corr"]

        raw = pd.Series(np.nan, index=df.index)
        raw[(lz >= self.p["move_z"]) & linked] = 1.0
        raw[(lz <= -self.p["move_z"]) & linked] = -1.0
        sig = raw.ffill(limit=self.p["hold_bars"]).fillna(0.0)
        return pd.DataFrame({"signal": sig, "reason": "lead_lag"}, index=df.index)
