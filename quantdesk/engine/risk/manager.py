"""Risk manager -- the component most likely to actually save your account.

Strategy selection gets all the attention and almost none of the outcome.
Position sizing and loss limits determine whether a losing streak is a bad week
or a terminal event, and every strategy has losing streaks.

The hard ceilings below are not adjustable from config. You selected an
aggressive profile and the engine honours it up to these bounds, but it will not
let a config edit or a typo take you past the point where recovery stops being
arithmetic. A 5% risk-per-trade setting is already at the ceiling; the
probability arithmetic is in the module docstring of montecarlo.py and on the
dashboard's risk panel.

What each control actually does:

  risk_per_trade          fraction of equity lost if the stop is hit exactly
  daily_loss_limit        halt for the rest of the UTC day
  max_total_drawdown      kill switch; requires a manual reset
  max_concurrent          how many positions can be open at once
  max_gross_exposure      1.0 = spot only, no borrowed money
  correlation cap         stops 3 "different" positions being one BTC bet
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# --- ceilings. Config cannot exceed these. -------------------------------
CEIL_RISK_PER_TRADE = 0.05
CEIL_DAILY_LOSS = 0.10
CEIL_GROSS_EXPOSURE = 1.0
CEIL_POSITION_PCT = 0.50
FLOOR_MAX_DRAWDOWN = 0.10


@dataclass
class RiskLimits:
    starting_equity: float = 500.0
    risk_per_trade: float = 0.05
    daily_loss_limit: float = 0.10
    max_concurrent_positions: int = 3
    max_gross_exposure: float = 1.0
    max_position_pct: float = 0.40
    max_total_drawdown: float = 0.30
    correlation_threshold: float = 0.80
    max_correlated_exposure: float = 0.60

    def clamped(self) -> tuple["RiskLimits", List[str]]:
        """Apply hard ceilings, reporting anything that was cut."""
        notes: List[str] = []
        r = RiskLimits(**asdict(self))

        if r.risk_per_trade > CEIL_RISK_PER_TRADE:
            notes.append(
                f"risk_per_trade {r.risk_per_trade:.1%} -> {CEIL_RISK_PER_TRADE:.1%} (hard ceiling)"
            )
            r.risk_per_trade = CEIL_RISK_PER_TRADE
        if r.daily_loss_limit > CEIL_DAILY_LOSS:
            notes.append(
                f"daily_loss_limit {r.daily_loss_limit:.1%} -> {CEIL_DAILY_LOSS:.1%} (hard ceiling)"
            )
            r.daily_loss_limit = CEIL_DAILY_LOSS
        if r.max_gross_exposure > CEIL_GROSS_EXPOSURE:
            notes.append("max_gross_exposure capped at 1.0 -- this engine does not use leverage")
            r.max_gross_exposure = CEIL_GROSS_EXPOSURE
        if r.max_position_pct > CEIL_POSITION_PCT:
            notes.append(f"max_position_pct -> {CEIL_POSITION_PCT:.0%} (hard ceiling)")
            r.max_position_pct = CEIL_POSITION_PCT
        if r.max_total_drawdown < FLOOR_MAX_DRAWDOWN:
            notes.append(f"max_total_drawdown raised to {FLOOR_MAX_DRAWDOWN:.0%} (too tight to trade)")
            r.max_total_drawdown = FLOOR_MAX_DRAWDOWN
        return r, notes


@dataclass
class Position:
    symbol: str
    strategy: str
    direction: int
    qty: float
    entry_price: float
    stop_price: float
    target_price: float
    entry_time: datetime
    risk_cash: float
    bars_held: int = 0
    unrealised: float = 0.0
    last_price: float = 0.0

    def notional(self) -> float:
        return abs(self.qty * (self.last_price or self.entry_price))

    def to_dict(self) -> dict:
        d = asdict(self)
        d["entry_time"] = self.entry_time.isoformat()
        d["notional"] = self.notional()
        return d


@dataclass
class RiskState:
    equity: float
    peak_equity: float
    day_start_equity: float
    day: str
    halted_today: bool = False
    kill_switch: bool = False
    kill_reason: str = ""
    realised_today: float = 0.0
    trades_today: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


class RiskManager:
    def __init__(self, limits: RiskLimits, log=print):
        self.limits, self.clamp_notes = limits.clamped()
        self.log = log
        for n in self.clamp_notes:
            log(f"[risk] {n}")

        eq = self.limits.starting_equity
        self.state = RiskState(
            equity=eq, peak_equity=eq, day_start_equity=eq, day=_utc_day()
        )
        self.positions: Dict[str, Position] = {}
        self._returns: Dict[str, pd.Series] = {}
        self._last_size_capped = False

        # Surface the cap interaction at startup rather than letting the user
        # believe a 5% setting means 5% is actually being risked.
        breakeven_stop_pct = self.limits.risk_per_trade / max(self.limits.max_position_pct, 1e-9)
        if breakeven_stop_pct > 0.05:
            log(
                f"[risk] note: with risk_per_trade={self.limits.risk_per_trade:.1%} and "
                f"max_position_pct={self.limits.max_position_pct:.0%}, the exposure cap binds "
                f"for any stop closer than {breakeven_stop_pct:.1%} of price. Typical 2xATR "
                f"crypto stops are 1-3%, so effective risk per trade will usually be well "
                f"below the configured value."
            )

    # -- accounting --------------------------------------------------------
    def roll_day_if_needed(self) -> bool:
        today = _utc_day()
        if today != self.state.day:
            self.state.day = today
            self.state.day_start_equity = self.state.equity
            self.state.halted_today = False
            self.state.realised_today = 0.0
            self.state.trades_today = 0
            return True
        return False

    def update_equity(self, equity: float) -> None:
        self.state.equity = equity
        self.state.peak_equity = max(self.state.peak_equity, equity)
        self._check_limits()

    def record_realised(self, pnl: float) -> None:
        self.state.realised_today += pnl
        self.state.trades_today += 1
        self.state.equity += pnl
        self.state.peak_equity = max(self.state.peak_equity, self.state.equity)
        self._check_limits()

    def _check_limits(self) -> None:
        s, l = self.state, self.limits

        dd = 1.0 - s.equity / max(s.peak_equity, 1e-9)
        if dd >= l.max_total_drawdown and not s.kill_switch:
            s.kill_switch = True
            s.kill_reason = (
                f"total drawdown {dd:.1%} exceeded limit {l.max_total_drawdown:.1%}"
            )
            self.log(f"[risk] KILL SWITCH: {s.kill_reason}")

        day_loss = 1.0 - s.equity / max(s.day_start_equity, 1e-9)
        if day_loss >= l.daily_loss_limit and not s.halted_today:
            s.halted_today = True
            self.log(f"[risk] daily loss limit hit ({day_loss:.1%}); halted until UTC midnight")

    # -- gating ------------------------------------------------------------
    def can_open(self, symbol: str, notional: float) -> Tuple[bool, str]:
        s, l = self.state, self.limits
        self.roll_day_if_needed()

        if s.kill_switch:
            return False, f"kill switch active: {s.kill_reason}"
        if s.halted_today:
            return False, "daily loss limit reached"
        if symbol in self.positions:
            return False, "position already open in this symbol"
        if len(self.positions) >= l.max_concurrent_positions:
            return False, f"max concurrent positions ({l.max_concurrent_positions})"

        gross = sum(p.notional() for p in self.positions.values()) + notional
        if gross > s.equity * l.max_gross_exposure:
            return False, (
                f"gross exposure {gross/max(s.equity,1e-9):.0%} would exceed "
                f"{l.max_gross_exposure:.0%}"
            )
        if notional > s.equity * l.max_position_pct:
            return False, f"position would exceed {l.max_position_pct:.0%} of equity"

        ok, why = self._correlation_ok(symbol, notional)
        if not ok:
            return False, why
        return True, ""

    def _correlation_ok(self, symbol: str, notional: float) -> Tuple[bool, str]:
        """Block adding to a bet you already have under another name.

        Three long positions in BTC, ETH and SOL during a crypto selloff are one
        position with three tickers. Without this check, "max 3 positions" is
        3x the intended risk rather than diversification.
        """
        if not self.positions or symbol not in self._returns:
            return True, ""

        target = self._returns[symbol]
        correlated_notional = 0.0
        for sym, pos in self.positions.items():
            other = self._returns.get(sym)
            if other is None:
                continue
            joined = pd.concat([target, other], axis=1).dropna()
            if len(joined) < 30:
                continue
            c = float(joined.iloc[:, 0].corr(joined.iloc[:, 1]))
            if np.isfinite(c) and abs(c) >= self.limits.correlation_threshold:
                correlated_notional += pos.notional()

        if correlated_notional + notional > self.state.equity * self.limits.max_correlated_exposure:
            return False, (
                f"correlated exposure would exceed "
                f"{self.limits.max_correlated_exposure:.0%} of equity"
            )
        return True, ""

    def set_returns(self, symbol: str, closes: pd.Series) -> None:
        self._returns[symbol] = closes.pct_change().dropna().tail(720)

    # -- sizing ------------------------------------------------------------
    def size_position(
        self, equity: float, entry_price: float, stop_price: float,
        confidence: float = 1.0,
    ) -> Tuple[float, float]:
        """Return (qty, risk_cash).

        Size solves back from the stop: risk_cash / stop_distance. That is what
        makes the dollar risk identical across a calm BTC trade and a wild SOL
        trade, which fixed-fraction-of-equity sizing does not do.
        """
        dist = abs(entry_price - stop_price)
        if dist <= 0 or entry_price <= 0:
            return 0.0, 0.0

        conf = float(np.clip(confidence, 0.0, 1.0))
        risk_cash = equity * self.limits.risk_per_trade * conf
        qty = risk_cash / dist

        # Cap by position size limit and by available equity (no leverage).
        max_notional = min(equity * self.limits.max_position_pct,
                           equity * self.limits.max_gross_exposure)
        gross_used = sum(p.notional() for p in self.positions.values())
        room = max(0.0, equity * self.limits.max_gross_exposure - gross_used)
        max_notional = min(max_notional, room)

        if qty * entry_price > max_notional:
            # The exposure cap binds. This is common and important: on a spot
            # account with no leverage, a tight stop demands a position larger
            # than the cap allows, so your ACTUAL risk lands below the
            # risk_per_trade you configured. See effective_risk_pct().
            qty = max_notional / entry_price
            risk_cash = qty * dist
            self._last_size_capped = True
        else:
            self._last_size_capped = False

        return float(max(qty, 0.0)), float(risk_cash)

    def effective_risk_pct(self, entry_price: float, stop_price: float) -> float:
        """Fraction of equity actually at risk for this trade, after caps.

        Worth understanding rather than glossing over. With risk_per_trade at
        5% and max_position_pct at 40%, the cap binds whenever the stop is
        closer than 12.5% of price. A 2xATR stop on 15m crypto is typically
        1-3% of price, so in practice the cap binds on almost every trade and
        the real risk per trade is nearer 0.5-1% than the configured 5%.

        That is not a bug -- it is the no-leverage constraint doing its job --
        but it means the aggressive setting you chose is partly self-limiting
        on spot. The dashboard shows this number next to the configured one so
        the gap is visible instead of assumed.
        """
        dist = abs(entry_price - stop_price)
        if dist <= 0 or entry_price <= 0:
            return 0.0
        eq = max(self.state.equity, 1e-9)
        qty, risk_cash = self.size_position(eq, entry_price, stop_price, 1.0)
        return float(risk_cash / eq)

    # -- positions ---------------------------------------------------------
    def open_position(self, pos: Position) -> None:
        self.positions[pos.symbol] = pos

    def close_position(self, symbol: str, pnl: float) -> Optional[Position]:
        pos = self.positions.pop(symbol, None)
        if pos is not None:
            self.record_realised(pnl)
        return pos

    def mark(self, symbol: str, price: float) -> None:
        pos = self.positions.get(symbol)
        if pos is None:
            return
        pos.last_price = price
        pos.unrealised = (price - pos.entry_price) * pos.qty * pos.direction

    def total_unrealised(self) -> float:
        return sum(p.unrealised for p in self.positions.values())

    def reset_kill_switch(self) -> None:
        """Manual only, by design. An automatic reset after a 30% drawdown is
        how a bad day becomes a worse week."""
        self.state.kill_switch = False
        self.state.kill_reason = ""
        self.state.peak_equity = self.state.equity
        self.log("[risk] kill switch manually reset")

    def snapshot(self) -> dict:
        s, l = self.state, self.limits
        gross = sum(p.notional() for p in self.positions.values())
        return {
            "equity": s.equity,
            "peak_equity": s.peak_equity,
            "unrealised": self.total_unrealised(),
            "drawdown": 1.0 - s.equity / max(s.peak_equity, 1e-9),
            "max_drawdown_limit": l.max_total_drawdown,
            "day_pnl": s.equity - s.day_start_equity,
            "day_pnl_pct": s.equity / max(s.day_start_equity, 1e-9) - 1.0,
            "daily_loss_limit": l.daily_loss_limit,
            "distance_to_daily_halt": (
                l.daily_loss_limit - (1.0 - s.equity / max(s.day_start_equity, 1e-9))
            ),
            "halted_today": s.halted_today,
            "kill_switch": s.kill_switch,
            "kill_reason": s.kill_reason,
            "trades_today": s.trades_today,
            "open_positions": len(self.positions),
            "max_positions": l.max_concurrent_positions,
            "gross_exposure": gross,
            "gross_exposure_pct": gross / max(s.equity, 1e-9),
            "risk_per_trade": l.risk_per_trade,
            # What 5% actually means once the no-leverage exposure cap applies.
            "effective_risk_per_trade_2pct_stop": self.effective_risk_pct(100.0, 98.0),
            "cap_binds_below_stop_pct": l.risk_per_trade / max(l.max_position_pct, 1e-9),
            "max_position_pct": l.max_position_pct,
            "clamp_notes": self.clamp_notes,
            "positions": [p.to_dict() for p in self.positions.values()],
        }


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def limits_from_config(cfg: dict) -> RiskLimits:
    r = cfg.get("risk", {})
    return RiskLimits(
        starting_equity=float(r.get("starting_equity", 500.0)),
        risk_per_trade=float(r.get("risk_per_trade", 0.05)),
        daily_loss_limit=float(r.get("daily_loss_limit", 0.10)),
        max_concurrent_positions=int(r.get("max_concurrent_positions", 3)),
        max_gross_exposure=float(r.get("max_gross_exposure", 1.0)),
        max_position_pct=float(r.get("max_position_pct", 0.40)),
        max_total_drawdown=float(r.get("max_total_drawdown", 0.30)),
        correlation_threshold=float(r.get("correlation_threshold", 0.80)),
        max_correlated_exposure=float(r.get("max_correlated_exposure", 0.60)),
    )
