# QuantDesk

A crypto quantitative research and trading system: 43 strategies, a
cost-realistic backtester, walk-forward validation, Monte Carlo stress testing,
a risk engine with hard limits, paper trading, and a dense terminal dashboard.

**Read [`docs/QUANT_PRIMER.md`](docs/QUANT_PRIMER.md) before trusting any number
this produces.** It explains why most backtests lie and how to tell whether
yours is one of them.

---

## What this is, and is not

**Is:** a rigorous instrument for finding out whether a trading idea has an edge,
and for trading it safely if it does.

**Is not:** a money printer. It has no secret alpha. Its most likely — and most
valuable — output is telling you that a strategy you liked does not work,
before you fund it.

The design assumption throughout is that you are trading a small account against
professionals, and that the main risks are **costs** and **fooling yourself**.
Both are attacked directly:

- The backtester charges taker fees, spread, and ATR-scaled slippage on every
  fill, and executes on the next bar's open so no signal can peek.
- Every result carries a **Deflated Sharpe Ratio**, which discounts your Sharpe
  by the expected best-of-N from the trials you ran.
- Walk-forward validation is the headline result; in-sample backtests are shown
  below it and labelled as weak evidence.
- Live trading is refused until paper results clear a hard performance gate.

---

## Quick start

```bash
cd quantdesk
pip install -r requirements.txt

python cli.py download        # fetch + cache 3y of history (takes a while)
python cli.py backtest        # rough map. distrust the good results.
python cli.py walkforward     # the real test. expect most things to fail.
python cli.py montecarlo      # distribution of outcomes, not one path
python cli.py live            # paper trading + dashboard API
```

Dashboard:

```bash
cd dashboard && npm install && npm run dev
# http://localhost:5173
```

To click through the UI immediately with fabricated data:

```bash
python scripts/seed_demo.py
python scripts/demo_server.py
# then: cd dashboard && npm run dev
# IMPORTANT: rm -rf state results  before any real paper run
```

Tests:

```bash
python tests/test_engine.py     # 12 checks, no pytest required
```

---

## Data sources: why research and trading use different venues

Kraken's public OHLCV endpoint **ignores the `since` parameter** and returns
only the most recent ~720 candles no matter what you request. That is fine for
live trading and useless for research — 720 hourly bars is 30 days, which cannot
support walk-forward validation.

So the engine keeps two exchange handles: `exchange.id` is where you trade, and
`data.history_exchange` is where you download history from. Verified behaviour
(July 2026):

| Venue | Deep history | Notes |
|---|---|---|
| `kucoin` | yes, 1000 bars/page | **default history source** |
| `coinbase` | yes, 300 bars/page | slower to paginate |
| `binanceus` | partial | inconsistent per pair |
| `kraken` | **no** | live trading only |
| `binance` | n/a | HTTP 451 from US IPs |

Symbols are remapped automatically (`BTC/USD` → `BTC/USDT`) since most non-US
venues quote in USDT.

Prices across major venues track closely enough that strategy research
transfers. **Costs do not** — the `costs` block must reflect the venue you
actually trade on, not the one you downloaded from.

### Behind a proxy

ccxt builds its HTTP session with `trust_env = False`, so it ignores
`HTTPS_PROXY` and `REQUESTS_CA_BUNDLE` and fails with certificate errors that
look like exchange outages. `DataFeed._apply_proxy_settings` re-enables both
when those variables are present. No-op on a normal connection.

---

## Layout

```
config/config.yaml          every setting. no Python editing required.
config/.env                 secrets only (API keys, SMTP password). gitignored.

engine/
  indicators.py             ~40 causal, vectorised primitives
  strategies/               43 strategies across 7 families
  backtest/
    engine.py               bar-by-bar simulator + cost model
    metrics.py              full metrics incl. PSR / Deflated Sharpe
    walkforward.py          rolling optimise → trade forward
    montecarlo.py           trade resampling, risk of ruin
  risk/
    manager.py              sizing, exposure caps, daily halt, kill switch
    gate.py                 the go-live checklist
  live/
    broker.py               PaperBroker + CcxtBroker (double-gated)
    runner.py               the trading loop
    state.py                sqlite persistence
    alerts.py               email on the events that need you
  api/server.py             FastAPI + websocket for the dashboard

dashboard/                  React terminal UI (cockpit / research / risk / strategies)
docs/STRATEGIES.md          100+ methods surveyed, with verdicts
docs/QUANT_PRIMER.md        how not to fool yourself
```

---

## Safety architecture

Three independent switches stand between you and live orders:

1. The **performance gate** must pass (`python cli.py gate`)
2. `live.mode: live` in config
3. `QUANTDESK_ALLOW_LIVE=1` in the environment, plus real API keys

No single mistake can arm real money.

Hard ceilings in `engine/risk/manager.py` clamp config values that exceed them,
and report the clamp rather than applying it silently:

| Limit | Ceiling |
|---|---|
| risk per trade | 5% |
| daily loss limit | 10% |
| gross exposure | 100% (no leverage) |
| single position | 50% of equity |

Runtime protections: daily loss halt (resets at UTC midnight), drawdown kill
switch (manual reset only, by design), correlation cap so three "different"
long positions cannot be one BTC bet, and a dashboard flatten button.

### A note on effective risk

With `risk_per_trade: 0.05` and `max_position_pct: 0.40`, the no-leverage
exposure cap binds for any stop tighter than 12.5% of price. Typical 2×ATR
crypto stops are 1–3%, so **actual risk per trade lands around 0.8%, not 5%**.
The dashboard shows both numbers side by side. This is the spot constraint doing
you a favour, not a bug — but do not raise the position cap without understanding
that it removes the favour.

---

## Configuration

Everything lives in `config/config.yaml`. The sections that matter most:

- **`costs`** — the most important block in the file. Defaults are pessimistic
  (Kraken taker 26bps, taker assumed on every fill). Raise them; never lower
  them without fill data proving otherwise.
- **`risk`** — position sizing and loss limits. See ceilings above.
- **`gate`** — the go-live criteria. Editing these to let yourself trade sooner
  is the exact failure mode the gate exists to prevent.
- **`universe`** — `core` is traded, `scanner` is watchlist only and never
  auto-traded.

Secrets go in `config/.env` (never in the yaml):

```
EXCHANGE_API_KEY=...
EXCHANGE_API_SECRET=...
SMTP_PASSWORD=...          # Gmail requires an app password
```

---

## Deployment

Crypto trades 24/7; your laptop does not. For live operation, run on a small
VPS and reach the dashboard over an SSH tunnel — the API binds to 127.0.0.1
because this process can move money and must never listen publicly:

```bash
ssh -L 8787:127.0.0.1:8787 user@your-vps
```

---

## Known limitations

Stated plainly, because a tool that hides its own weaknesses is worse than no tool:

- **Survivorship bias** in the universe — today's liquid majors are survivors.
  No clean fix without a delisted-asset dataset.
- **`cvd_divergence`** approximates CVD from OHLCV. Real CVD needs aggressor-tagged
  tick data. Its results deserve more suspicion than the rest.
- **`book_imbalance` and `funding_skew`** cannot be backtested and are excluded
  from backtest runs rather than tested against fabricated data.
- **Pair trading on spot** has no short leg. `long_only_tilt` degrades it to a
  long tilt, which is not market neutral regardless of what the name suggests.
- **No slippage model for size** — at $500 your market impact is genuinely
  negligible, so this is fine here and would not be at $50k.
- **Paper trading cannot model your psychology.** It has no fear.

---

## License

Personal use. No warranty. Trading involves substantial risk of loss.
