"""Email alerting.

Deliberately narrow: notify on the events that need a human, stay silent
otherwise. An alerter that emails every fill trains you to ignore it, and then
it fails to reach you on the one that mattered.

Credentials come from the environment, never from config.yaml, so the config
file stays safe to commit. For Gmail you need an app password, not your account
password.
"""

from __future__ import annotations

import os
import smtplib
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional


@dataclass
class EmailConfig:
    enabled: bool = False
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    from_addr: str = ""
    to_addr: str = ""
    on_fill: bool = False
    on_stop_out: bool = True
    on_daily_limit: bool = True
    on_kill_switch: bool = True
    on_crash: bool = True
    daily_summary: bool = True


class Alerter:
    def __init__(self, cfg: EmailConfig, log=print):
        self.cfg = cfg
        self.log = log
        self.password = os.getenv("SMTP_PASSWORD", "")
        self._last_summary_day: Optional[str] = None

        if cfg.enabled and not (cfg.from_addr and cfg.to_addr and self.password):
            self.log("[alerts] email enabled but from_addr/to_addr/SMTP_PASSWORD incomplete; disabling")
            self.cfg.enabled = False

    def _send(self, subject: str, body: str) -> None:
        if not self.cfg.enabled:
            return

        def worker() -> None:
            # Sent on a background thread: an SMTP timeout must never stall the
            # trading loop, which could leave a position unmanaged.
            try:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = self.cfg.from_addr
                msg["To"] = self.cfg.to_addr
                msg.set_content(body)
                with smtplib.SMTP(self.cfg.smtp_host, self.cfg.smtp_port, timeout=20) as s:
                    s.starttls()
                    s.login(self.cfg.from_addr, self.password)
                    s.send_message(msg)
            except Exception as e:
                self.log(f"[alerts] send failed: {type(e).__name__}: {e}")

        threading.Thread(target=worker, daemon=True).start()

    # -- typed events ------------------------------------------------------
    def fill(self, symbol: str, side: str, qty: float, price: float, strategy: str) -> None:
        if not self.cfg.on_fill:
            return
        self._send(
            f"[QuantDesk] {side.upper()} {symbol}",
            f"{strategy} filled {side} {qty:.6f} {symbol} @ {price:.4f}",
        )

    def stop_out(self, symbol: str, pnl: float, pnl_r: float, strategy: str) -> None:
        if not self.cfg.on_stop_out:
            return
        self._send(
            f"[QuantDesk] stopped out {symbol} ({pnl_r:+.2f}R)",
            f"{strategy} stopped out of {symbol}\n"
            f"P&L: {pnl:+.2f} ({pnl_r:+.2f}R)",
        )

    def daily_limit(self, day_pnl_pct: float, equity: float) -> None:
        if not self.cfg.on_daily_limit:
            return
        self._send(
            "[QuantDesk] DAILY LOSS LIMIT -- trading halted",
            f"Daily loss limit reached: {day_pnl_pct:.2%}\n"
            f"Equity: {equity:.2f}\n"
            f"Trading is halted until 00:00 UTC.",
        )

    def kill_switch(self, reason: str, equity: float) -> None:
        if not self.cfg.on_kill_switch:
            return
        self._send(
            "[QuantDesk] KILL SWITCH TRIGGERED",
            f"{reason}\n\nEquity: {equity:.2f}\n"
            f"All trading stopped. A manual reset is required.",
        )

    def crash(self, error: str) -> None:
        if not self.cfg.on_crash:
            return
        self._send("[QuantDesk] bot crashed", f"The trading loop raised:\n\n{error}")

    def summary(self, snapshot: dict) -> None:
        """Once per UTC day, on the first tick after the roll."""
        if not self.cfg.daily_summary:
            return
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if self._last_summary_day == today:
            return
        self._last_summary_day = today

        lines = [
            f"Equity:        {snapshot.get('equity', 0):.2f}",
            f"Day P&L:       {snapshot.get('day_pnl', 0):+.2f} "
            f"({snapshot.get('day_pnl_pct', 0):+.2%})",
            f"Drawdown:      {snapshot.get('drawdown', 0):.2%}",
            f"Open:          {snapshot.get('open_positions', 0)}",
            f"Trades today:  {snapshot.get('trades_today', 0)}",
        ]
        self._send(f"[QuantDesk] daily summary {today}", "\n".join(lines))


def config_from_dict(cfg: dict) -> EmailConfig:
    e = (cfg.get("alerts", {}) or {}).get("email", {}) or {}
    return EmailConfig(
        enabled=bool(e.get("enabled", False)),
        smtp_host=str(e.get("smtp_host", "smtp.gmail.com")),
        smtp_port=int(e.get("smtp_port", 587)),
        from_addr=str(e.get("from_addr", "")),
        to_addr=str(e.get("to_addr", "")),
        on_fill=bool(e.get("on_fill", False)),
        on_stop_out=bool(e.get("on_stop_out", True)),
        on_daily_limit=bool(e.get("on_daily_limit", True)),
        on_kill_switch=bool(e.get("on_kill_switch", True)),
        on_crash=bool(e.get("on_crash", True)),
        daily_summary=bool(e.get("daily_summary", True)),
    )
