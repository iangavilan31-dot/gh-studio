"""FastAPI bridge between the Python engine and the React dashboard.

Bound to 127.0.0.1 by default. This process can move real money once the gate
passes, so it must not listen on a public interface. If you deploy to a VPS,
reach it over an SSH tunnel rather than opening the port.

Endpoints:

    GET  /api/status            runner state, risk snapshot, positions
    GET  /api/equity            equity curve
    GET  /api/trades            closed trades
    GET  /api/orders            order feed
    GET  /api/events            engine log
    GET  /api/scanner           volatility/volume watchlist
    GET  /api/backtests         stored backtest + walk-forward results
    GET  /api/strategies        registry with descriptions
    GET  /api/gate              go-live gate evaluation
    GET  /api/arbitrage         cross-exchange spread monitor
    POST /api/control/{action}  start | stop | flatten | reset_kill
    WS   /ws                    push updates every 2s
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ..backtest import metrics as M
from ..risk.gate import criteria_from_config, evaluate
from ..strategies import all_strategies

RESULTS_DIR = Path("./results")


def create_app(runner=None, cfg: Optional[dict] = None) -> FastAPI:
    app = FastAPI(title="QuantDesk", version="1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    cfg = cfg or {}
    state: Dict[str, Any] = {"runner": runner, "cfg": cfg}

    def _runner():
        r = state.get("runner")
        if r is None:
            raise HTTPException(503, "runner not attached; start it with `python cli.py live`")
        return r

    # -- read endpoints ----------------------------------------------------
    @app.get("/api/status")
    def status():
        r = state.get("runner")
        if r is None:
            return {"attached": False, "mode": None, "running": False}
        snap = r.snapshot()
        snap["attached"] = True
        return snap

    @app.get("/api/equity")
    def equity(mode: Optional[str] = None, limit: int = 5000):
        r = _runner()
        return {"points": r.store.equity_curve(mode or r.mode, limit)}

    @app.get("/api/trades")
    def trades(mode: Optional[str] = None, limit: int = 500):
        r = _runner()
        rows = r.store.trades(mode or r.mode, limit)
        return {"trades": rows, "metrics": _trade_metrics(rows, r)}

    @app.get("/api/orders")
    def orders(limit: int = 100):
        return {"orders": _runner().store.orders(limit)}

    @app.get("/api/events")
    def events(limit: int = 200):
        return {"events": _runner().store.events(limit)}

    @app.get("/api/scanner")
    def scanner():
        r = state.get("runner")
        return {"rows": r.scanner_rows if r else []}

    @app.get("/api/strategies")
    def strategies():
        out = []
        for name, cls in sorted(all_strategies().items()):
            probe = cls()
            out.append({
                "name": name,
                "family": cls.family,
                "timeframes": list(cls.timeframes),
                "allow_short": cls.allow_short,
                "description": (cls.description or "").strip(),
                "params": {k: {"default": v, "grid": probe.grid().get(k, [])}
                           for k, v in probe.p.items()},
                "backtestable": not getattr(cls, "requires_l2", False),
                "requires_funding": getattr(cls, "requires_funding", False),
            })
        return {"strategies": out}

    @app.get("/api/backtests")
    def backtests():
        f = RESULTS_DIR / "backtests.json"
        if not f.exists():
            return {"results": [], "note": "no results yet -- run `python cli.py backtest`"}
        try:
            return json.loads(f.read_text())
        except Exception as e:
            raise HTTPException(500, f"could not read results: {e}")

    @app.get("/api/walkforward")
    def walkforward():
        f = RESULTS_DIR / "walkforward.json"
        if not f.exists():
            return {"results": [], "note": "no results yet -- run `python cli.py walkforward`"}
        return json.loads(f.read_text())

    @app.get("/api/gate")
    def gate():
        r = state.get("runner")
        crit = criteria_from_config(state["cfg"])
        if r is None:
            return evaluate(crit, None, 0.0).to_dict()

        rows = r.store.trades("paper", 10_000)
        paper_m = _metrics_from_rows(rows, r)
        result = evaluate(crit, paper_m, r.store.paper_days(), _backtest_reference())
        d = result.to_dict()
        d["paper_days"] = r.store.paper_days()
        d["min_paper_days"] = crit.min_paper_days
        d["n_paper_trades"] = len(rows)
        return d

    @app.get("/api/arbitrage")
    def arbitrage():
        """Cross-exchange spread monitor.

        Shows the same asset's price on multiple venues and the spread net of
        round-trip taker fees. Expect the net column to be negative almost
        always -- that is the honest answer about retail cross-venue arb, and
        seeing it beats assuming it.
        """
        f = RESULTS_DIR / "arbitrage.json"
        if not f.exists():
            return {"rows": [], "note": "run `python cli.py arb` to sample venue spreads"}
        return json.loads(f.read_text())

    # -- control -----------------------------------------------------------
    @app.post("/api/control/{action}")
    def control(action: str):
        r = _runner()
        if action == "stop":
            r.stop()
            return {"ok": True, "message": "runner stopping"}
        if action == "start":
            r.running = True
            return {"ok": True, "message": "runner resumed"}
        if action == "flatten":
            # Panic button: close everything at market, now. Deliberately does
            # not consult the strategies -- if you pressed this, you want out.
            from .. import indicators as ta

            n = 0
            for sym in list(r.risk.positions):
                df = r.bars.get(sym)
                if df is None or df.empty:
                    continue
                price = float(df["close"].iloc[-1])
                atr_val = float(ta.atr(df, r.ex.atr_period).iloc[-1])
                r._close(sym, price, atr_val, "manual_flatten")
                n += 1
            r.store.log_event("warn", "flatten", f"manual flatten closed {n} positions")
            return {"ok": True, "message": f"flattened {n} positions"}
        if action == "reset_kill":
            r.risk.reset_kill_switch()
            return {"ok": True, "message": "kill switch reset"}
        raise HTTPException(400, f"unknown action {action!r}")

    # -- websocket ---------------------------------------------------------
    @app.websocket("/ws")
    async def ws(sock: WebSocket):
        await sock.accept()
        try:
            while True:
                r = state.get("runner")
                payload = {"attached": False} if r is None else {
                    "attached": True,
                    "status": r.snapshot(),
                    "orders": r.store.orders(20),
                    "events": r.store.events(30),
                }
                await sock.send_json(payload)
                await asyncio.sleep(2)
        except WebSocketDisconnect:
            return
        except Exception:
            return

    # -- helpers -----------------------------------------------------------
    def _backtest_reference() -> Optional[M.Metrics]:
        f = RESULTS_DIR / "backtests.json"
        if not f.exists():
            return None
        try:
            data = json.loads(f.read_text())
            best = data.get("best")
            if not best:
                return None
            m = M.Metrics()
            for k, v in (best.get("metrics") or {}).items():
                if hasattr(m, k) and v is not None:
                    setattr(m, k, v)
            return m
        except Exception:
            return None

    def _metrics_from_rows(rows: List[dict], r) -> Optional[M.Metrics]:
        if not rows:
            return None
        import pandas as pd

        pts = r.store.equity_curve(r.mode, 100_000)
        if len(pts) < 3:
            return None
        eq = pd.Series([p["equity"] for p in pts],
                       index=pd.to_datetime([p["ts"] for p in pts], utc=True))

        class _T:
            pass

        trades = []
        for row in rows:
            if row.get("exit_time") is None:
                continue
            t = _T()
            t.pnl = float(row.get("pnl") or 0.0)
            t.pnl_r = float(row.get("pnl_r") or 0.0)
            t.fees = float(row.get("fees") or 0.0)
            t.bars_held = int(row.get("bars_held") or 0)
            t.entry_price = float(row.get("entry_price") or 0.0)
            t.qty = float(row.get("qty") or 0.0)
            trades.append(t)

        return M.compute(eq, trades, r.timeframe,
                         r.risk.limits.starting_equity, None, n_trials=1)

    def _trade_metrics(rows: List[dict], r) -> dict:
        m = _metrics_from_rows(rows, r)
        return m.to_dict() if m else {}

    return app


def serve(runner=None, cfg: Optional[dict] = None,
          host: str = "127.0.0.1", port: int = 8787) -> None:
    import uvicorn
    uvicorn.run(create_app(runner, cfg), host=host, port=port, log_level="warning")
