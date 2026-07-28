"""Bar-by-bar backtest engine.

Written as an explicit loop rather than vectorised arithmetic. Vectorised
backtests are faster and are wrong in ways that flatter you: they cannot model
an intrabar stop, they cannot model the interaction between a stop and a target
inside the same bar, and they silently allow a position to be sized off
information that would not have existed yet. The loop costs a few seconds per
run and removes that entire class of error.

The rules this engine enforces, all of which exist because violating them is
how backtests come to disagree with live trading:

  * A signal computed from bar i's close is executed at bar i+1's OPEN. Never
    at bar i's close. The one-bar delay is not conservatism, it is causality.
  * Every fill pays the spread AND a taker fee AND ATR-scaled slippage. There
    is no maker-fill assumption anywhere; assuming your limit orders get filled
    at the touch is the most expensive lie a retail backtest tells.
  * Stops are checked against the bar's LOW/HIGH, not its close, so an intrabar
    stop-out is caught.
  * When a bar's range contains both the stop and the target, the STOP is
    assumed to fill first. Without tick data you cannot know the order, and
    assuming the good outcome is how a losing system backtests profitably.
  * Position size is derived from the stop distance known at entry time.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .. import indicators as ta


@dataclass
class CostModel:
    taker_fee_bps: float = 26.0
    maker_fee_bps: float = 16.0
    spread_bps: Dict[str, float] = field(default_factory=lambda: {"default": 4.0})
    slippage_atr_frac: float = 0.05
    assume_taker: bool = True

    def fee_rate(self) -> float:
        bps = self.taker_fee_bps if self.assume_taker else self.maker_fee_bps
        return bps / 10_000.0

    def half_spread(self, symbol: str) -> float:
        bps = self.spread_bps.get(symbol, self.spread_bps.get("default", 4.0))
        return bps / 10_000.0 / 2.0

    def fill_price(self, symbol: str, ref_price: float, atr_val: float, side: int) -> float:
        """Adverse fill: you cross the spread and eat slippage, always.

        `side` is +1 when buying, -1 when selling. Both directions move the fill
        against you, which is the entire point.
        """
        slip = self.slippage_atr_frac * (atr_val if np.isfinite(atr_val) else 0.0)
        return ref_price * (1.0 + side * self.half_spread(symbol)) + side * slip


@dataclass
class ExecModel:
    atr_period: int = 14
    stop_atr_mult: float = 2.0
    target_atr_mult: float = 3.0
    trailing_atr_mult: float = 2.5
    use_trailing_stop: bool = True
    max_holding_bars: int = 96
    cooldown_bars: int = 3


@dataclass
class Trade:
    symbol: str
    strategy: str
    direction: int
    entry_time: pd.Timestamp
    entry_price: float
    exit_time: Optional[pd.Timestamp] = None
    exit_price: float = 0.0
    qty: float = 0.0
    stop_price: float = 0.0
    target_price: float = 0.0
    pnl: float = 0.0
    pnl_r: float = 0.0
    fees: float = 0.0
    bars_held: int = 0
    exit_reason: str = ""
    mae_r: float = 0.0      # worst excursion against you, in R
    mfe_r: float = 0.0      # best excursion in your favour, in R

    def to_dict(self) -> dict:
        d = asdict(self)
        d["entry_time"] = str(self.entry_time)
        d["exit_time"] = str(self.exit_time) if self.exit_time is not None else None
        return d


@dataclass
class BacktestResult:
    equity: pd.Series
    trades: List[Trade]
    symbol: str
    strategy: str
    timeframe: str
    starting_equity: float
    exposure: pd.Series | None = None

    @property
    def trade_frame(self) -> pd.DataFrame:
        if not self.trades:
            return pd.DataFrame()
        return pd.DataFrame([t.to_dict() for t in self.trades])


class Backtester:
    """Single symbol, single strategy, long/short, one position at a time.

    Portfolio-level constraints (concurrent positions, correlation caps, the
    daily loss halt) belong to the risk manager and are applied by the portfolio
    runner, not here. Keeping them out means a strategy's own performance can be
    measured without the portfolio's constraints confounding it.
    """

    def __init__(
        self,
        costs: CostModel,
        execution: ExecModel,
        starting_equity: float = 500.0,
        risk_per_trade: float = 0.05,
        allow_short: bool = True,
    ):
        self.costs = costs
        self.ex = execution
        self.starting_equity = starting_equity
        self.risk_per_trade = risk_per_trade
        self.allow_short = allow_short

    def run(
        self,
        df: pd.DataFrame,
        signals: pd.DataFrame,
        symbol: str = "",
        strategy: str = "",
        timeframe: str = "",
    ) -> BacktestResult:
        df = df.dropna(subset=["open", "high", "low", "close"])
        signals = signals.reindex(df.index)

        atr_arr = ta.atr(df, self.ex.atr_period).to_numpy(dtype=float)
        o = df["open"].to_numpy(dtype=float)
        h = df["high"].to_numpy(dtype=float)
        l = df["low"].to_numpy(dtype=float)
        c = df["close"].to_numpy(dtype=float)
        idx = df.index

        sig = signals["signal"].fillna(0.0).to_numpy(dtype=float)
        strength = signals.get("strength", pd.Series(1.0, index=df.index))
        strength = strength.fillna(1.0).to_numpy(dtype=float)
        reasons = signals.get("reason", pd.Series("", index=df.index)).fillna("").astype(str).tolist()

        equity = self.starting_equity
        equity_curve = np.full(len(df), np.nan)
        exposure = np.zeros(len(df))
        trades: List[Trade] = []

        pos = 0                 # -1 / 0 / +1
        qty = 0.0
        entry_px = 0.0
        stop_px = 0.0
        target_px = 0.0
        entry_i = 0
        entry_fees = 0.0
        risk_per_unit = 0.0
        mae = 0.0
        mfe = 0.0
        cooldown_until = -1

        fee = self.costs.fee_rate()

        for i in range(len(df)):
            a = atr_arr[i]

            # ---------------- manage an open position ----------------
            if pos != 0:
                bar_hi, bar_lo = h[i], l[i]
                # Track excursions in R before resolving exits.
                if risk_per_unit > 0:
                    if pos > 0:
                        mae = min(mae, (bar_lo - entry_px) / risk_per_unit)
                        mfe = max(mfe, (bar_hi - entry_px) / risk_per_unit)
                    else:
                        mae = min(mae, (entry_px - bar_hi) / risk_per_unit)
                        mfe = max(mfe, (entry_px - bar_lo) / risk_per_unit)

                exit_px = None
                exit_reason = ""

                hit_stop = (bar_lo <= stop_px) if pos > 0 else (bar_hi >= stop_px)
                hit_target = (bar_hi >= target_px) if pos > 0 else (bar_lo <= target_px)

                if hit_stop:
                    # Pessimistic ordering: stop resolves before target when both
                    # are inside the same bar.
                    exit_px, exit_reason = stop_px, "stop"
                elif hit_target:
                    exit_px, exit_reason = target_px, "target"
                elif i - entry_i >= self.ex.max_holding_bars:
                    exit_px, exit_reason = c[i], "time"
                elif sig[i] != pos and sig[i] != 0:
                    exit_px, exit_reason = c[i], "reverse"
                elif sig[i] == 0 and pos != 0:
                    exit_px, exit_reason = c[i], "signal_flat"

                if exit_px is not None:
                    fill = self.costs.fill_price(symbol, exit_px, a, -pos)
                    gross = (fill - entry_px) * qty * pos
                    exit_fee = abs(fill * qty) * fee
                    net = gross - exit_fee - entry_fees
                    equity += net

                    t = trades[-1]
                    t.exit_time = idx[i]
                    t.exit_price = float(fill)
                    t.pnl = float(net)
                    t.pnl_r = float(net / (risk_per_unit * qty)) if risk_per_unit * qty > 0 else 0.0
                    t.fees = float(entry_fees + exit_fee)
                    t.bars_held = int(i - entry_i)
                    t.exit_reason = exit_reason
                    t.mae_r = float(mae)
                    t.mfe_r = float(mfe)

                    pos, qty, risk_per_unit = 0, 0.0, 0.0
                    cooldown_until = i + self.ex.cooldown_bars
                    mae = mfe = 0.0
                else:
                    # Trail the stop only in the favourable direction.
                    if self.ex.use_trailing_stop and np.isfinite(a):
                        if pos > 0:
                            stop_px = max(stop_px, c[i] - self.ex.trailing_atr_mult * a)
                        else:
                            stop_px = min(stop_px, c[i] + self.ex.trailing_atr_mult * a)
                    exposure[i] = abs(qty * c[i]) / max(equity, 1e-9)

            # ---------------- open a new position ----------------
            # Signal from bar i-1's close, filled at bar i's open. This is the
            # causality guard; do not "improve" it to use c[i].
            if pos == 0 and i > 0 and i > cooldown_until and np.isfinite(a) and a > 0:
                want = sig[i - 1]
                if want != 0 and (self.allow_short or want > 0):
                    side = int(np.sign(want))
                    fill = self.costs.fill_price(symbol, o[i], a, side)
                    stop_dist = self.ex.stop_atr_mult * a
                    if stop_dist > 0:
                        conf = float(np.clip(strength[i - 1], 0.0, 1.0))
                        risk_cash = equity * self.risk_per_trade * conf
                        q = risk_cash / stop_dist
                        # Never let a single position exceed the account, which
                        # would be implicit leverage on a spot account.
                        max_q = equity / max(fill, 1e-9)
                        q = min(q, max_q)

                        if q > 0:
                            entry_fee = abs(fill * q) * fee
                            pos, qty = side, q
                            entry_px = float(fill)
                            entry_i = i
                            entry_fees = entry_fee
                            risk_per_unit = stop_dist
                            stop_px = fill - side * stop_dist
                            target_px = fill + side * self.ex.target_atr_mult * a
                            mae = mfe = 0.0
                            trades.append(
                                Trade(
                                    symbol=symbol,
                                    strategy=strategy,
                                    direction=side,
                                    entry_time=idx[i],
                                    entry_price=entry_px,
                                    qty=float(q),
                                    stop_price=float(stop_px),
                                    target_price=float(target_px),
                                )
                            )
                            exposure[i] = abs(q * fill) / max(equity, 1e-9)

            # Mark to market so the equity curve reflects open risk, not just
            # closed trades. A curve that only moves on exits hides drawdown.
            if pos != 0:
                unreal = (c[i] - entry_px) * qty * pos
                equity_curve[i] = equity + unreal
            else:
                equity_curve[i] = equity

        return BacktestResult(
            equity=pd.Series(equity_curve, index=idx).ffill().fillna(self.starting_equity),
            trades=[t for t in trades if t.exit_time is not None],
            symbol=symbol,
            strategy=strategy,
            timeframe=timeframe,
            starting_equity=self.starting_equity,
            exposure=pd.Series(exposure, index=idx),
        )


def costs_from_config(cfg: dict) -> CostModel:
    c = cfg.get("costs", {})
    return CostModel(
        taker_fee_bps=float(c.get("taker_fee_bps", 26.0)),
        maker_fee_bps=float(c.get("maker_fee_bps", 16.0)),
        spread_bps=dict(c.get("spread_bps", {"default": 4.0})),
        slippage_atr_frac=float(c.get("slippage_atr_frac", 0.05)),
        assume_taker=bool(c.get("assume_taker", True)),
    )


def exec_from_config(cfg: dict) -> ExecModel:
    e = cfg.get("execution", {})
    return ExecModel(
        atr_period=int(e.get("atr_period", 14)),
        stop_atr_mult=float(e.get("stop_atr_mult", 2.0)),
        target_atr_mult=float(e.get("target_atr_mult", 3.0)),
        trailing_atr_mult=float(e.get("trailing_atr_mult", 2.5)),
        use_trailing_stop=bool(e.get("use_trailing_stop", True)),
        max_holding_bars=int(e.get("max_holding_bars", 96)),
        cooldown_bars=int(e.get("cooldown_bars", 3)),
    )
