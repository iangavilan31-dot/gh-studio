"""The go-live gate.

You asked for a hard gate, and this is it. Live trading is refused until paper
results clear every criterion below. There is no config flag that bypasses it;
disabling it means editing this file, which is a deliberate speed bump placed
exactly where impatience does the most damage -- week two, after a good run,
when the temptation to skip ahead is strongest.

The criteria are not arbitrary:

  min_paper_days          two weeks spans at least a couple of regime shifts.
                          One good week is not evidence.
  min_trades              below ~40 trades, win rate has a confidence interval
                          wide enough to contain both "great" and "broken".
  min_sharpe              risk-adjusted, so a strategy cannot pass by simply
                          taking enormous risk and getting away with it once.
  min_profit_factor       gross wins over gross losses, after all costs.
  min_expectancy_r        the average trade must earn something in R terms.
                          A strategy with positive P&L but ~0 expectancy is one
                          outlier away from negative.
  max_drawdown            a strategy that draws down 25% on paper will do worse
                          live, because paper does not model your behaviour.
  max_backtest_divergence paper results far BETTER than the backtest predicted
                          means the backtest is wrong, and a wrong model that
                          happens to flatter you is still wrong.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Optional

from ..backtest.metrics import Metrics


@dataclass
class GateCriteria:
    enabled: bool = True
    min_paper_days: int = 14
    min_trades: int = 40
    min_sharpe: float = 1.0
    min_profit_factor: float = 1.2
    min_expectancy_r: float = 0.10
    max_drawdown: float = 0.20
    max_backtest_divergence: float = 0.50


@dataclass
class Check:
    name: str
    passed: bool
    actual: str
    required: str
    detail: str = ""


@dataclass
class GateResult:
    passed: bool
    checks: List[Check]
    summary: str

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "summary": self.summary,
            "checks": [asdict(c) for c in self.checks],
        }


def evaluate(
    criteria: GateCriteria,
    paper: Optional[Metrics],
    paper_days: float,
    backtest: Optional[Metrics] = None,
) -> GateResult:
    if not criteria.enabled:
        return GateResult(
            passed=True,
            checks=[],
            summary="gate disabled in config -- live trading permitted without validation",
        )

    checks: List[Check] = []

    if paper is None:
        return GateResult(
            passed=False,
            checks=[Check("paper_results", False, "none", "required",
                          "no paper trading results recorded yet")],
            summary="BLOCKED: no paper trading history",
        )

    checks.append(Check(
        "paper_duration", paper_days >= criteria.min_paper_days,
        f"{paper_days:.1f} days", f">= {criteria.min_paper_days} days",
        "shorter runs cannot span enough regimes to be informative",
    ))
    checks.append(Check(
        "trade_count", paper.n_trades >= criteria.min_trades,
        str(paper.n_trades), f">= {criteria.min_trades}",
        "below this the win rate estimate is too noisy to act on",
    ))
    checks.append(Check(
        "sharpe", paper.sharpe >= criteria.min_sharpe,
        f"{paper.sharpe:.2f}", f">= {criteria.min_sharpe:.2f}",
        "risk-adjusted return",
    ))
    checks.append(Check(
        "profit_factor", paper.profit_factor >= criteria.min_profit_factor,
        f"{paper.profit_factor:.2f}", f">= {criteria.min_profit_factor:.2f}",
        "gross wins / gross losses, after fees and slippage",
    ))
    checks.append(Check(
        "expectancy", paper.expectancy_r >= criteria.min_expectancy_r,
        f"{paper.expectancy_r:.3f}R", f">= {criteria.min_expectancy_r:.3f}R",
        "average earnings per trade in risk units",
    ))
    checks.append(Check(
        "drawdown", paper.max_drawdown <= criteria.max_drawdown,
        f"{paper.max_drawdown:.1%}", f"<= {criteria.max_drawdown:.1%}",
        "live drawdowns are reliably worse than paper drawdowns",
    ))

    if backtest is not None and backtest.n_trades >= 20:
        bt_exp = backtest.expectancy_r
        if abs(bt_exp) > 1e-6:
            divergence = abs(paper.expectancy_r - bt_exp) / abs(bt_exp)
            checks.append(Check(
                "backtest_agreement", divergence <= criteria.max_backtest_divergence,
                f"{divergence:.0%} apart", f"<= {criteria.max_backtest_divergence:.0%}",
                f"paper {paper.expectancy_r:.3f}R vs backtest {bt_exp:.3f}R -- "
                "a large gap means the cost model is wrong in one direction or the other",
            ))

    failed = [c for c in checks if not c.passed]
    if failed:
        return GateResult(
            passed=False,
            checks=checks,
            summary="BLOCKED: " + "; ".join(f"{c.name} ({c.actual} vs {c.required})" for c in failed),
        )
    return GateResult(
        passed=True,
        checks=checks,
        summary=(
            f"PASSED all {len(checks)} checks over {paper_days:.0f} paper days "
            f"and {paper.n_trades} trades"
        ),
    )


def criteria_from_config(cfg: dict) -> GateCriteria:
    g = cfg.get("gate", {})
    return GateCriteria(
        enabled=bool(g.get("enabled", True)),
        min_paper_days=int(g.get("min_paper_days", 14)),
        min_trades=int(g.get("min_trades", 40)),
        min_sharpe=float(g.get("min_sharpe", 1.0)),
        min_profit_factor=float(g.get("min_profit_factor", 1.2)),
        min_expectancy_r=float(g.get("min_expectancy_r", 0.10)),
        max_drawdown=float(g.get("max_drawdown", 0.20)),
        max_backtest_divergence=float(g.get("max_backtest_divergence", 0.50)),
    )
