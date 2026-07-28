#!/usr/bin/env python3
"""QuantDesk command line.

    python cli.py download                 fetch and cache market history
    python cli.py backtest                 backtest every strategy x symbol
    python cli.py walkforward              walk-forward validation (the real test)
    python cli.py montecarlo               stress-test the surviving strategies
    python cli.py report                   print the leaderboard
    python cli.py gate                     check whether live trading is permitted
    python cli.py arb                      sample cross-exchange spreads
    python cli.py live                     start paper (or live) trading + API
    python cli.py serve                    dashboard API only, no trading

Suggested order the first time:

    download  ->  backtest  ->  walkforward  ->  montecarlo  ->  live
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

from engine import config as C
from engine.backtest import metrics as M
from engine.backtest import montecarlo as MC
from engine.backtest.walkforward import holdout_split, walk_forward
from engine.data.feed import load_universe
from engine.risk.gate import criteria_from_config, evaluate
from engine.strategies import all_strategies
from engine.strategies.base import Context

RESULTS = Path("./results")
RESULTS.mkdir(exist_ok=True)


def log(msg: str = "") -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# download
# ---------------------------------------------------------------------------

def cmd_download(args, cfg) -> None:
    feed = C.build_feed(cfg)
    syms = C.universe(cfg, include_scanner=True)
    tfs = args.timeframes or C.timeframes(cfg)
    years = float(cfg.get("data", {}).get("history_years", 3))

    log(f"exchange: {feed.exchange_id}   symbols: {len(syms)}   timeframes: {tfs}")
    log(f"history: {years}y   cache: {feed.cache}\n")

    for tf in tfs:
        log(f"[{tf}]")
        for s in syms:
            try:
                df = feed.download(s, tf, years, force=args.force, log=lambda m: None)
                if len(df):
                    log(f"  {s:<12} {len(df):>7} bars  {df.index[0].date()} -> {df.index[-1].date()}")
                else:
                    log(f"  {s:<12} no data")
            except Exception as e:
                log(f"  {s:<12} FAILED: {type(e).__name__}: {e}")
    log("\ndone.")


# ---------------------------------------------------------------------------
# backtest
# ---------------------------------------------------------------------------

def _load_all(cfg, tfs: List[str]) -> Dict[str, Dict[str, pd.DataFrame]]:
    feed = C.build_feed(cfg)
    syms = C.universe(cfg)
    data = {}
    for tf in tfs:
        d = load_universe(feed, syms, tf, cached_only=True, log=lambda m: None)
        if d:
            data[tf] = d
    return data


def cmd_backtest(args, cfg) -> None:
    tfs = args.timeframes or C.timeframes(cfg)
    data = _load_all(cfg, tfs)
    if not data:
        log("no cached data. run `python cli.py download` first.")
        return

    strategies = C.selected_strategies(cfg)
    if args.strategy:
        strategies = {k: v for k, v in strategies.items() if k in args.strategy}

    bench_sym = "BTC/USD"
    holdout_frac = float(cfg.get("backtest", {}).get("holdout_frac", 0.20))
    rows: List[dict] = []

    total = sum(len(d) for d in data.values()) * len(strategies)
    done = 0
    log(f"backtesting {len(strategies)} strategies over {total} strategy-symbol-timeframe combos")
    log("(train portion only; holdout is reserved and not touched here)\n")

    for tf, frames in data.items():
        bt = C.build_backtester(cfg)
        for sym, df in frames.items():
            train, _ = holdout_split(df, holdout_frac)
            ctx = Context(symbol=sym, timeframe=tf,
                          peers={k: v for k, v in frames.items() if k != sym},
                          benchmark=frames.get(bench_sym))

            for name, strat in strategies.items():
                done += 1
                if tf not in strat.timeframes:
                    continue
                if getattr(type(strat), "requires_l2", False):
                    continue        # cannot be honestly backtested from OHLCV
                try:
                    sigs = strat.generate(train, ctx)
                    res = bt.run(train, sigs, sym, name, tf)
                    m = M.compute(res.equity, res.trades, tf,
                                  bt.starting_equity, res.exposure, n_trials=1)
                except Exception as e:
                    if args.verbose:
                        log(f"  {name} {sym} {tf} failed: {type(e).__name__}: {e}")
                    continue

                if m.n_trades == 0:
                    continue
                v, why = M.verdict(m)
                rows.append({
                    "strategy": name, "symbol": sym, "timeframe": tf,
                    "family": type(strat).family,
                    "verdict": v, "why": why,
                    "metrics": m.to_dict(),
                    "equity_tail": res.equity.iloc[::max(1, len(res.equity)//200)].tolist(),
                })
                if done % 25 == 0:
                    log(f"  ... {done}/{total}")

    rows.sort(key=lambda r: (r["metrics"].get("sharpe") or -99), reverse=True)
    benchmarks = _buy_and_hold(data, float(cfg.get("risk", {}).get("starting_equity", 500.0)))
    payload = {
        "generated": pd.Timestamp.now("UTC").isoformat(),
        "n_combos": len(rows),
        "results": rows[:400],
        "best": rows[0] if rows else None,
        "benchmarks": benchmarks,
    }
    (RESULTS / "backtests.json").write_text(json.dumps(payload, default=str))

    _print_leaderboard(rows[:25])
    _print_benchmarks(benchmarks, rows)
    log(f"\nsaved {len(rows)} results -> results/backtests.json")
    log("\nNOTE: these are single-pass in-sample numbers. They are the WEAKEST")
    log("evidence this tool produces. Run `python cli.py walkforward` next --")
    log("expect most of these to fall apart there. That is the point.")


def _buy_and_hold(data: Dict[str, Dict[str, pd.DataFrame]], start_equity: float) -> List[dict]:
    """Buy-and-hold on the same windows the strategies were measured over.

    This is the benchmark that matters and the one retail backtests almost never
    show. A strategy that trades 1,500 times to underperform simply holding the
    asset has not earned its complexity, its fees, or your attention -- and on
    a rising crypto tape that describes most of them.
    """
    out = []
    holdout_frac = 0.20
    for tf, frames in data.items():
        for sym, df in frames.items():
            train, _ = holdout_split(df, holdout_frac)
            if len(train) < 100:
                continue
            eq = start_equity * (train["close"] / train["close"].iloc[0])
            m = M.compute(eq, [], tf, start_equity, None, n_trials=1)
            out.append({
                "symbol": sym, "timeframe": tf,
                "total_return": m.total_return, "sharpe": m.sharpe,
                "max_drawdown": m.max_drawdown,
            })
    return sorted(out, key=lambda r: -(r["sharpe"] or -99))


def _print_benchmarks(benchmarks: List[dict], rows: List[dict]) -> None:
    if not benchmarks:
        return
    log("")
    log("BUY & HOLD BENCHMARK (same windows, zero trading)")
    log("-" * 108)
    log(f"{'symbol':<12}{'tf':<6}{'return':>10}{'sharpe':>9}{'maxDD':>8}")
    for b in benchmarks[:10]:
        log(f"{b['symbol']:<12}{b['timeframe']:<6}{_pct(b['total_return']):>10}"
            f"{_f(b['sharpe']):>9}{_pct(b['max_drawdown']):>8}")

    best_bh = max((b["sharpe"] or -99) for b in benchmarks)
    beat = [r for r in rows if (r["metrics"].get("sharpe") or -99) > best_bh]
    log("")
    if beat:
        log(f"{len(beat)} of {len(rows)} strategy configs beat the best buy-and-hold Sharpe "
            f"({best_bh:.2f}) in sample.")
        log("In-sample only -- check whether any survive `walkforward` before believing it.")
    else:
        log(f"NONE of the {len(rows)} strategy configs beat the best buy-and-hold Sharpe "
            f"({best_bh:.2f}).")
        log("On this data, trading actively was worse than doing nothing. That is a real")
        log("finding and the single most common honest outcome in retail quant research.")


def _print_leaderboard(rows: List[dict]) -> None:
    if not rows:
        log("no results.")
        return
    log("")
    log(f"{'strategy':<22}{'symbol':<11}{'tf':<5}{'trades':>7}{'sharpe':>8}"
        f"{'PF':>7}{'exp R':>8}{'maxDD':>8}{'fees%':>7}  verdict")
    log("-" * 108)
    for r in rows:
        m = r["metrics"]
        log(f"{r['strategy']:<22}{r['symbol']:<11}{r['timeframe']:<5}"
            f"{m.get('n_trades', 0):>7}"
            f"{_f(m.get('sharpe')):>8}"
            f"{_f(m.get('profit_factor')):>7}"
            f"{_f(m.get('expectancy_r')):>8}"
            f"{_pct(m.get('max_drawdown')):>8}"
            f"{_pct(m.get('fees_pct_of_gross')):>7}  {r['verdict']}")


def _f(x, nd=2):
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return "-"
    return f"{x:.{nd}f}"


def _pct(x):
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return "-"
    return f"{x*100:.0f}%"


# ---------------------------------------------------------------------------
# walk-forward
# ---------------------------------------------------------------------------

def cmd_walkforward(args, cfg) -> None:
    tfs = args.timeframes or [C.primary_timeframe(cfg)]
    data = _load_all(cfg, tfs)
    if not data:
        log("no cached data. run `python cli.py download` first.")
        return

    wf_cfg = cfg.get("backtest", {}).get("walk_forward", {})
    strategies = C.selected_strategies(cfg)
    if args.strategy:
        strategies = {k: v for k, v in strategies.items() if k in args.strategy}

    registry = all_strategies()
    out: List[dict] = []

    log("walk-forward validation")
    log("optimising on each training window, trading the next window untouched.\n")

    for tf, frames in data.items():
        bt = C.build_backtester(cfg)
        for sym, df in frames.items():
            if args.symbol and sym not in args.symbol:
                continue
            ctx = Context(symbol=sym, timeframe=tf,
                          peers={k: v for k, v in frames.items() if k != sym},
                          benchmark=frames.get("BTC/USD"))

            for name in strategies:
                cls = registry.get(name)
                if cls is None or tf not in cls.timeframes:
                    continue
                if getattr(cls, "requires_l2", False):
                    continue

                log(f"  {name} / {sym} / {tf}")
                try:
                    r = walk_forward(
                        cls, df, bt, ctx,
                        train_bars=int(wf_cfg.get("train_bars", 5000)),
                        test_bars=int(wf_cfg.get("test_bars", 1250)),
                        step_bars=int(wf_cfg.get("step_bars", 1250)),
                        min_trades_per_fold=int(wf_cfg.get("min_trades_per_fold", 15)),
                        grid_cap=args.grid_cap,
                        progress=(lambda m: log(f"     {m}")) if args.verbose else None,
                    )
                except Exception as e:
                    log(f"     failed: {type(e).__name__}: {e}")
                    continue

                if not r.folds or r.stitched_metrics is None:
                    log("     not enough data for a single fold")
                    continue

                m = r.stitched_metrics
                v, why = M.verdict(m)
                d = r.to_dict()
                d["verdict"] = v
                d["why"] = why
                d["family"] = cls.family
                if r.stitched_equity is not None and len(r.stitched_equity):
                    step = max(1, len(r.stitched_equity) // 300)
                    d["equity"] = r.stitched_equity.iloc[::step].tolist()
                    d["equity_ts"] = [str(x) for x in r.stitched_equity.index[::step]]
                out.append(d)

                log(f"     OOS sharpe {_f(m.sharpe)}  DSR {_f(m.deflated_sharpe)}  "
                    f"trades {m.n_trades}  efficiency {_f(r.efficiency)}  "
                    f"stability {_pct(r.param_stability)}  -> {v}")

    out.sort(key=lambda d: (d.get("metrics", {}).get("deflated_sharpe") or 0), reverse=True)
    (RESULTS / "walkforward.json").write_text(
        json.dumps({"generated": pd.Timestamp.now("UTC").isoformat(), "results": out}, default=str)
    )

    log(f"\nsaved {len(out)} walk-forward results -> results/walkforward.json")
    survivors = [d for d in out if d.get("verdict") == "CANDIDATE"]
    log(f"\n{len(survivors)} of {len(out)} configurations survived as CANDIDATE.")
    if not survivors:
        log("None survived. That is the most common outcome and it is a real result:")
        log("it means none of these strategies demonstrated an edge that outlived its")
        log("own optimisation window on this data. Do not go live on any of them.")


# ---------------------------------------------------------------------------
# monte carlo
# ---------------------------------------------------------------------------

def cmd_montecarlo(args, cfg) -> None:
    f = RESULTS / "backtests.json"
    if not f.exists():
        log("run `python cli.py backtest` first.")
        return

    data = json.loads(f.read_text())
    rows = data.get("results", [])[: args.top]
    if not rows:
        log("no backtest results to stress test.")
        return

    mc_cfg = cfg.get("backtest", {}).get("monte_carlo", {})
    runs = int(mc_cfg.get("runs", 2000))
    start_eq = float(cfg.get("risk", {}).get("starting_equity", 500.0))
    risk_per_trade = float(cfg.get("risk", {}).get("risk_per_trade", 0.05))

    log(f"Monte Carlo: {runs} resampled paths per strategy, {len(rows)} strategies\n")

    # Position-sizing sanity check, independent of any strategy.
    log("Risk-of-ruin for your configured position size, at various edges:")
    log(f"  (risk_per_trade = {risk_per_trade:.1%}, 200 trades, ruin = -50%)")
    for wr, po in [(0.40, 2.0), (0.50, 1.5), (0.55, 1.2), (0.60, 1.0)]:
        p = MC.risk_of_ruin_analytic(wr, po, risk_per_trade, 200)
        log(f"    win rate {wr:.0%}, payoff {po:.1f}:1  ->  P(ruin) = {p:.1%}")
    log("")

    out = []
    tfmap = {}
    for r in rows:
        key = f"{r['strategy']}/{r['symbol']}/{r['timeframe']}"
        tfmap[key] = r
        m = r["metrics"]
        n = m.get("n_trades") or 0
        if n < 10:
            continue

        # Reconstruct a trade P&L series from the reported distribution. The
        # real trades are not stored in backtests.json to keep it small, so this
        # samples from the observed win rate and average R -- an approximation,
        # and flagged as such rather than presented as the true sequence.
        wr = m.get("win_rate") or 0.0
        aw = m.get("avg_win_r") or 0.0
        al = m.get("avg_loss_r") or 0.0
        rng = np.random.default_rng(5)
        wins = rng.random(n) < wr
        r_vals = np.where(wins, aw, al)
        risk_cash = start_eq * risk_per_trade

        class _T:
            pass

        trades = []
        for rv in r_vals:
            t = _T()
            t.pnl = float(rv * risk_cash)
            trades.append(t)

        res = MC.run(trades, start_eq, runs, mc_cfg.get("method", "shuffle"))
        if res is None:
            continue
        out.append({"key": key, "strategy": r["strategy"], "symbol": r["symbol"],
                    "timeframe": r["timeframe"], "mc": res.to_dict()})

        log(f"{key}")
        log(f"  P(profit) {res.p_profit:>6.1%}   P(ruin) {res.p_ruin:>6.1%}   "
            f"median {res.median_return:>+7.1%}   p05 {res.return_p05:>+7.1%}")
        log(f"  drawdown: median {res.dd_median:.1%}, p95 {res.dd_p95:.1%}, "
            f"worst {res.dd_worst:.1%}   longest losing streak (p95): "
            f"{res.longest_losing_streak_p95}")

    (RESULTS / "montecarlo.json").write_text(
        json.dumps({"generated": pd.Timestamp.now("UTC").isoformat(), "results": out}, default=str)
    )
    log(f"\nsaved -> results/montecarlo.json")
    log("\nPlan around the p95 drawdown, not the median. The single backtest path")
    log("you saw earlier is one draw from this distribution, and usually a kind one.")


# ---------------------------------------------------------------------------
# report / gate / arb
# ---------------------------------------------------------------------------

def cmd_report(args, cfg) -> None:
    for fname, title in [("backtests.json", "IN-SAMPLE BACKTEST (weak evidence)"),
                         ("walkforward.json", "WALK-FORWARD (what matters)")]:
        f = RESULTS / fname
        if not f.exists():
            continue
        data = json.loads(f.read_text())
        rows = data.get("results", [])
        log(f"\n{'='*108}\n{title}\n{'='*108}")
        if fname == "backtests.json":
            _print_leaderboard(rows[:20])
        else:
            log(f"{'strategy':<22}{'symbol':<11}{'tf':<5}{'folds':>6}{'trades':>7}"
                f"{'OOS Sh':>8}{'DSR':>7}{'eff':>7}{'stab':>7}  verdict")
            log("-" * 108)
            for r in rows[:20]:
                m = r.get("metrics", {})
                log(f"{r['strategy']:<22}{r['symbol']:<11}{r['timeframe']:<5}"
                    f"{r.get('n_folds', 0):>6}{m.get('n_trades', 0):>7}"
                    f"{_f(m.get('sharpe')):>8}{_f(m.get('deflated_sharpe')):>7}"
                    f"{_f(r.get('efficiency')):>7}{_pct(r.get('param_stability')):>7}"
                    f"  {r.get('verdict')}")


def cmd_gate(args, cfg) -> None:
    from engine.live.state import Store

    store = Store(cfg.get("live", {}).get("state_db", "./state/quantdesk.db"))
    crit = criteria_from_config(cfg)
    rows = [r for r in store.trades("paper", 100_000) if r.get("exit_time")]
    days = store.paper_days()

    m = None
    if rows:
        pts = store.equity_curve("paper", 100_000)
        if len(pts) >= 3:
            eq = pd.Series([p["equity"] for p in pts],
                           index=pd.to_datetime([p["ts"] for p in pts], utc=True))

            class _T:
                pass

            trades = []
            for row in rows:
                t = _T()
                t.pnl = float(row.get("pnl") or 0.0)
                t.pnl_r = float(row.get("pnl_r") or 0.0)
                t.fees = float(row.get("fees") or 0.0)
                t.bars_held = int(row.get("bars_held") or 0)
                t.entry_price = float(row.get("entry_price") or 0.0)
                t.qty = float(row.get("qty") or 0.0)
                trades.append(t)
            m = M.compute(eq, trades, C.primary_timeframe(cfg),
                          float(cfg.get("risk", {}).get("starting_equity", 500.0)))

    res = evaluate(crit, m, days)
    log(f"\nGO-LIVE GATE\n{'='*70}")
    log(f"paper trading for {days:.1f} days, {len(rows)} closed trades\n")
    for c in res.checks:
        mark = "PASS" if c.passed else "FAIL"
        log(f"  [{mark}] {c.name:<20} {c.actual:<16} required {c.required}")
        if not c.passed and c.detail:
            log(f"         {c.detail}")
    log(f"\n{res.summary}\n")
    if res.passed:
        log("Live trading is permitted. To actually arm it you must ALSO:")
        log("  1. set live.mode: live in config/config.yaml")
        log("  2. export QUANTDESK_ALLOW_LIVE=1")
        log("  3. put real API keys in config/.env")
        log("Three separate switches, on purpose.")


def cmd_arb(args, cfg) -> None:
    """Sample the same pairs across venues and report spreads net of fees."""
    import ccxt

    venues = args.venues or ["kraken", "coinbase", "binanceus"]
    syms = C.universe(cfg)[:6]
    taker = float(cfg.get("costs", {}).get("taker_fee_bps", 26.0)) / 10_000.0

    log(f"sampling {len(syms)} pairs across {venues}\n")
    books: Dict[str, Dict[str, dict]] = {}
    for v in venues:
        if not hasattr(ccxt, v):
            log(f"  {v}: unknown exchange, skipping")
            continue
        ex = getattr(ccxt, v)({"enableRateLimit": True})
        books[v] = {}
        for s in syms:
            try:
                t = ex.fetch_ticker(s)
                if t.get("bid") and t.get("ask"):
                    books[v][s] = {"bid": float(t["bid"]), "ask": float(t["ask"])}
            except Exception:
                continue
        log(f"  {v}: {len(books[v])} pairs")

    rows = []
    for s in syms:
        quotes = {v: b[s] for v, b in books.items() if s in b}
        if len(quotes) < 2:
            continue
        # Best case: buy at the lowest ask, sell at the highest bid.
        buy_v = min(quotes, key=lambda v: quotes[v]["ask"])
        sell_v = max(quotes, key=lambda v: quotes[v]["bid"])
        buy, sell = quotes[buy_v]["ask"], quotes[sell_v]["bid"]
        gross = (sell - buy) / buy
        net = gross - 2 * taker
        rows.append({"symbol": s, "buy_venue": buy_v, "buy": buy,
                     "sell_venue": sell_v, "sell": sell,
                     "gross_bps": gross * 10_000, "net_bps": net * 10_000,
                     "profitable": net > 0})

    log(f"\n{'pair':<11}{'buy at':<12}{'sell at':<12}{'gross bps':>10}{'net bps':>10}")
    log("-" * 60)
    for r in sorted(rows, key=lambda r: -r["net_bps"]):
        log(f"{r['symbol']:<11}{r['buy_venue']:<12}{r['sell_venue']:<12}"
            f"{r['gross_bps']:>10.1f}{r['net_bps']:>10.1f}")

    (RESULTS / "arbitrage.json").write_text(
        json.dumps({"generated": pd.Timestamp.now("UTC").isoformat(), "rows": rows,
                    "taker_bps": taker * 10_000}, default=str)
    )
    log("\nNet bps is after two taker fees and ignores withdrawal fees, transfer")
    log("time, and the fact that both legs must fill. If net looks positive, it")
    log("is almost certainly stale quotes rather than free money.")


# ---------------------------------------------------------------------------
# live
# ---------------------------------------------------------------------------

def cmd_live(args, cfg) -> None:
    import threading

    from engine.api.server import serve
    from engine.backtest.engine import costs_from_config, exec_from_config
    from engine.live.alerts import Alerter, config_from_dict
    from engine.live.broker import CcxtBroker, PaperBroker
    from engine.live.runner import LiveRunner
    from engine.live.state import Store

    live_cfg = cfg.get("live", {})
    mode = args.mode or live_cfg.get("mode", "paper")
    store = Store(live_cfg.get("state_db", "./state/quantdesk.db"))
    costs = costs_from_config(cfg)
    execm = exec_from_config(cfg)
    risk = C.build_risk(cfg, log=log)
    alerter = Alerter(config_from_dict(cfg), log=log)
    feed = C.build_feed(cfg)

    if mode == "live":
        crit = criteria_from_config(cfg)
        rows = [r for r in store.trades("paper", 100_000) if r.get("exit_time")]
        gate_res = evaluate(crit, None if not rows else _paper_metrics(store, cfg),
                            store.paper_days())
        if not gate_res.passed:
            log(f"\nLIVE MODE REFUSED\n{gate_res.summary}\n")
            log("Run `python cli.py gate` for the full checklist.")
            return
        broker = CcxtBroker(feed.exchange, cfg.get("exchange", {}).get("quote", "USD"),
                            gate_passed=True, log=log)
    else:
        p = live_cfg.get("paper", {})
        broker = PaperBroker(
            costs,
            starting_cash=float(cfg.get("risk", {}).get("starting_equity", 500.0)),
            partial_fill_prob=float(p.get("partial_fill_prob", 0.15)),
            reject_prob=float(p.get("reject_prob", 0.01)),
            log=log,
        )

    runner = LiveRunner(
        feed=feed,
        strategies=C.selected_strategies(cfg),
        risk=risk, broker=broker, store=store, alerter=alerter,
        costs=costs, execution=execm,
        symbols=C.universe(cfg, include_scanner=args.scan),
        timeframe=args.timeframe or C.primary_timeframe(cfg),
        poll_seconds=int(live_cfg.get("poll_seconds", 15)),
        log=log,
    )

    api = cfg.get("api", {})
    threading.Thread(
        target=serve,
        args=(runner, cfg, api.get("host", "127.0.0.1"), int(api.get("port", 8787))),
        daemon=True,
    ).start()
    log(f"dashboard API on http://{api.get('host','127.0.0.1')}:{api.get('port',8787)}")
    log("start the UI with:  cd dashboard && npm run dev\n")

    try:
        runner.start()
    except KeyboardInterrupt:
        log("\nstopping...")
        runner.stop()


def _paper_metrics(store, cfg):
    rows = [r for r in store.trades("paper", 100_000) if r.get("exit_time")]
    pts = store.equity_curve("paper", 100_000)
    if len(pts) < 3 or not rows:
        return None
    eq = pd.Series([p["equity"] for p in pts],
                   index=pd.to_datetime([p["ts"] for p in pts], utc=True))

    class _T:
        pass

    trades = []
    for row in rows:
        t = _T()
        t.pnl = float(row.get("pnl") or 0.0)
        t.pnl_r = float(row.get("pnl_r") or 0.0)
        t.fees = float(row.get("fees") or 0.0)
        t.bars_held = int(row.get("bars_held") or 0)
        t.entry_price = float(row.get("entry_price") or 0.0)
        t.qty = float(row.get("qty") or 0.0)
        trades.append(t)
    return M.compute(eq, trades, C.primary_timeframe(cfg),
                     float(cfg.get("risk", {}).get("starting_equity", 500.0)))


def cmd_serve(args, cfg) -> None:
    from engine.api.server import serve
    api = cfg.get("api", {})
    log(f"serving dashboard API on http://{api.get('host','127.0.0.1')}:{api.get('port',8787)}")
    log("(no trading runner attached -- this is results-browsing mode)")
    serve(None, cfg, api.get("host", "127.0.0.1"), int(api.get("port", 8787)))


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(prog="quantdesk", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-c", "--config", default=None)
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("download");  p.add_argument("--force", action="store_true")
    p.add_argument("--timeframes", nargs="*")
    p.set_defaults(fn=cmd_download)

    p = sub.add_parser("backtest")
    p.add_argument("--timeframes", nargs="*")
    p.add_argument("--strategy", nargs="*")
    p.set_defaults(fn=cmd_backtest)

    p = sub.add_parser("walkforward")
    p.add_argument("--timeframes", nargs="*")
    p.add_argument("--strategy", nargs="*")
    p.add_argument("--symbol", nargs="*")
    p.add_argument("--grid-cap", type=int, default=120)
    p.set_defaults(fn=cmd_walkforward)

    p = sub.add_parser("montecarlo");  p.add_argument("--top", type=int, default=10)
    p.set_defaults(fn=cmd_montecarlo)

    sub.add_parser("report").set_defaults(fn=cmd_report)
    sub.add_parser("gate").set_defaults(fn=cmd_gate)

    p = sub.add_parser("arb");  p.add_argument("--venues", nargs="*")
    p.set_defaults(fn=cmd_arb)

    p = sub.add_parser("live")
    p.add_argument("--mode", choices=["paper", "live"])
    p.add_argument("--timeframe")
    p.add_argument("--scan", action="store_true", help="include scanner symbols")
    p.set_defaults(fn=cmd_live)

    sub.add_parser("serve").set_defaults(fn=cmd_serve)

    args = ap.parse_args()
    cfg = C.load_config(args.config)
    args.fn(args, cfg)


if __name__ == "__main__":
    main()
