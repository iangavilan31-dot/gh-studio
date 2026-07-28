#!/usr/bin/env python3
"""Populate the state DB and results files with synthetic data.

Purely for exercising the dashboard without waiting two weeks for real paper
trades to accumulate. The numbers are fabricated and are labelled as such --
run `rm -rf state results` before starting a real paper run so demo trades can
never contaminate the go-live gate.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.live.state import Store

RESULTS = Path("./results")
RESULTS.mkdir(exist_ok=True)

SYMS = ["BTC/USD", "ETH/USD", "SOL/USD", "LINK/USD", "AVAX/USD", "DOGE/USD"]
STRATS = ["ts_momentum", "supertrend", "zscore_reversion", "donchian",
          "vwap_reversion", "liquidation_cascade", "squeeze_breakout"]


def main() -> None:
    rng = np.random.default_rng(17)
    store = Store("./state/quantdesk.db")

    start = datetime.now(timezone.utc) - timedelta(days=9)
    store.set_meta("paper_start", start.isoformat())

    equity = 500.0
    t = start
    # A mildly negative-expectancy tape, which is the realistic default. If the
    # demo showed a soaring curve it would teach exactly the wrong intuition.
    for i in range(9 * 96):
        t += timedelta(minutes=15)
        equity *= 1.0 + rng.normal(-0.00004, 0.0035)
        store.record_equity("paper", equity, 0.0, int(rng.random() < 0.3))

    n_trades = 62
    for i in range(n_trades):
        sym = SYMS[int(rng.integers(0, len(SYMS)))]
        strat = STRATS[int(rng.integers(0, len(STRATS)))]
        direction = int(rng.choice([1, -1]))
        entry_t = start + timedelta(minutes=int(rng.integers(0, 9 * 1440)))
        bars = int(rng.integers(3, 90))
        exit_t = entry_t + timedelta(minutes=15 * bars)

        win = rng.random() < 0.44
        r = float(rng.uniform(0.8, 2.4)) if win else -float(rng.uniform(0.7, 1.05))
        risk_cash = equity * 0.008
        pnl = r * risk_cash
        entry_px = float(rng.uniform(20, 60000))
        reason = "target" if win else ("stop" if rng.random() < 0.8 else "time")

        store.record_trade("paper", {
            "symbol": sym, "strategy": strat, "timeframe": "15m",
            "direction": direction, "qty": abs(risk_cash / (entry_px * 0.02)),
            "entry_time": entry_t.isoformat(), "entry_price": entry_px,
            "exit_time": exit_t.isoformat(),
            "exit_price": entry_px * (1 + direction * r * 0.02),
            "stop_price": entry_px * (1 - direction * 0.02),
            "target_price": entry_px * (1 + direction * 0.03),
            "pnl": pnl, "pnl_r": r, "fees": abs(pnl) * 0.12,
            "bars_held": bars, "exit_reason": reason,
            "mae_r": -abs(float(rng.uniform(0.1, 0.95))),
            "mfe_r": abs(float(rng.uniform(0.2, 2.0))),
        })

        store.record_order("paper", {
            "id": f"demo{i:04d}", "created_at": exit_t.isoformat(), "symbol": sym,
            "side": "buy" if direction > 0 else "sell",
            "qty": abs(risk_cash / (entry_px * 0.02)),
            "status": "filled" if rng.random() > 0.08 else "partial",
            "filled_qty": abs(risk_cash / (entry_px * 0.02)),
            "avg_fill_price": entry_px, "fee": abs(pnl) * 0.12, "note": "",
        })

    for kind, msg, lvl in [
        ("start", "runner started (paper)", "info"),
        ("open", "buy ETH/USD @ 3120.44 via ts_momentum (tsmom)", "info"),
        ("close", "ETH/USD stop -4.11 (-0.98R)", "info"),
        ("entry_blocked", "SOL/USD: correlated exposure would exceed 60% of equity", "info"),
        ("order_rejected", "DOGE/USD entry: simulated exchange rejection", "warn"),
    ]:
        store.log_event(lvl, kind, msg)

    # Backtest + walk-forward result files.
    bt_rows, wf_rows = [], []
    for strat in STRATS:
        for sym in SYMS[:4]:
            sharpe = float(rng.normal(-0.4, 1.1))
            n = int(rng.integers(25, 260))
            pf = max(0.2, 1.0 + sharpe * 0.16)
            exp_r = sharpe * 0.05
            dd = float(rng.uniform(0.12, 0.62))
            fees = float(rng.uniform(0.2, 1.4))
            verdict = ("LIKELY NOISE" if sharpe < 0.6 else
                       "FEE BOUND" if fees > 0.5 else
                       "CANDIDATE" if sharpe > 1.2 else "MARGINAL")
            curve = list(np.cumprod(1 + rng.normal(sharpe * 0.0002, 0.006, 120)) * 500)
            bt_rows.append({
                "strategy": strat, "symbol": sym, "timeframe": "15m",
                "family": "trend", "verdict": verdict, "why": "synthetic demo row",
                "metrics": {
                    "n_trades": n, "sharpe": sharpe, "profit_factor": pf,
                    "expectancy_r": exp_r, "max_drawdown": dd,
                    "fees_pct_of_gross": fees, "win_rate": float(rng.uniform(0.35, 0.6)),
                    "deflated_sharpe": float(np.clip(rng.random(), 0, 0.99)),
                },
                "equity_tail": curve,
            })

    for strat in STRATS[:5]:
        sharpe = float(rng.normal(0.1, 0.8))
        folds = [{
            "index": k, "train_start": "2024-01-01", "test_start": "2024-04-01",
            "test_end": "2024-07-01", "best_params": {"lookback": int(rng.choice([48, 96, 168]))},
            "train_metric": float(rng.uniform(0.5, 2.5)),
            "test_sharpe": float(rng.normal(sharpe, 0.9)),
            "test_return": float(rng.normal(-0.01, 0.09)),
            "test_pf": float(rng.uniform(0.6, 1.5)),
            "n_trades": int(rng.integers(12, 70)),
        } for k in range(6)]
        eq = list(np.cumprod(1 + rng.normal(sharpe * 0.0002, 0.007, 220)) * 500)
        wf_rows.append({
            "strategy": strat, "symbol": "BTC/USD", "timeframe": "15m",
            "n_folds": len(folds), "total_trials": int(rng.integers(120, 900)),
            "param_stability": float(rng.uniform(0.15, 0.8)),
            "efficiency": float(rng.uniform(-0.4, 0.9)),
            "verdict": "LIKELY NOISE" if sharpe < 0.8 else "MARGINAL",
            "why": "synthetic demo row",
            "folds": folds,
            "metrics": {
                "n_trades": int(rng.integers(60, 300)), "sharpe": sharpe,
                "deflated_sharpe": float(np.clip(rng.random() * 0.9, 0, 0.99)),
                "profit_factor": max(0.3, 1 + sharpe * 0.15),
                "expectancy_r": sharpe * 0.04,
                "max_drawdown": float(rng.uniform(0.15, 0.5)),
                "fees_pct_of_gross": float(rng.uniform(0.2, 0.9)),
            },
            "equity": eq,
            "equity_ts": [(start + timedelta(hours=i)).isoformat() for i in range(len(eq))],
        })

    bt_rows.sort(key=lambda r: -r["metrics"]["sharpe"])
    wf_rows.sort(key=lambda r: -r["metrics"]["deflated_sharpe"])

    (RESULTS / "backtests.json").write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(),
        "n_combos": len(bt_rows), "results": bt_rows, "best": bt_rows[0],
    }))
    (RESULTS / "walkforward.json").write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(), "results": wf_rows,
    }))
    (RESULTS / "arbitrage.json").write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(), "taker_bps": 26.0,
        "rows": [
            {"symbol": s, "buy_venue": "kraken", "buy": p, "sell_venue": "coinbase",
             "sell": p * (1 + float(rng.normal(0, 0.0006))),
             "gross_bps": float(rng.normal(3, 8)),
             "net_bps": float(rng.normal(3, 8)) - 52.0, "profitable": False}
            for s, p in [("BTC/USD", 94000.0), ("ETH/USD", 3120.0), ("SOL/USD", 178.0),
                         ("LINK/USD", 21.4), ("AVAX/USD", 34.2)]
        ],
    }))

    print(f"seeded {n_trades} paper trades, 9 days of equity, "
          f"{len(bt_rows)} backtest rows, {len(wf_rows)} walk-forward rows")
    print("DEMO DATA ONLY -- run `rm -rf state results` before a real paper run")


if __name__ == "__main__":
    main()
