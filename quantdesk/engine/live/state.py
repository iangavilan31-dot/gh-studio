"""SQLite persistence for the live/paper runner.

The bot must survive a restart without losing its trade history, its equity
curve, or -- critically -- the record of how long it has been paper trading.
That last one is what the go-live gate reads, and an in-memory-only bot would
reset its paper clock every time you restarted it, which would quietly defeat
the gate entirely.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    symbol TEXT NOT NULL,
    strategy TEXT NOT NULL,
    timeframe TEXT,
    direction INTEGER NOT NULL,
    qty REAL NOT NULL,
    entry_time TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_time TEXT,
    exit_price REAL,
    stop_price REAL,
    target_price REAL,
    pnl REAL,
    pnl_r REAL,
    fees REAL,
    bars_held INTEGER,
    exit_reason TEXT,
    mae_r REAL,
    mfe_r REAL
);
CREATE INDEX IF NOT EXISTS idx_trades_mode_time ON trades(mode, entry_time);

CREATE TABLE IF NOT EXISTS equity (
    ts TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    equity REAL NOT NULL,
    unrealised REAL DEFAULT 0,
    open_positions INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    ts TEXT NOT NULL,
    symbol TEXT, side TEXT, qty REAL, status TEXT,
    filled_qty REAL, avg_fill_price REAL, fee REAL, note TEXT
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    level TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL
);
"""


class Store:
    def __init__(self, path: str = "./state/quantdesk.db"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._conn()) as c:
            c.executescript(SCHEMA)
            c.commit()

    def _conn(self) -> sqlite3.Connection:
        c = sqlite3.connect(str(self.path), timeout=10)
        c.row_factory = sqlite3.Row
        return c

    # -- meta --------------------------------------------------------------
    def set_meta(self, key: str, value: Any) -> None:
        with closing(self._conn()) as c:
            c.execute("INSERT OR REPLACE INTO meta(k, v) VALUES (?, ?)",
                      (key, json.dumps(value)))
            c.commit()

    def get_meta(self, key: str, default: Any = None) -> Any:
        with closing(self._conn()) as c:
            row = c.execute("SELECT v FROM meta WHERE k = ?", (key,)).fetchone()
        if row is None:
            return default
        try:
            return json.loads(row["v"])
        except Exception:
            return default

    def mark_paper_start(self) -> str:
        """Recorded once and never overwritten -- restarting the bot must not
        reset the paper-trading clock the gate depends on."""
        existing = self.get_meta("paper_start")
        if existing:
            return existing
        now = datetime.now(timezone.utc).isoformat()
        self.set_meta("paper_start", now)
        return now

    def paper_days(self) -> float:
        start = self.get_meta("paper_start")
        if not start:
            return 0.0
        try:
            t0 = datetime.fromisoformat(start)
        except ValueError:
            return 0.0
        return (datetime.now(timezone.utc) - t0).total_seconds() / 86400.0

    # -- trades ------------------------------------------------------------
    def record_trade(self, mode: str, t: Dict[str, Any]) -> None:
        cols = ("symbol", "strategy", "timeframe", "direction", "qty", "entry_time",
                "entry_price", "exit_time", "exit_price", "stop_price", "target_price",
                "pnl", "pnl_r", "fees", "bars_held", "exit_reason", "mae_r", "mfe_r")
        vals = [mode] + [t.get(c) for c in cols]
        with closing(self._conn()) as c:
            c.execute(
                f"INSERT INTO trades(mode, {', '.join(cols)}) "
                f"VALUES ({', '.join(['?'] * (len(cols) + 1))})",
                vals,
            )
            c.commit()

    def trades(self, mode: Optional[str] = None, limit: int = 500) -> List[dict]:
        q = "SELECT * FROM trades"
        args: list = []
        if mode:
            q += " WHERE mode = ?"
            args.append(mode)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with closing(self._conn()) as c:
            return [dict(r) for r in c.execute(q, args).fetchall()]

    # -- equity ------------------------------------------------------------
    def record_equity(self, mode: str, equity: float, unrealised: float = 0.0,
                      open_positions: int = 0) -> None:
        with closing(self._conn()) as c:
            c.execute(
                "INSERT OR REPLACE INTO equity(ts, mode, equity, unrealised, open_positions) "
                "VALUES (?, ?, ?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(), mode, equity, unrealised, open_positions),
            )
            c.commit()

    def equity_curve(self, mode: Optional[str] = None, limit: int = 5000) -> List[dict]:
        q = "SELECT * FROM equity"
        args: list = []
        if mode:
            q += " WHERE mode = ?"
            args.append(mode)
        q += " ORDER BY ts ASC LIMIT ?"
        args.append(limit)
        with closing(self._conn()) as c:
            return [dict(r) for r in c.execute(q, args).fetchall()]

    # -- orders ------------------------------------------------------------
    def record_order(self, mode: str, o: Dict[str, Any]) -> None:
        with closing(self._conn()) as c:
            c.execute(
                "INSERT OR REPLACE INTO orders"
                "(id, mode, ts, symbol, side, qty, status, filled_qty, avg_fill_price, fee, note) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (o.get("id"), mode, o.get("created_at"), o.get("symbol"), o.get("side"),
                 o.get("qty"), o.get("status"), o.get("filled_qty"),
                 o.get("avg_fill_price"), o.get("fee"), o.get("note")),
            )
            c.commit()

    def orders(self, limit: int = 100) -> List[dict]:
        with closing(self._conn()) as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM orders ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()]

    # -- events ------------------------------------------------------------
    def log_event(self, level: str, kind: str, message: str) -> None:
        with closing(self._conn()) as c:
            c.execute(
                "INSERT INTO events(ts, level, kind, message) VALUES (?,?,?,?)",
                (datetime.now(timezone.utc).isoformat(), level, kind, message),
            )
            c.commit()

    def events(self, limit: int = 200) -> List[dict]:
        with closing(self._conn()) as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()]
