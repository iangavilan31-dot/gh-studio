"""Brokers: a paper simulator and a real ccxt broker behind the same interface.

The paper broker applies the SAME cost model as the backtester -- identical
fee rate, identical spread, identical ATR-scaled slippage. That is the whole
point: if paper results and backtest results disagree, the disagreement is
information about your strategy rather than an artifact of two different
simulators. It additionally models partial fills and occasional rejections,
which the backtester does not, so paper is strictly the more pessimistic of the
two.

The live broker is real. It places real orders with real money. It refuses to
initialise unless the gate has passed AND `QUANTDESK_ALLOW_LIVE=1` is set in the
environment -- two independent switches, so no single mistake can arm it.
"""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np

from ..backtest.engine import CostModel


@dataclass
class Order:
    id: str
    symbol: str
    side: str            # "buy" | "sell"
    qty: float
    order_type: str      # "market" | "limit"
    price: Optional[float] = None
    status: str = "open"  # open | filled | partial | rejected | cancelled
    filled_qty: float = 0.0
    avg_fill_price: float = 0.0
    fee: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class Broker:
    name = "base"

    def market_order(self, symbol: str, side: str, qty: float,
                     ref_price: float, atr: float = 0.0) -> Order:
        raise NotImplementedError

    def balance(self) -> float:
        raise NotImplementedError

    def recent_orders(self, n: int = 50) -> List[dict]:
        raise NotImplementedError


class PaperBroker(Broker):
    name = "paper"

    def __init__(self, costs: CostModel, starting_cash: float = 500.0,
                 partial_fill_prob: float = 0.15, reject_prob: float = 0.01,
                 seed: int = 3, log=print):
        self.costs = costs
        self.cash = starting_cash
        self.starting_cash = starting_cash
        self.partial_fill_prob = partial_fill_prob
        self.reject_prob = reject_prob
        self.rng = np.random.default_rng(seed)
        self.orders: List[Order] = []
        self.log = log

    def market_order(self, symbol: str, side: str, qty: float,
                     ref_price: float, atr: float = 0.0) -> Order:
        oid = uuid.uuid4().hex[:12]
        o = Order(id=oid, symbol=symbol, side=side, qty=qty, order_type="market",
                  price=ref_price)

        if qty <= 0 or ref_price <= 0:
            o.status = "rejected"
            o.note = "invalid quantity or price"
            self.orders.append(o)
            return o

        # Exchanges do reject orders -- rate limits, momentary insufficient
        # balance, maintenance. A strategy that assumes every order fills is
        # fragile in a way paper trading should expose, not hide.
        if self.rng.random() < self.reject_prob:
            o.status = "rejected"
            o.note = "simulated exchange rejection"
            self.orders.append(o)
            return o

        direction = 1 if side == "buy" else -1
        fill_px = self.costs.fill_price(symbol, ref_price, atr, direction)

        filled = qty
        if self.rng.random() < self.partial_fill_prob:
            filled = qty * float(self.rng.uniform(0.4, 0.95))
            o.status = "partial"
            o.note = "simulated partial fill"
        else:
            o.status = "filled"

        fee = abs(fill_px * filled) * self.costs.fee_rate()
        o.filled_qty = float(filled)
        o.avg_fill_price = float(fill_px)
        o.fee = float(fee)

        self.cash -= direction * fill_px * filled
        self.cash -= fee
        self.orders.append(o)
        return o

    def balance(self) -> float:
        return self.cash

    def recent_orders(self, n: int = 50) -> List[dict]:
        return [o.to_dict() for o in self.orders[-n:]][::-1]


class CcxtBroker(Broker):
    """Real money. Two independent safety switches guard construction."""

    name = "live"

    def __init__(self, exchange, quote: str = "USD", gate_passed: bool = False, log=print):
        if not gate_passed:
            raise PermissionError(
                "live broker refused: the performance gate has not passed. "
                "Run `python cli.py gate` to see which criteria are failing."
            )
        if os.getenv("QUANTDESK_ALLOW_LIVE") != "1":
            raise PermissionError(
                "live broker refused: set QUANTDESK_ALLOW_LIVE=1 in your environment "
                "to confirm you intend to trade real money."
            )
        if not getattr(exchange, "apiKey", None):
            raise PermissionError(
                "live broker refused: no API credentials found. "
                "Set EXCHANGE_API_KEY and EXCHANGE_API_SECRET in .env"
            )
        self.ex = exchange
        self.quote = quote
        self.log = log
        self.orders: List[Order] = []
        log("[broker] LIVE MODE ARMED -- orders will use real funds")

    def market_order(self, symbol: str, side: str, qty: float,
                     ref_price: float, atr: float = 0.0) -> Order:
        oid = uuid.uuid4().hex[:12]
        o = Order(id=oid, symbol=symbol, side=side, qty=qty, order_type="market",
                  price=ref_price)
        try:
            resp = self.ex.create_order(symbol, "market", side, qty)
            o.status = "filled" if resp.get("status") in (None, "closed", "filled") else "open"
            o.filled_qty = float(resp.get("filled") or qty)
            o.avg_fill_price = float(resp.get("average") or resp.get("price") or ref_price)
            fee = resp.get("fee") or {}
            o.fee = float(fee.get("cost") or 0.0)
            o.note = str(resp.get("id", ""))
        except Exception as e:
            o.status = "rejected"
            o.note = f"{type(e).__name__}: {e}"
            self.log(f"[broker] order rejected: {o.note}")
        self.orders.append(o)
        return o

    def balance(self) -> float:
        try:
            bal = self.ex.fetch_balance()
            return float(bal.get("free", {}).get(self.quote, 0.0))
        except Exception as e:
            self.log(f"[broker] balance fetch failed: {e}")
            return 0.0

    def recent_orders(self, n: int = 50) -> List[dict]:
        return [o.to_dict() for o in self.orders[-n:]][::-1]
