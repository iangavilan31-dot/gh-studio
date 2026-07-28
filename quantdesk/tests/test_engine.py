"""End-to-end sanity tests.

These do not check that strategies are profitable -- they cannot, and a test
that asserted profitability on synthetic data would be worse than useless.
They check the properties that must hold for any result to be meaningful:

  * every strategy runs without raising on realistic input
  * signals are in {-1, 0, +1} and are not forward-looking
  * the backtester never produces negative equity or free money
  * costs are actually charged
  * the lookahead guard genuinely blocks a cheating strategy
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.backtest import metrics as M
from engine.backtest.engine import Backtester, CostModel, ExecModel
from engine.strategies import all_strategies
from engine.strategies.base import Context, Strategy, register


def synthetic_ohlcv(n: int = 4000, seed: int = 42, start: float = 50_000.0) -> pd.DataFrame:
    """GBM with volatility clustering and occasional jumps.

    Deliberately has no exploitable structure. Any strategy that shows a strong
    edge here has found a bug in the engine, not an edge in the market -- which
    makes this a useful null hypothesis to test against.
    """
    rng = np.random.default_rng(seed)
    vol = 0.004 * np.ones(n)
    for i in range(1, n):
        # GARCH-ish persistence so volatility clusters like real markets.
        vol[i] = np.sqrt(0.000001 + 0.90 * vol[i - 1] ** 2 + 0.08 * (rng.normal() * vol[i - 1]) ** 2)
    rets = rng.normal(0, 1, n) * vol
    jumps = rng.random(n) < 0.002
    rets[jumps] += rng.normal(0, 0.05, jumps.sum())

    close = start * np.exp(np.cumsum(rets))
    spread = close * vol * 2
    high = close + np.abs(rng.normal(0, 1, n)) * spread
    low = close - np.abs(rng.normal(0, 1, n)) * spread
    open_ = np.concatenate([[start], close[:-1]])
    high = np.maximum.reduce([high, open_, close])
    low = np.minimum.reduce([low, open_, close])
    volume = np.abs(rng.lognormal(10, 1, n)) * (1 + 5 * np.abs(rets))

    idx = pd.date_range("2023-01-01", periods=n, freq="15min", tz="UTC")
    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": volume},
        index=idx,
    )


def _bt() -> Backtester:
    return Backtester(
        costs=CostModel(taker_fee_bps=26, spread_bps={"default": 4.0}, slippage_atr_frac=0.05),
        execution=ExecModel(),
        starting_equity=500.0,
        risk_per_trade=0.05,
    )


# ---------------------------------------------------------------------------

def test_all_strategies_run():
    df = synthetic_ohlcv()
    peer = synthetic_ohlcv(seed=7, start=3000.0)
    ctx = Context(symbol="ETH/USD", timeframe="15m",
                  peers={"BTC/USD": peer}, benchmark=peer)

    failures = []
    for name, cls in sorted(all_strategies().items()):
        try:
            sigs = cls().generate(df, ctx)
        except Exception as e:
            failures.append(f"{name}: {type(e).__name__}: {e}")
            continue

        s = sigs["signal"]
        assert len(s) == len(df), f"{name}: signal length mismatch"
        bad = set(np.unique(s.dropna())) - {-1.0, 0.0, 1.0}
        assert not bad, f"{name}: signal values outside {{-1,0,1}}: {bad}"
        assert sigs["strength"].between(0, 1).all(), f"{name}: strength outside [0,1]"

    assert not failures, "strategies raised:\n" + "\n".join(failures)


def test_backtest_produces_sane_results():
    df = synthetic_ohlcv()
    peer = synthetic_ohlcv(seed=7, start=3000.0)
    ctx = Context(symbol="ETH/USD", timeframe="15m", peers={"BTC/USD": peer}, benchmark=peer)
    bt = _bt()

    for name, cls in sorted(all_strategies().items()):
        sigs = cls().generate(df, ctx)
        res = bt.run(df, sigs, "ETH/USD", name, "15m")

        assert (res.equity > 0).all(), f"{name}: equity went non-positive"
        assert res.equity.notna().all(), f"{name}: NaN in equity curve"
        for t in res.trades:
            assert t.exit_time is not None
            assert t.qty > 0
            assert t.fees >= 0, f"{name}: negative fees"
            assert t.entry_price > 0 and t.exit_price > 0


def test_costs_are_charged():
    """A strategy that flips every bar must lose money to fees alone."""
    df = synthetic_ohlcv(n=2000)

    class Churner(Strategy):
        name = "_test_churner"
        timeframes = ("15m",)
        params = ()

        def _compute(self, d, c):
            alt = pd.Series(np.where(np.arange(len(d)) % 2 == 0, 1.0, -1.0), index=d.index)
            return pd.DataFrame({"signal": alt}, index=d.index)

    bt = _bt()
    res = bt.run(df, Churner().generate(df, Context()), "BTC/USD", "churn", "15m")
    assert res.equity.iloc[-1] < bt.starting_equity, (
        "a strategy trading every bar should be destroyed by fees; "
        "if it is not, the cost model is not being applied"
    )
    assert sum(t.fees for t in res.trades) > 0


def test_no_lookahead():
    """A strategy that peeks at the next bar must NOT be able to print money.

    The engine executes on the next bar's open, so a signal derived from the
    next bar's close still has to survive the gap, the spread and the fees. It
    should end up profitable but nowhere near the perfect-foresight bound -- if
    it returned something astronomical, the one-bar delay would not be working.
    """
    df = synthetic_ohlcv(n=3000)

    class Cheater(Strategy):
        name = "_test_cheater"
        timeframes = ("15m",)
        params = ()

        def _compute(self, d, c):
            future = d["close"].shift(-1) > d["close"]
            return pd.DataFrame(
                {"signal": np.where(future, 1.0, -1.0)}, index=d.index
            )

    bt = _bt()
    res = bt.run(df, Cheater().generate(df, Context()), "BTC/USD", "cheat", "15m")
    ratio = res.equity.iloc[-1] / bt.starting_equity
    # Perfect foresight with a one-bar execution delay is still very good, but
    # bounded. Anything above ~1e6x would mean the delay was not applied.
    assert ratio < 1e6, f"lookahead guard appears broken (returned {ratio:.1f}x)"


def test_metrics_and_deflated_sharpe():
    df = synthetic_ohlcv()
    bt = _bt()
    cls = all_strategies()["supertrend"]
    res = bt.run(df, cls().generate(df, Context()), "BTC/USD", "supertrend", "15m")

    m1 = M.compute(res.equity, res.trades, "15m", 500.0, res.exposure, n_trials=1)
    m200 = M.compute(res.equity, res.trades, "15m", 500.0, res.exposure, n_trials=200)

    assert np.isfinite(m1.sharpe)
    assert 0.0 <= m1.psr <= 1.0
    # The whole point of deflation: more trials must mean less confidence.
    assert m200.deflated_sharpe <= m1.deflated_sharpe + 1e-9, (
        "deflated Sharpe must not increase with the number of trials"
    )


def test_risk_manager_ceilings():
    from engine.risk.manager import RiskLimits, RiskManager

    rm = RiskManager(RiskLimits(risk_per_trade=0.50, daily_loss_limit=0.90,
                                max_gross_exposure=5.0), log=lambda m: None)
    assert rm.limits.risk_per_trade <= 0.05
    assert rm.limits.daily_loss_limit <= 0.10
    assert rm.limits.max_gross_exposure <= 1.0
    assert rm.clamp_notes, "clamping should be reported, not silent"


def test_risk_sizing_scales_with_stop_distance():
    """Equal dollar risk regardless of stop distance -- when uncapped.

    Stops here are deliberately wide (20% and 25% of price) so the exposure cap
    does not bind. That is the regime where ATR sizing behaves as designed.
    """
    from engine.risk.manager import RiskLimits, RiskManager

    rm = RiskManager(RiskLimits(risk_per_trade=0.05, max_position_pct=0.40),
                     log=lambda m: None)
    tight, risk_a = rm.size_position(500.0, 100.0, 80.0)    # $20 stop
    wide, risk_b = rm.size_position(500.0, 100.0, 75.0)     # $25 stop

    assert tight > wide, "a tighter stop must permit a larger position"
    assert abs(risk_a - risk_b) < 1e-6, "dollar risk must be identical"
    assert abs(risk_a - 25.0) < 1e-6, "5% of $500 is $25 at risk"


def test_exposure_cap_binds_on_realistic_stops():
    """Documents that the configured 5% is NOT what gets risked in practice.

    A 2xATR stop on 15m crypto is roughly 1-3% of price. At that distance the
    no-leverage exposure cap binds and the real risk lands far below 5%. This
    test exists to pin that behaviour down so it cannot regress silently, and
    because the number surprises people.
    """
    from engine.risk.manager import RiskLimits, RiskManager

    rm = RiskManager(RiskLimits(risk_per_trade=0.05, max_position_pct=0.40),
                     log=lambda m: None)
    qty, risk_cash = rm.size_position(500.0, 100.0, 98.0)   # 2% stop

    assert qty * 100.0 <= 500.0 * 0.40 + 1e-9, "position must respect the exposure cap"
    effective = risk_cash / 500.0
    assert effective < 0.05, "cap should reduce risk below the configured 5%"
    assert abs(effective - 0.008) < 1e-6, (
        f"expected ~0.8% effective risk on a 2% stop, got {effective:.4%}"
    )


def test_daily_loss_halt_and_kill_switch():
    from engine.risk.manager import RiskLimits, RiskManager

    rm = RiskManager(RiskLimits(starting_equity=500.0, daily_loss_limit=0.10,
                                max_total_drawdown=0.30), log=lambda m: None)
    rm.record_realised(-60.0)          # -12% on the day
    assert rm.state.halted_today
    ok, why = rm.can_open("BTC/USD", 50.0)
    assert not ok and "daily loss" in why

    rm2 = RiskManager(RiskLimits(starting_equity=500.0, max_total_drawdown=0.30),
                      log=lambda m: None)
    rm2.update_equity(300.0)           # -40% from peak
    assert rm2.state.kill_switch
    ok, why = rm2.can_open("BTC/USD", 10.0)
    assert not ok and "kill switch" in why


def test_gate_blocks_by_default():
    from engine.risk.gate import GateCriteria, evaluate

    res = evaluate(GateCriteria(), None, 0.0)
    assert not res.passed

    good = M.Metrics(n_trades=100, sharpe=2.0, profit_factor=1.8,
                     expectancy_r=0.3, max_drawdown=0.10)
    assert evaluate(GateCriteria(), good, 20.0).passed
    # Same performance, not enough elapsed time -> still blocked.
    assert not evaluate(GateCriteria(), good, 3.0).passed


def test_monte_carlo():
    from engine.backtest import montecarlo as MC

    class _T:
        def __init__(self, p):
            self.pnl = p

    rng = np.random.default_rng(1)
    trades = [_T(float(x)) for x in rng.normal(1.0, 20.0, 200)]
    res = MC.run(trades, 500.0, runs=500)
    assert res is not None
    assert 0.0 <= res.p_ruin <= 1.0
    assert res.dd_p95 >= res.dd_median


def test_half_life_detects_non_reverting_series():
    from engine.indicators import half_life

    rng = np.random.default_rng(3)
    walk = pd.Series(np.cumsum(rng.normal(0, 1, 1000)))
    reverting = pd.Series(np.zeros(1000))
    for i in range(1, 1000):
        reverting.iloc[i] = 0.9 * reverting.iloc[i - 1] + rng.normal()

    hl_rev = half_life(reverting)
    assert np.isfinite(hl_rev) and hl_rev < 50, "should detect fast mean reversion"
    hl_walk = half_life(walk)
    assert (not np.isfinite(hl_walk)) or hl_walk > hl_rev


if __name__ == "__main__":
    import traceback

    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except Exception:
            failed += 1
            print(f"FAIL  {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
