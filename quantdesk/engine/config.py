"""Config loading and assembly of the objects every entry point needs.

One place builds the feed, cost model, risk manager and strategy set, so the
CLI, the API and the live runner cannot drift into using different settings --
a class of bug that would show up as "the backtest and the bot disagree" and
take a long time to find.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

import yaml

from .backtest.engine import Backtester, costs_from_config, exec_from_config
from .data.feed import DataFeed
from .risk.manager import RiskManager, limits_from_config
from .strategies import all_strategies, by_family

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "config" / "config.yaml"


def load_config(path: str | Path | None = None) -> dict:
    p = Path(path) if path else DEFAULT_CONFIG
    if not p.exists():
        raise FileNotFoundError(f"config not found: {p}")
    with open(p) as f:
        cfg = yaml.safe_load(f) or {}
    _load_dotenv(p.parent / ".env")
    return cfg


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader. Existing environment variables always win, so a
    stale .env cannot silently override what you exported in your shell."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


def build_feed(cfg: dict) -> DataFeed:
    ex = cfg.get("exchange", {})
    d = cfg.get("data", {})
    return DataFeed(
        exchange_id=ex.get("id", "kraken"),
        cache_dir=d.get("cache_dir", "./data_cache"),
        enable_rate_limit=bool(ex.get("enable_rate_limit", True)),
        fetch_limit=int(d.get("fetch_limit", 720)),
        history_exchange_id=d.get("history_exchange"),
        history_quote=str(d.get("history_quote", "USDT")),
    )


def build_backtester(cfg: dict, allow_short: bool = True) -> Backtester:
    risk = cfg.get("risk", {})
    return Backtester(
        costs=costs_from_config(cfg),
        execution=exec_from_config(cfg),
        starting_equity=float(risk.get("starting_equity", 500.0)),
        risk_per_trade=float(risk.get("risk_per_trade", 0.05)),
        allow_short=allow_short,
    )


def build_risk(cfg: dict, log=print) -> RiskManager:
    return RiskManager(limits_from_config(cfg), log=log)


def selected_strategies(cfg: dict) -> Dict[str, Any]:
    """Instantiate the enabled strategies with any config overrides applied."""
    s = cfg.get("strategies", {})
    fams = s.get("enabled_families")
    classes = by_family(fams) if fams else all_strategies()
    overrides = s.get("overrides", {}) or {}

    out = {}
    for name, cls in classes.items():
        try:
            out[name] = cls(**overrides.get(name, {}))
        except Exception as e:
            print(f"[config] skipping {name}: {e}")
    return out


def universe(cfg: dict, include_scanner: bool = False) -> List[str]:
    u = cfg.get("universe", {})
    syms = list(u.get("core", []))
    if include_scanner:
        syms += [s for s in u.get("scanner", []) if s not in syms]
    return syms


def timeframes(cfg: dict) -> List[str]:
    return list(cfg.get("timeframes", {}).get("enabled", ["15m", "1h"]))


def primary_timeframe(cfg: dict) -> str:
    return str(cfg.get("timeframes", {}).get("primary", "15m"))
