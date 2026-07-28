"""Strategy contract and registry.

A strategy is a pure function of a price DataFrame to a signal DataFrame. It
holds no state, knows nothing about position size, and never sees the account.
That separation is deliberate: it means the same object is used identically by
the backtester, the walk-forward optimiser and the live runner, so a strategy
cannot behave differently in production than it did in testing.

Signal contract -- `generate()` returns a DataFrame indexed like the input:

    signal      -1 short, 0 flat, +1 long. Interpreted as the *desired* state
                as of that bar's close. The backtester acts on the NEXT bar's
                open, so a signal computed from a close can never be filled at
                that same close. This one shift is the difference between a
                plausible backtest and a fantasy.
    strength    0..1 confidence. Optional; scales position size when present.
    stop_mult   per-bar override of stop distance in ATRs. Optional.
    reason      short string for the trade log / dashboard. Optional.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, Type

import numpy as np
import pandas as pd


@dataclass
class ParamSpec:
    """A tunable parameter and the grid the optimiser is allowed to search.

    Grids are kept deliberately coarse. Every extra combination you test
    inflates the odds that your best result is luck rather than edge -- the
    optimiser reports the trial count and the metrics module deflates the
    Sharpe by it, so a wide grid actively costs you credibility.
    """

    name: str
    default: Any
    grid: list = field(default_factory=list)


class Strategy:
    """Base class. Subclasses implement `_compute`."""

    name: str = "unnamed"
    family: str = "misc"
    # Which timeframes this strategy is meaningful on. Running a 4h regime
    # filter on 1m bars is not a bug the optimiser can fix.
    timeframes: tuple = ("15m", "1h")
    # Long-only strategies still work on spot without margin.
    allow_short: bool = True
    description: str = ""
    params: tuple = ()

    def __init__(self, **kwargs):
        self.p: Dict[str, Any] = {s.name: s.default for s in self.params}
        unknown = set(kwargs) - set(self.p)
        if unknown:
            raise ValueError(f"{self.name}: unknown params {sorted(unknown)}")
        self.p.update(kwargs)

    # -- to implement ------------------------------------------------------
    def _compute(self, df: pd.DataFrame, ctx: "Context") -> pd.DataFrame:
        raise NotImplementedError

    # -- public ------------------------------------------------------------
    def generate(self, df: pd.DataFrame, ctx: "Context | None" = None) -> pd.DataFrame:
        ctx = ctx or Context()
        out = self._compute(df, ctx)

        if "signal" not in out:
            raise ValueError(f"{self.name} produced no 'signal' column")

        out = out.reindex(df.index)
        sig = out["signal"].fillna(0.0)
        # Guard the contract rather than trusting each subclass to honour it.
        sig = np.sign(sig).clip(-1, 1)
        if not self.allow_short:
            sig = sig.clip(lower=0)
        out["signal"] = sig

        if "strength" not in out:
            out["strength"] = 1.0
        out["strength"] = out["strength"].fillna(1.0).clip(0.0, 1.0)

        if "reason" not in out:
            out["reason"] = ""
        return out

    def grid(self) -> Dict[str, list]:
        return {s.name: (s.grid or [s.default]) for s in self.params}

    def clone(self, **kwargs) -> "Strategy":
        merged = dict(self.p)
        merged.update(kwargs)
        return type(self)(**merged)

    def key(self) -> str:
        if not self.p:
            return self.name
        bits = ",".join(f"{k}={v}" for k, v in sorted(self.p.items()))
        return f"{self.name}[{bits}]"

    def __repr__(self) -> str:
        return f"<{self.key()}>"


@dataclass
class Context:
    """Everything a strategy may need beyond its own symbol's bars.

    Pair strategies read `peers`; regime filters read `benchmark`. Kept
    explicit so that a strategy's dependencies are visible rather than
    smuggled in through globals.
    """

    symbol: str = ""
    timeframe: str = ""
    peers: Dict[str, pd.DataFrame] = field(default_factory=dict)
    benchmark: pd.DataFrame | None = None


# --------------------------------------------------------------------------
# registry
# --------------------------------------------------------------------------

_REGISTRY: Dict[str, Type[Strategy]] = {}


def register(cls: Type[Strategy]) -> Type[Strategy]:
    if cls.name in _REGISTRY:
        raise ValueError(f"duplicate strategy name: {cls.name}")
    _REGISTRY[cls.name] = cls
    return cls


def get(name: str) -> Type[Strategy]:
    if name not in _REGISTRY:
        raise KeyError(f"no strategy named {name!r}; have {sorted(_REGISTRY)}")
    return _REGISTRY[name]


def all_strategies() -> Dict[str, Type[Strategy]]:
    return dict(_REGISTRY)


def by_family(families: Iterable[str]) -> Dict[str, Type[Strategy]]:
    fams = set(families)
    return {k: v for k, v in _REGISTRY.items() if v.family in fams}


# --------------------------------------------------------------------------
# helpers shared by strategies
# --------------------------------------------------------------------------

def cross_over(a: pd.Series, b: pd.Series) -> pd.Series:
    return (a > b) & (a.shift(1) <= b.shift(1))


def cross_under(a: pd.Series, b: pd.Series) -> pd.Series:
    return (a < b) & (a.shift(1) >= b.shift(1))


def hold(entries_long: pd.Series, exits_long: pd.Series,
         entries_short: pd.Series, exits_short: pd.Series) -> pd.Series:
    """Turn entry/exit events into a held -1/0/+1 state.

    Written as an explicit loop because the state at bar i depends on the state
    at bar i-1, which no vectorised expression captures without introducing
    lookahead. Speed is not the constraint here; correctness is.
    """
    el = entries_long.fillna(False).to_numpy(dtype=bool)
    xl = exits_long.fillna(False).to_numpy(dtype=bool)
    es = entries_short.fillna(False).to_numpy(dtype=bool)
    xs = exits_short.fillna(False).to_numpy(dtype=bool)

    state = np.zeros(len(el))
    cur = 0.0
    for i in range(len(el)):
        if cur == 0.0:
            if el[i]:
                cur = 1.0
            elif es[i]:
                cur = -1.0
        elif cur > 0:
            if xl[i]:
                cur = -1.0 if es[i] else 0.0
        else:
            if xs[i]:
                cur = 1.0 if el[i] else 0.0
        state[i] = cur
    return pd.Series(state, index=entries_long.index)


def state_from_regime(regime: pd.Series) -> pd.Series:
    """For always-in strategies that simply follow a +1/-1 regime series."""
    return regime.fillna(0.0)
