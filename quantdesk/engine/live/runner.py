"""The live/paper trading loop.

Runs the same strategy objects and the same cost model as the backtester. The
only differences are that bars arrive over time instead of all at once, and that
the risk manager can veto an entry the backtester would have taken.

Loop, once per `poll_seconds`:

    1. roll the UTC day if needed (resets the daily loss halt)
    2. pull recent bars for every symbol
    3. mark open positions to market, resolve stops/targets/timeouts
    4. generate signals; ask the risk manager for permission; size; submit
    5. persist equity, positions and events

Two properties worth stating explicitly:

  * Signals are read from the LAST CLOSED bar, never the forming one. This
    matches the backtester's one-bar delay. It is the reason live results have a
    chance of resembling backtest results.
  * Every exception inside the loop is caught, logged and alerted, and the loop
    continues. A crashed bot with an open position and no stop management is far
    more dangerous than a bot that skips one tick.
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .. import indicators as ta
from ..backtest.engine import CostModel, ExecModel
from ..risk.manager import Position, RiskManager
from ..strategies.base import Context, Strategy
from .alerts import Alerter
from .broker import Broker, Order
from .state import Store


class LiveRunner:
    def __init__(
        self,
        feed,
        strategies: Dict[str, Strategy],
        risk: RiskManager,
        broker: Broker,
        store: Store,
        alerter: Alerter,
        costs: CostModel,
        execution: ExecModel,
        symbols: List[str],
        timeframe: str = "15m",
        poll_seconds: int = 15,
        benchmark_symbol: str = "BTC/USD",
        log=print,
    ):
        self.feed = feed
        self.strategies = strategies
        self.risk = risk
        self.broker = broker
        self.store = store
        self.alerter = alerter
        self.costs = costs
        self.ex = execution
        self.symbols = symbols
        self.timeframe = timeframe
        self.poll_seconds = poll_seconds
        self.benchmark_symbol = benchmark_symbol
        self.log = log

        self.mode = broker.name
        self.running = False
        self.last_tick: Optional[str] = None
        self.bars: Dict[str, pd.DataFrame] = {}
        self.latest_signals: Dict[str, dict] = {}
        self.scanner_rows: List[dict] = []
        self._entry_bar_count: Dict[str, int] = {}

        if self.mode == "paper":
            self.store.mark_paper_start()

    # -- main loop ---------------------------------------------------------
    def start(self) -> None:
        self.running = True
        self.log(f"[runner] started in {self.mode.upper()} mode on {len(self.symbols)} symbols")
        self.store.log_event("info", "start", f"runner started ({self.mode})")

        while self.running:
            t0 = time.time()
            try:
                self.tick()
            except Exception:
                err = traceback.format_exc()
                self.log(f"[runner] tick failed:\n{err}")
                self.store.log_event("error", "crash", err[-2000:])
                self.alerter.crash(err[-2000:])
            elapsed = time.time() - t0
            time.sleep(max(1.0, self.poll_seconds - elapsed))

    def stop(self) -> None:
        self.running = False
        self.store.log_event("info", "stop", "runner stopped")

    def tick(self) -> None:
        rolled = self.risk.roll_day_if_needed()
        if rolled:
            self.alerter.summary(self.risk.snapshot())

        self._refresh_bars()
        if not self.bars:
            return

        self._manage_positions()
        self._scan()

        if not (self.risk.state.kill_switch or self.risk.state.halted_today):
            self._look_for_entries()

        eq = self.risk.state.equity + self.risk.total_unrealised()
        self.store.record_equity(self.mode, eq, self.risk.total_unrealised(),
                                 len(self.risk.positions))
        self.last_tick = datetime.now(timezone.utc).isoformat()

    # -- data --------------------------------------------------------------
    def _refresh_bars(self) -> None:
        for s in self.symbols:
            df = self.feed.fetch_recent(s, self.timeframe, limit=400)
            if len(df) > 50:
                self.bars[s] = df
                self.risk.set_returns(s, df["close"])

    def _context(self, symbol: str) -> Context:
        peers = {k: v for k, v in self.bars.items() if k != symbol}
        return Context(
            symbol=symbol,
            timeframe=self.timeframe,
            peers=peers,
            benchmark=self.bars.get(self.benchmark_symbol),
        )

    # -- position management ----------------------------------------------
    def _manage_positions(self) -> None:
        for symbol in list(self.risk.positions):
            df = self.bars.get(symbol)
            if df is None or df.empty:
                continue

            pos = self.risk.positions[symbol]
            bar = df.iloc[-1]
            price = float(bar["close"])
            self.risk.mark(symbol, price)
            pos.bars_held = len(df) - self._entry_bar_count.get(symbol, len(df))

            a = float(ta.atr(df, self.ex.atr_period).iloc[-1])
            reason = None

            # Stops checked against the bar extremes, matching the backtester.
            if pos.direction > 0 and float(bar["low"]) <= pos.stop_price:
                reason = "stop"
            elif pos.direction < 0 and float(bar["high"]) >= pos.stop_price:
                reason = "stop"
            elif pos.direction > 0 and float(bar["high"]) >= pos.target_price:
                reason = "target"
            elif pos.direction < 0 and float(bar["low"]) <= pos.target_price:
                reason = "target"
            elif pos.bars_held >= self.ex.max_holding_bars:
                reason = "time"
            else:
                sig = self.latest_signals.get(symbol, {}).get("signal", 0)
                if sig != 0 and sig != pos.direction:
                    reason = "reverse"

            if reason:
                self._close(symbol, price, a, reason)
            elif self.ex.use_trailing_stop and np.isfinite(a):
                if pos.direction > 0:
                    pos.stop_price = max(pos.stop_price, price - self.ex.trailing_atr_mult * a)
                else:
                    pos.stop_price = min(pos.stop_price, price + self.ex.trailing_atr_mult * a)

    def _close(self, symbol: str, price: float, atr_val: float, reason: str) -> None:
        pos = self.risk.positions.get(symbol)
        if pos is None:
            return

        side = "sell" if pos.direction > 0 else "buy"
        order = self.broker.market_order(symbol, side, pos.qty, price, atr_val)
        self.store.record_order(self.mode, order.to_dict())

        if order.status == "rejected":
            self.log(f"[runner] exit rejected for {symbol}: {order.note}")
            self.store.log_event("warn", "order_rejected", f"{symbol} exit: {order.note}")
            return

        fill = order.avg_fill_price
        qty = order.filled_qty or pos.qty
        gross = (fill - pos.entry_price) * qty * pos.direction
        net = gross - order.fee
        pnl_r = net / pos.risk_cash if pos.risk_cash > 0 else 0.0

        self.risk.close_position(symbol, net)
        self._entry_bar_count.pop(symbol, None)

        self.store.record_trade(self.mode, {
            "symbol": symbol, "strategy": pos.strategy, "timeframe": self.timeframe,
            "direction": pos.direction, "qty": qty,
            "entry_time": pos.entry_time.isoformat(), "entry_price": pos.entry_price,
            "exit_time": datetime.now(timezone.utc).isoformat(), "exit_price": fill,
            "stop_price": pos.stop_price, "target_price": pos.target_price,
            "pnl": net, "pnl_r": pnl_r, "fees": order.fee,
            "bars_held": pos.bars_held, "exit_reason": reason,
            "mae_r": 0.0, "mfe_r": 0.0,
        })

        self.log(f"[runner] closed {symbol} ({reason}) {net:+.2f} ({pnl_r:+.2f}R)")
        self.store.log_event("info", "close", f"{symbol} {reason} {net:+.2f} ({pnl_r:+.2f}R)")

        if reason == "stop":
            self.alerter.stop_out(symbol, net, pnl_r, pos.strategy)

        s = self.risk.state
        if s.halted_today:
            self.alerter.daily_limit(s.equity / max(s.day_start_equity, 1e-9) - 1.0, s.equity)
        if s.kill_switch:
            self.alerter.kill_switch(s.kill_reason, s.equity)

    # -- entries -----------------------------------------------------------
    def _look_for_entries(self) -> None:
        for symbol in self.symbols:
            df = self.bars.get(symbol)
            if df is None or len(df) < 200 or symbol in self.risk.positions:
                continue

            ctx = self._context(symbol)
            best: Optional[tuple] = None

            for name, strat in self.strategies.items():
                if self.timeframe not in strat.timeframes:
                    continue
                try:
                    sigs = strat.generate(df, ctx)
                except Exception as e:
                    self.log(f"[runner] {name} failed on {symbol}: {e}")
                    continue
                if sigs.empty:
                    continue

                # Last CLOSED bar. The feed already dropped the forming one.
                row = sigs.iloc[-1]
                sig = float(row.get("signal", 0) or 0)
                if sig == 0:
                    continue
                strength = float(row.get("strength", 1.0) or 1.0)
                if best is None or strength > best[2]:
                    best = (name, sig, strength, str(row.get("reason", "")))

            self.latest_signals[symbol] = (
                {"signal": best[1], "strategy": best[0], "strength": best[2], "reason": best[3]}
                if best else {"signal": 0}
            )

            if best is None:
                continue
            self._try_enter(symbol, df, *best)

    def _try_enter(self, symbol: str, df: pd.DataFrame, strat_name: str,
                   sig: float, strength: float, reason: str) -> None:
        a = float(ta.atr(df, self.ex.atr_period).iloc[-1])
        if not np.isfinite(a) or a <= 0:
            return

        price = float(df["close"].iloc[-1])
        direction = int(np.sign(sig))
        stop_dist = self.ex.stop_atr_mult * a
        stop_price = price - direction * stop_dist
        target_price = price + direction * self.ex.target_atr_mult * a

        equity = self.risk.state.equity
        qty, risk_cash = self.risk.size_position(equity, price, stop_price, strength)
        if qty <= 0:
            return

        ok, why = self.risk.can_open(symbol, qty * price)
        if not ok:
            self.store.log_event("info", "entry_blocked", f"{symbol}: {why}")
            return

        side = "buy" if direction > 0 else "sell"
        order = self.broker.market_order(symbol, side, qty, price, a)
        self.store.record_order(self.mode, order.to_dict())

        if order.status == "rejected" or order.filled_qty <= 0:
            self.store.log_event("warn", "order_rejected", f"{symbol} entry: {order.note}")
            return

        filled_qty = order.filled_qty
        fill = order.avg_fill_price
        # Partial fills reduce risk proportionally; recompute rather than
        # carrying the intended size forward, which would misstate R.
        actual_risk = filled_qty * stop_dist

        pos = Position(
            symbol=symbol, strategy=strat_name, direction=direction,
            qty=filled_qty, entry_price=fill,
            stop_price=fill - direction * stop_dist,
            target_price=fill + direction * self.ex.target_atr_mult * a,
            entry_time=datetime.now(timezone.utc), risk_cash=actual_risk,
            last_price=fill,
        )
        self.risk.open_position(pos)
        self._entry_bar_count[symbol] = len(df)

        self.log(f"[runner] {side} {symbol} {filled_qty:.6f} @ {fill:.4f} "
                 f"({strat_name}, stop {pos.stop_price:.4f})")
        self.store.log_event("info", "open",
                             f"{side} {symbol} @ {fill:.4f} via {strat_name} ({reason})")
        self.alerter.fill(symbol, side, filled_qty, fill, strat_name)

    # -- scanner -----------------------------------------------------------
    def _scan(self) -> None:
        """Rank symbols by volatility and volume surge.

        Watchlist only -- nothing here auto-trades. Surfacing where the motion
        is without acting on it is the point; acting on 'unusual movement'
        without a tested signal is just gambling with extra steps.
        """
        rows = []
        for symbol, df in self.bars.items():
            if len(df) < 100:
                continue
            try:
                nv = float(ta.natr(df, 14).iloc[-1])
                vz = float(ta.volume_zscore(df, 96).iloc[-1])
                ret_1h = float(df["close"].iloc[-1] / df["close"].iloc[-5] - 1.0)
                ret_24h = float(df["close"].iloc[-1] / df["close"].iloc[-96] - 1.0) \
                    if len(df) > 96 else 0.0
                er = float(ta.efficiency_ratio(df["close"], 20).iloc[-1])
                rows.append({
                    "symbol": symbol,
                    "price": float(df["close"].iloc[-1]),
                    "natr": nv,
                    "volume_z": vz if np.isfinite(vz) else 0.0,
                    "ret_1h": ret_1h,
                    "ret_24h": ret_24h,
                    "efficiency": er if np.isfinite(er) else 0.0,
                    "signal": self.latest_signals.get(symbol, {}).get("signal", 0),
                    # Composite heat: volatility plus abnormal volume.
                    "heat": (nv * 100 if np.isfinite(nv) else 0.0)
                            + max(0.0, vz if np.isfinite(vz) else 0.0),
                })
            except Exception:
                continue
        self.scanner_rows = sorted(rows, key=lambda r: r["heat"], reverse=True)

    # -- introspection for the API ----------------------------------------
    def snapshot(self) -> dict:
        return {
            "mode": self.mode,
            "running": self.running,
            "last_tick": self.last_tick,
            "timeframe": self.timeframe,
            "symbols": self.symbols,
            "strategies": sorted(self.strategies),
            "paper_days": self.store.paper_days(),
            "risk": self.risk.snapshot(),
            "signals": self.latest_signals,
            "scanner": self.scanner_rows,
        }
