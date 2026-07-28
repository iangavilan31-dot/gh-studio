"""Vectorised technical primitives.

Every function takes and returns pandas Series/DataFrames aligned to the input
index, and every one of them is causal: the value at bar *i* uses only data up
to and including bar *i*. That property is not decoration -- a single
forward-looking indicator will produce a beautiful backtest and lose money in
production, and it is the most common defect in retail strategy code.

The rule enforced throughout: rolling windows are trailing, `shift()` is used
to reference prior bars, and nothing centres a window.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------
# moving averages
# --------------------------------------------------------------------------

def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def wma(s: pd.Series, n: int) -> pd.Series:
    w = np.arange(1, n + 1, dtype=float)
    return s.rolling(n, min_periods=n).apply(lambda x: np.dot(x, w) / w.sum(), raw=True)


def hma(s: pd.Series, n: int) -> pd.Series:
    """Hull MA -- much less lag than EMA at the cost of some overshoot."""
    half = max(1, n // 2)
    sqrt_n = max(1, int(np.sqrt(n)))
    return wma(2 * wma(s, half) - wma(s, n), sqrt_n)


def kama(s: pd.Series, n: int = 10, fast: int = 2, slow: int = 30) -> pd.Series:
    """Kaufman adaptive MA. Speeds up in trends, flattens in chop -- which is
    exactly the behaviour you want from a trend filter in crypto."""
    change = (s - s.shift(n)).abs()
    volatility = s.diff().abs().rolling(n, min_periods=n).sum()
    er = (change / volatility.replace(0, np.nan)).fillna(0.0)
    sc = (er * (2 / (fast + 1) - 2 / (slow + 1)) + 2 / (slow + 1)) ** 2

    out = np.full(len(s), np.nan)
    vals, scv = s.to_numpy(dtype=float), sc.to_numpy(dtype=float)
    start = n
    if len(s) > start:
        out[start] = vals[start]
        for i in range(start + 1, len(s)):
            if np.isnan(out[i - 1]):
                out[i] = vals[i]
            else:
                out[i] = out[i - 1] + scv[i] * (vals[i] - out[i - 1])
    return pd.Series(out, index=s.index)


# --------------------------------------------------------------------------
# volatility
# --------------------------------------------------------------------------

def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    return pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """Wilder-smoothed ATR. The unit of risk for the whole system: stops are
    quoted in ATRs and position size solves back from that distance."""
    return true_range(df).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def natr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """ATR as a fraction of price -- comparable across BTC at $90k and DOGE at
    $0.30, which raw ATR is not."""
    return atr(df, n) / df["close"]


def realised_vol(s: pd.Series, n: int = 20, periods_per_year: int = 35040) -> pd.Series:
    return s.pct_change().rolling(n, min_periods=n).std() * np.sqrt(periods_per_year)


def parkinson_vol(df: pd.DataFrame, n: int = 20) -> pd.Series:
    """Uses the high-low range, so it extracts far more information per bar
    than close-to-close. Converges roughly 5x faster."""
    hl = np.log(df["high"] / df["low"]) ** 2
    return np.sqrt(hl.rolling(n, min_periods=n).mean() / (4 * np.log(2)))


def bollinger(s: pd.Series, n: int = 20, k: float = 2.0):
    mid = sma(s, n)
    sd = s.rolling(n, min_periods=n).std()
    return mid - k * sd, mid, mid + k * sd


def bb_width(s: pd.Series, n: int = 20, k: float = 2.0) -> pd.Series:
    lo, mid, hi = bollinger(s, n, k)
    return (hi - lo) / mid


def keltner(df: pd.DataFrame, n: int = 20, k: float = 2.0):
    mid = ema(df["close"], n)
    a = atr(df, n)
    return mid - k * a, mid, mid + k * a


def squeeze_on(df: pd.DataFrame, n: int = 20) -> pd.Series:
    """TTM-squeeze condition: Bollinger Bands inside Keltner Channels, i.e.
    volatility compressed. Historically the highest-quality *precondition* for
    a breakout, though it says nothing about direction."""
    bl, _, bh = bollinger(df["close"], n, 2.0)
    kl, _, kh = keltner(df, n, 1.5)
    return (bl > kl) & (bh < kh)


# --------------------------------------------------------------------------
# oscillators
# --------------------------------------------------------------------------

def rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    rs = up / dn.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50.0)


def stoch_rsi(s: pd.Series, n: int = 14, k: int = 3, d: int = 3):
    r = rsi(s, n)
    lo = r.rolling(n, min_periods=n).min()
    hi = r.rolling(n, min_periods=n).max()
    raw = ((r - lo) / (hi - lo).replace(0, np.nan)) * 100
    kk = raw.rolling(k, min_periods=k).mean()
    return kk, kk.rolling(d, min_periods=d).mean()


def macd(s: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    line = ema(s, fast) - ema(s, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def cci(df: pd.DataFrame, n: int = 20) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    m = sma(tp, n)
    md = (tp - m).abs().rolling(n, min_periods=n).mean()
    return (tp - m) / (0.015 * md.replace(0, np.nan))


def williams_r(df: pd.DataFrame, n: int = 14) -> pd.Series:
    hh = df["high"].rolling(n, min_periods=n).max()
    ll = df["low"].rolling(n, min_periods=n).min()
    return -100 * (hh - df["close"]) / (hh - ll).replace(0, np.nan)


def zscore(s: pd.Series, n: int = 20) -> pd.Series:
    """Trailing z-score. The workhorse of every mean-reversion strategy here."""
    m = s.rolling(n, min_periods=n).mean()
    sd = s.rolling(n, min_periods=n).std()
    return (s - m) / sd.replace(0, np.nan)


def hurst(s: pd.Series, n: int = 100, max_lag: int = 20) -> pd.Series:
    """Rolling Hurst exponent via rescaled-variance of lagged differences.

    H < 0.5 mean-reverting, H ~ 0.5 random walk, H > 0.5 trending. Used as a
    regime switch: run reversion strategies only when H says reversion is
    actually the local behaviour, rather than assuming it always is.
    """
    logp = np.log(s.replace(0, np.nan))
    lags = np.arange(2, max_lag)
    log_lags = np.log(lags)

    def _h(window: np.ndarray) -> float:
        taus = []
        for lag in lags:
            diff = window[lag:] - window[:-lag]
            taus.append(np.sqrt(np.std(diff)) if diff.size else np.nan)
        taus = np.asarray(taus)
        if np.any(~np.isfinite(taus)) or np.any(taus <= 0):
            return np.nan
        return float(np.polyfit(log_lags, np.log(taus), 1)[0] * 2.0)

    return logp.rolling(n, min_periods=n).apply(_h, raw=True)


# --------------------------------------------------------------------------
# trend strength / direction
# --------------------------------------------------------------------------

def adx(df: pd.DataFrame, n: int = 14):
    up = df["high"].diff()
    dn = -df["low"].diff()
    plus_dm = np.where((up > dn) & (up > 0), up, 0.0)
    minus_dm = np.where((dn > up) & (dn > 0), dn, 0.0)
    tr = true_range(df).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    pdi = 100 * pd.Series(plus_dm, index=df.index).ewm(
        alpha=1 / n, adjust=False, min_periods=n).mean() / tr.replace(0, np.nan)
    mdi = 100 * pd.Series(minus_dm, index=df.index).ewm(
        alpha=1 / n, adjust=False, min_periods=n).mean() / tr.replace(0, np.nan)
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
    return dx.ewm(alpha=1 / n, adjust=False, min_periods=n).mean(), pdi, mdi


def supertrend(df: pd.DataFrame, n: int = 10, mult: float = 3.0) -> pd.Series:
    """Returns +1/-1 regime. Implemented with the proper stateful band-ratchet;
    the naive vectorised version flip-flops and is subtly wrong."""
    a = atr(df, n)
    hl2 = (df["high"] + df["low"]) / 2
    upper = (hl2 + mult * a).to_numpy(dtype=float)
    lower = (hl2 - mult * a).to_numpy(dtype=float)
    close = df["close"].to_numpy(dtype=float)

    direction = np.ones(len(df))
    fu, fl = upper.copy(), lower.copy()
    for i in range(1, len(df)):
        if np.isnan(upper[i]) or np.isnan(fu[i - 1]):
            continue
        fu[i] = upper[i] if (upper[i] < fu[i - 1] or close[i - 1] > fu[i - 1]) else fu[i - 1]
        fl[i] = lower[i] if (lower[i] > fl[i - 1] or close[i - 1] < fl[i - 1]) else fl[i - 1]
        if close[i] > fu[i - 1]:
            direction[i] = 1
        elif close[i] < fl[i - 1]:
            direction[i] = -1
        else:
            direction[i] = direction[i - 1]
    return pd.Series(direction, index=df.index)


def donchian(df: pd.DataFrame, n: int = 20):
    """Note the shift(1): the channel must exclude the current bar or the
    breakout test compares a bar against a range that already contains it,
    which never triggers correctly."""
    return (
        df["low"].rolling(n, min_periods=n).min().shift(1),
        df["high"].rolling(n, min_periods=n).max().shift(1),
    )


def aroon(df: pd.DataFrame, n: int = 25):
    up = df["high"].rolling(n + 1, min_periods=n + 1).apply(
        lambda x: 100 * (n - (len(x) - 1 - int(np.argmax(x)))) / n, raw=True)
    dn = df["low"].rolling(n + 1, min_periods=n + 1).apply(
        lambda x: 100 * (n - (len(x) - 1 - int(np.argmin(x)))) / n, raw=True)
    return up, dn


def efficiency_ratio(s: pd.Series, n: int = 20) -> pd.Series:
    """Net movement / total movement. Near 1 = clean trend, near 0 = chop.
    The cheapest and most reliable trade/no-trade filter in the library."""
    direction = (s - s.shift(n)).abs()
    noise = s.diff().abs().rolling(n, min_periods=n).sum()
    return direction / noise.replace(0, np.nan)


# --------------------------------------------------------------------------
# volume / flow
# --------------------------------------------------------------------------

def session_periods(index: pd.DatetimeIndex, freq: str = "D") -> pd.PeriodIndex:
    """Session grouping key, timezone-safe.

    `DatetimeIndex.to_period` discards tz information with a warning. Since all
    indices here are UTC by construction, dropping the tz explicitly is both
    correct and silent.
    """
    idx = index.tz_convert("UTC").tz_localize(None) if index.tz is not None else index
    return idx.to_period(freq)


def vwap_session(df: pd.DataFrame, freq: str = "D") -> pd.Series:
    """Anchored intraday VWAP, reset each session. Institutional reference
    price -- price genuinely does gravitate back toward it intraday."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    grp = session_periods(df.index, freq)
    pv = (tp * df["volume"]).groupby(grp).cumsum()
    vv = df["volume"].groupby(grp).cumsum()
    return pv / vv.replace(0, np.nan)


def rolling_vwap(df: pd.DataFrame, n: int = 48) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    pv = (tp * df["volume"]).rolling(n, min_periods=n).sum()
    vv = df["volume"].rolling(n, min_periods=n).sum()
    return pv / vv.replace(0, np.nan)


def obv(df: pd.DataFrame) -> pd.Series:
    return (np.sign(df["close"].diff()).fillna(0) * df["volume"]).cumsum()


def money_flow_index(df: pd.DataFrame, n: int = 14) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    rmf = tp * df["volume"]
    up = rmf.where(tp > tp.shift(1), 0.0).rolling(n, min_periods=n).sum()
    dn = rmf.where(tp < tp.shift(1), 0.0).rolling(n, min_periods=n).sum()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


def volume_zscore(df: pd.DataFrame, n: int = 96) -> pd.Series:
    return zscore(df["volume"], n)


def cvd_proxy(df: pd.DataFrame) -> pd.Series:
    """Cumulative volume delta approximated from OHLCV.

    Real CVD needs tick-by-tick aggressor flags, which spot OHLCV does not
    carry. This splits each bar's volume by where the close sits inside the
    bar's range -- a documented approximation, not the real thing. Treated as
    a weak signal accordingly.
    """
    rng = (df["high"] - df["low"]).replace(0, np.nan)
    frac = ((df["close"] - df["low"]) - (df["high"] - df["close"])) / rng
    return (frac.fillna(0.0) * df["volume"]).cumsum()


def amihud_illiquidity(df: pd.DataFrame, n: int = 96) -> pd.Series:
    """|return| per unit of dollar volume. High = your order will move the
    market. Used to veto entries in symbols that are too thin for your size."""
    dv = (df["close"] * df["volume"]).replace(0, np.nan)
    return (df["close"].pct_change().abs() / dv).rolling(n, min_periods=n).mean()


# --------------------------------------------------------------------------
# structure
# --------------------------------------------------------------------------

def swing_points(df: pd.DataFrame, left: int = 3, right: int = 3):
    """Confirmed swing highs/lows, shifted right so a swing is only known once
    `right` bars have closed after it. Unshifted pivots are lookahead bias and
    are why so many 'support/resistance' backtests are fiction."""
    hi = df["high"]
    lo = df["low"]
    is_high = (hi == hi.rolling(left + right + 1, center=True, min_periods=left + right + 1).max())
    is_low = (lo == lo.rolling(left + right + 1, center=True, min_periods=left + right + 1).min())
    return is_high.shift(right).fillna(False), is_low.shift(right).fillna(False)


def fractal_dimension(s: pd.Series, n: int = 30) -> pd.Series:
    return 2.0 - efficiency_ratio(s, n).clip(1e-6, 1.0).pipe(np.log).div(np.log(1 / n)).fillna(0)


def rolling_beta(a: pd.Series, b: pd.Series, n: int = 96) -> pd.Series:
    ra, rb = a.pct_change(), b.pct_change()
    cov = ra.rolling(n, min_periods=n).cov(rb)
    var = rb.rolling(n, min_periods=n).var()
    return cov / var.replace(0, np.nan)


def rolling_corr(a: pd.Series, b: pd.Series, n: int = 96) -> pd.Series:
    return a.pct_change().rolling(n, min_periods=n).corr(b.pct_change())


def half_life(spread: pd.Series) -> float:
    """Ornstein-Uhlenbeck half-life of mean reversion, in bars.

    Estimated by regressing dS on lagged S. Gives the honest holding period for
    a pair trade: if the half-life is 400 bars on a 5m chart, that is a
    multi-day hold and the funding/fee cost has to be paid for that long.
    Returns inf when the spread is not actually mean-reverting.
    """
    s = spread.dropna()
    if len(s) < 30:
        return float("inf")
    lag = s.shift(1).dropna()
    delta = (s - s.shift(1)).dropna()
    lag, delta = lag.align(delta, join="inner")
    if len(lag) < 30 or lag.std() == 0:
        return float("inf")
    beta = np.polyfit(lag.to_numpy(), delta.to_numpy(), 1)[0]
    if beta >= 0:
        return float("inf")
    return float(-np.log(2) / beta)
