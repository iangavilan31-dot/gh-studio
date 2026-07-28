#!/usr/bin/env python3
"""Serve the dashboard against seeded demo data, with no exchange connection.

Lets you see and click through the whole UI before downloading a single candle.
Everything shown is fabricated -- see seed_demo.py.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import config as C
from engine.api.server import serve
from engine.backtest.engine import exec_from_config
from engine.live.state import Store
from engine.risk.manager import Position, RiskManager, limits_from_config


class DemoRunner:
    """Stands in for LiveRunner, exposing only what the API reads."""

    mode = "paper"
    running = True

    def __init__(self, cfg):
        self.store = Store(cfg.get("live", {}).get("state_db", "./state/quantdesk.db"))
        self.risk = RiskManager(limits_from_config(cfg), log=lambda m: None)
        self.timeframe = C.primary_timeframe(cfg)
        self.ex = exec_from_config(cfg)
        self.bars = {}

        pts = self.store.equity_curve("paper", 100_000)
        if pts:
            self.risk.update_equity(pts[-1]["equity"])
            self.risk.state.peak_equity = max(p["equity"] for p in pts)
            self.risk.state.day_start_equity = pts[max(0, len(pts) - 96)]["equity"]
        self.risk.state.trades_today = 4

        now = datetime.now(timezone.utc)
        for sym, d, qty, entry, last in [
            ("ETH/USD", 1, 0.0412, 3118.20, 3141.85),
            ("SOL/USD", -1, 0.612, 178.44, 176.10),
        ]:
            p = Position(symbol=sym, strategy="ts_momentum", direction=d, qty=qty,
                         entry_price=entry, stop_price=entry * (1 - d * 0.021),
                         target_price=entry * (1 + d * 0.031), entry_time=now,
                         risk_cash=abs(qty * entry * 0.021), last_price=last)
            p.unrealised = (last - entry) * qty * d
            self.risk.open_position(p)

        rng = np.random.default_rng(4)
        self.scanner_rows = sorted([
            {"symbol": s, "price": px,
             "natr": float(abs(rng.normal(0.012, 0.006))),
             "volume_z": float(rng.normal(0.4, 1.6)),
             "ret_1h": float(rng.normal(0, 0.012)),
             "ret_24h": float(rng.normal(0, 0.045)),
             "efficiency": float(abs(rng.normal(0.32, 0.15))),
             "signal": int(rng.choice([0, 0, 1, -1])),
             "heat": float(abs(rng.normal(1.5, 1.0)))}
            for s, px in [("BTC/USD", 94120.0), ("ETH/USD", 3141.85), ("SOL/USD", 176.10),
                          ("XRP/USD", 2.31), ("DOGE/USD", 0.3142), ("LTC/USD", 104.2),
                          ("LINK/USD", 21.44), ("AVAX/USD", 34.18), ("ADA/USD", 0.912),
                          ("INJ/USD", 22.7), ("SUI/USD", 3.44), ("APT/USD", 8.91)]
        ], key=lambda r: -r["heat"])

        self.latest_signals = {r["symbol"]: {"signal": r["signal"]} for r in self.scanner_rows}
        self.last_tick = now.isoformat()

    def snapshot(self) -> dict:
        return {
            "mode": self.mode, "running": self.running, "last_tick": self.last_tick,
            "timeframe": self.timeframe,
            "symbols": [r["symbol"] for r in self.scanner_rows],
            "strategies": [], "paper_days": self.store.paper_days(),
            "risk": self.risk.snapshot(), "signals": self.latest_signals,
            "scanner": self.scanner_rows,
        }

    def stop(self):
        self.running = False

    def _close(self, *a, **k):
        pass


if __name__ == "__main__":
    cfg = C.load_config()
    api = cfg.get("api", {})
    print("DEMO SERVER -- all data is fabricated")
    print(f"http://{api.get('host','127.0.0.1')}:{api.get('port',8787)}")
    serve(DemoRunner(cfg), cfg, api.get("host", "127.0.0.1"), int(api.get("port", 8787)))
