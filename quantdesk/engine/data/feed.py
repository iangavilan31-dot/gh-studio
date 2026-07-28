"""Market data: fetch from any ccxt exchange, cache to parquet, serve as frames.

Three things this module is careful about, each of which is a documented way
backtests go wrong:

  1. **Incomplete final bar.** The most recent candle from an exchange is still
     forming. Its close is not the close, its high is not the high. Trading
     signals off it produces a backtest that peeks at a bar that had not
     finished. `drop_incomplete` removes it by default.
  2. **Gaps.** Exchanges have outages and delistings. Gaps are left as gaps
     rather than forward-filled into fake bars, because a forward-filled flat
     bar looks to every strategy like genuine low-volatility price action.
  3. **Timezone.** Everything is UTC, always. Session-anchored logic (VWAP,
     opening ranges) silently shifts by hours if a local timezone sneaks in.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import pandas as pd

TF_MS = {
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
    "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
    "6h": 21_600_000, "12h": 43_200_000, "1d": 86_400_000,
}

COLS = ["open", "high", "low", "close", "volume"]


class DataFeed:
    """Market data access.

    Carries two exchange handles, because the venue with the best history is
    rarely the venue you trade on:

      `exchange`         the LIVE venue -- tickers, order books, order placement
      `history_exchange` the RESEARCH venue -- deep OHLCV for backtesting

    When they are the same id, one handle is shared.
    """

    def __init__(self, exchange_id: str = "kraken", cache_dir: str = "./data_cache",
                 enable_rate_limit: bool = True, fetch_limit: int = 720,
                 history_exchange_id: str | None = None,
                 history_quote: str = "USDT"):
        self.exchange_id = exchange_id
        self.history_exchange_id = history_exchange_id or exchange_id
        self.history_quote = history_quote
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.fetch_limit = fetch_limit
        self._ex = None
        self._hist_ex = None
        self._enable_rate_limit = enable_rate_limit

    # -- exchange handle ---------------------------------------------------
    @property
    def exchange(self):
        if self._ex is None:
            import ccxt
            if not hasattr(ccxt, self.exchange_id):
                raise ValueError(f"unknown ccxt exchange {self.exchange_id!r}")
            klass = getattr(ccxt, self.exchange_id)
            cfg = {"enableRateLimit": self._enable_rate_limit}
            # Keys are only needed for trading, never for market data.
            key = os.getenv("EXCHANGE_API_KEY")
            secret = os.getenv("EXCHANGE_API_SECRET")
            if key and secret:
                cfg["apiKey"] = key
                cfg["secret"] = secret
                pw = os.getenv("EXCHANGE_API_PASSWORD")
                if pw:
                    cfg["password"] = pw
            self._ex = klass(cfg)
            self._apply_proxy_settings(self._ex)
        return self._ex

    @property
    def history_exchange(self):
        """Handle for historical OHLCV. Never needs API keys."""
        if self.history_exchange_id == self.exchange_id:
            return self.exchange
        if self._hist_ex is None:
            import ccxt
            if not hasattr(ccxt, self.history_exchange_id):
                raise ValueError(f"unknown ccxt exchange {self.history_exchange_id!r}")
            self._hist_ex = getattr(ccxt, self.history_exchange_id)(
                {"enableRateLimit": self._enable_rate_limit}
            )
            self._apply_proxy_settings(self._hist_ex)
        return self._hist_ex

    def history_symbol(self, symbol: str) -> str:
        """Map a trading symbol onto the history venue's quote currency.

        BTC/USD on Kraken is BTC/USDT on KuCoin. USDT tracks USD closely enough
        that the price series is interchangeable for strategy research; it is
        NOT interchangeable for cost modelling, which is why fees are configured
        separately against the live venue.
        """
        if self.history_exchange_id == self.exchange_id:
            return symbol
        base, _, quote = symbol.partition("/")
        return f"{base}/{self.history_quote}" if quote else symbol

    @staticmethod
    def _apply_proxy_settings(ex) -> None:
        """Honour proxy and CA-bundle environment variables.

        ccxt constructs its requests Session with `trust_env = False`, so it
        ignores HTTP_PROXY / HTTPS_PROXY / REQUESTS_CA_BUNDLE entirely. On a
        home connection that is invisible; behind a corporate or sandbox proxy
        every request fails with a certificate error that looks like an
        exchange outage rather than a local TLS problem.

        Both settings are opt-in via environment variables, so this is a no-op
        on a normal machine.
        """
        if os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or \
                os.getenv("https_proxy") or os.getenv("http_proxy"):
            try:
                ex.session.trust_env = True
            except AttributeError:
                pass    # async ccxt exchanges use aiohttp and have no .session

        ca = os.getenv("REQUESTS_CA_BUNDLE") or os.getenv("SSL_CERT_FILE")
        if ca and Path(ca).exists():
            # ccxt passes verify= explicitly on every call, which overrides the
            # environment variable requests would otherwise pick up.
            ex.verify = ca

    # -- cache -------------------------------------------------------------
    def _path(self, symbol: str, timeframe: str) -> Path:
        safe = symbol.replace("/", "_").replace(":", "-")
        return self.cache / f"{self.exchange_id}_{safe}_{timeframe}.parquet"

    def load_cached(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        p = self._path(symbol, timeframe)
        if not p.exists():
            return None
        try:
            df = pd.read_parquet(p)
            return self._normalise(df)
        except Exception:
            return None

    def _save(self, symbol: str, timeframe: str, df: pd.DataFrame) -> None:
        try:
            df.to_parquet(self._path(symbol, timeframe))
        except Exception:
            # A parquet failure must not lose the in-memory data.
            pass

    # -- fetching ----------------------------------------------------------
    def download(
        self,
        symbol: str,
        timeframe: str,
        years: float = 3.0,
        force: bool = False,
        log=print,
    ) -> pd.DataFrame:
        """Fetch history, resuming from cache where possible."""
        if timeframe not in TF_MS:
            raise ValueError(f"unsupported timeframe {timeframe!r}")

        cached = None if force else self.load_cached(symbol, timeframe)
        now_ms = int(time.time() * 1000)
        want_start = now_ms - int(years * 365.25 * 86_400_000)

        if cached is not None and len(cached):
            last_ms = int(cached.index[-1].timestamp() * 1000)
            # Only fetch forward from what we already have.
            since = last_ms + TF_MS[timeframe]
            if since >= now_ms - TF_MS[timeframe]:
                return self._finalise(cached, timeframe)
            frames = [cached]
        else:
            since = want_start
            frames = []

        step = TF_MS[timeframe] * self.fetch_limit
        fetched: List[list] = []
        cursor = since
        empty_streak = 0
        ex = self.history_exchange
        remote_symbol = self.history_symbol(symbol)

        while cursor < now_ms:
            try:
                batch = ex.fetch_ohlcv(
                    remote_symbol, timeframe, since=cursor, limit=self.fetch_limit
                )
            except Exception as e:
                log(f"  fetch error {symbol} {timeframe}: {type(e).__name__}: {e}")
                break

            if not batch:
                empty_streak += 1
                # A few empty windows are normal (exchange downtime, pre-listing).
                # A long run of them means we are past the end of available data.
                if empty_streak >= 3:
                    break
                cursor += step
                continue

            empty_streak = 0
            fetched.extend(batch)
            last = batch[-1][0]
            if last <= cursor:
                break
            cursor = last + TF_MS[timeframe]

        if fetched:
            new = pd.DataFrame(fetched, columns=["ts"] + COLS)
            new["ts"] = pd.to_datetime(new["ts"], unit="ms", utc=True)
            new = new.set_index("ts")
            frames.append(new)

        if not frames:
            return pd.DataFrame(columns=COLS)

        df = pd.concat(frames)
        df = self._normalise(df)
        self._save(symbol, timeframe, df)
        return self._finalise(df, timeframe)

    def fetch_recent(self, symbol: str, timeframe: str, limit: int = 300) -> pd.DataFrame:
        """Live path: most recent bars only, no caching."""
        try:
            batch = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        except Exception:
            return pd.DataFrame(columns=COLS)
        if not batch:
            return pd.DataFrame(columns=COLS)
        df = pd.DataFrame(batch, columns=["ts"] + COLS)
        df["ts"] = pd.to_datetime(df["ts"], unit="ms", utc=True)
        return self._finalise(self._normalise(df.set_index("ts")), timeframe)

    def fetch_ticker(self, symbol: str) -> dict:
        try:
            return self.exchange.fetch_ticker(symbol)
        except Exception:
            return {}

    def fetch_order_book(self, symbol: str, limit: int = 20) -> dict:
        """Live depth. Used by book_imbalance, which cannot be backtested."""
        try:
            return self.exchange.fetch_order_book(symbol, limit=limit)
        except Exception:
            return {}

    # -- shaping -----------------------------------------------------------
    @staticmethod
    def _normalise(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index, utc=True)
        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC")
        else:
            df.index = df.index.tz_convert("UTC")
        for c in COLS:
            if c not in df:
                df[c] = 0.0
            df[c] = pd.to_numeric(df[c], errors="coerce")
        df = df[COLS]
        df = df[~df.index.duplicated(keep="last")].sort_index()
        return df.dropna(subset=["open", "high", "low", "close"])

    @staticmethod
    def _finalise(df: pd.DataFrame, timeframe: str, drop_incomplete: bool = True) -> pd.DataFrame:
        """Drop the still-forming final candle.

        Without this, every strategy gets to see a partial bar's close as if the
        bar had completed -- a subtle lookahead that inflates results and is
        very hard to spot after the fact.
        """
        if not drop_incomplete or df.empty:
            return df
        bar_ms = TF_MS.get(timeframe, 3_600_000)
        now_ms = int(time.time() * 1000)
        last_ms = int(df.index[-1].timestamp() * 1000)
        if now_ms - last_ms < bar_ms:
            return df.iloc[:-1]
        return df


def load_universe(
    feed: DataFeed,
    symbols: Iterable[str],
    timeframe: str,
    years: float = 3.0,
    cached_only: bool = False,
    log=print,
) -> Dict[str, pd.DataFrame]:
    out: Dict[str, pd.DataFrame] = {}
    for s in symbols:
        if cached_only:
            df = feed.load_cached(s, timeframe)
            if df is not None:
                df = DataFeed._finalise(df, timeframe)
        else:
            log(f"  {s} {timeframe} ...")
            df = feed.download(s, timeframe, years, log=log)
        if df is not None and len(df) > 100:
            out[s] = df
    return out
