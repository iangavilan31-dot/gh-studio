# Strategy research

A survey of trading strategies applicable to a small retail crypto account,
what the evidence says about each, and which ones are implemented here.

The organising question throughout is not "does this idea sound clever" but
**"can this survive 26 basis points of taker fee, each way, on a $500 account
running on a laptop?"** That filter kills most of the field, and it kills it
before you lose money finding out.

---

## Part 1 — the constraints that decide everything

Before any strategy, four numbers govern what is possible.

### 1.1 Costs

At Kraken's base tier you pay 0.26% taker. A round trip is **0.52%**. Add the
half-spread twice (~0.02–0.08% on majors) and ATR-scaled slippage, and a
realistic round trip on a liquid pair is **0.55–0.70%**.

That means:

| Trades/day | Annual cost drag |
|---|---|
| 1 | ~180% |
| 3 | ~550% |
| 10 | ~1,800% |

Those are not typos. **A strategy trading ten times a day must generate over
eighteen times your capital annually in gross profit just to break even.** No
retail strategy does this. This single table eliminates scalping as a viable
approach at retail fee tiers, and it is why the backtester charges full costs by
default rather than offering an "ignore fees" switch.

The implication runs the other way too: the cheapest edge available to you is
**trading less**. A strategy with a mediocre signal and low turnover routinely
beats a better signal with high turnover.

### 1.2 Account size

$500 with no leverage caps a position at $500. With ATR-based sizing and a 40%
position cap, the exposure cap binds on nearly every trade (see
`engine/risk/manager.py::effective_risk_pct`). Your effective risk per trade is
around 0.5–1%, not the 5% configured. This is visible on the dashboard's risk
panel rather than hidden.

Consequences: strategies needing many simultaneous positions (cross-sectional
momentum wants 10+) cannot be run properly. Strategies needing a short leg
(pair trading) cannot be run on spot without margin.

### 1.3 Latency

You are polling REST over the public internet on a 15-second cadence from a
laptop. Round-trip latency is 50–500ms and jittery. Anything whose edge decays
faster than ~1 minute is unavailable to you. That removes market making, latency
arbitrage, true order-book alpha, and every form of front-running.

### 1.4 Multiple testing

If you test 200 strategy configurations and pick the best, its Sharpe is
inflated by the selection itself even when every strategy is worthless. The
expected maximum Sharpe from N worthless strategies grows roughly with
`sqrt(2·log N)`. This is why `metrics.py` computes the **Deflated Sharpe Ratio**
and why the walk-forward optimiser reports its trial count.

---

## Part 2 — the catalogue

Verdicts:

- **IMPLEMENTED** — in this codebase, backtestable, worth measuring
- **IMPLEMENTED (live-only)** — implemented but cannot be honestly backtested
- **REJECTED** — not viable at this account size / latency / cost structure
- **EXCLUDED** — harmful, or requires infrastructure far beyond scope

### 2.1 Trend & momentum (9 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 1 | Time-series momentum | **IMPLEMENTED** `ts_momentum` | Strongest academic pedigree in crypto. Literature reports Sharpe ~1.5 at 28d lookback / 5d hold. Low turnover, little to overfit. |
| 2 | EMA crossover + ADX filter | **IMPLEMENTED** `ema_cross` | Unfiltered MA crosses bleed in chop; the ADX gate is what makes it survivable. |
| 3 | Supertrend (ATR band regime) | **IMPLEMENTED** `supertrend` | Ratcheting bands make it sticky → low turnover → clears fees better than most. |
| 4 | MACD histogram + regime filter | **IMPLEMENTED** `macd_trend` | Counter-trend MACD signals are where the indicator earns its bad name; the regime EMA suppresses them. |
| 5 | KAMA adaptive trend | **IMPLEMENTED** `kama_trend` | Adaptive smoothing + efficiency-ratio chop filter. Cheapest known whipsaw fix. |
| 6 | Dual momentum (abs + relative) | **IMPLEMENTED** `dual_momentum` | Requiring both keeps you out of assets rising only because the whole market is. |
| 7 | ADX/DI directional | **IMPLEMENTED** `adx_di` | Trades on trend-strength confirmation rather than price-MA lag. |
| 8 | Hull MA slope | **IMPLEMENTED** `hma_slope` | Low lag, more false turns. The fast end of the family, for cost comparison. |
| 9 | Elder triple screen | **IMPLEMENTED** `triple_screen` | Buying dips in uptrends is one of few classical setups with a defensible mechanism. |
| 10 | Ichimoku cloud | REJECTED | Five interlocking parameters, no independent evidence beyond generic trend following, high overfit surface. Adds nothing `supertrend` doesn't. |
| 11 | Parabolic SAR | REJECTED | Extremely high turnover by construction. Dies to fees. |
| 12 | Guppy multiple MA | REJECTED | Twelve MAs is a visualisation, not a signal. Collapses to a slow crossover. |
| 13 | Linear-regression channel slope | REJECTED | Near-duplicate of `hma_slope`; would add a correlated strategy, not a new one. |

### 2.2 Mean reversion (8 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 14 | Z-score reversion | **IMPLEMENTED** `zscore_reversion` | The canonical reversion trade. ADX ceiling stops it fading real trends. |
| 15 | Bollinger band fade | **IMPLEMENTED** `bollinger_fade` | Optional reversal confirmation avoids catching falling knives. |
| 16 | RSI extremes + trend filter | **IMPLEMENTED** `rsi_extreme` | Naked RSI<30 has been arbitraged flat for years. Value is in filter and exit. |
| 17 | VWAP reversion | **IMPLEMENTED** `vwap_reversion` | Real mechanism: VWAP is the benchmark execution algos are measured against. |
| 18 | Hurst-gated reversion | **IMPLEMENTED** `hurst_reversion` | Only fires when the series is *measurably* mean-reverting. Most honest, trades least. |
| 19 | Keltner snapback | **IMPLEMENTED** `keltner_snapback` | ATR-based channel adapts to vol shifts faster than Bollinger. |
| 20 | Unconfirmed-move fade | **IMPLEMENTED** `gap_fade` | Big move on thin volume = liquidity vacuum, retraces more often than real repricing. |
| 21 | Bollinger %B + bandwidth floor | **IMPLEMENTED** `percent_b` | Bandwidth condition matters — fading a compressed band has no room to revert into. |
| 22 | Martingale / grid averaging | **EXCLUDED** | Mathematically guaranteed to eventually lose everything. Wins constantly until the one time it doesn't. The most reliable account-destroyer in retail crypto. |
| 23 | Naked support/resistance bounce | REJECTED | "Levels" drawn from unconfirmed pivots are lookahead bias. Confirmed version is `breakout_retest`. |
| 24 | Pivot point reversion | REJECTED | Floor-trader pivots are an artifact of pit-era session structure. No mechanism in 24/7 crypto. |
| 25 | Stochastic oscillator reversion | REJECTED | Near-duplicate of RSI extremes; correlated, adds nothing. |

### 2.3 Breakout (6 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 26 | Donchian channel | **IMPLEMENTED** `donchian` | The original Turtle system. Reasonable baseline. |
| 27 | Opening range breakout | **IMPLEMENTED** `orb` | Anchored to UTC daily roll where derivatives settlement volume concentrates. |
| 28 | Volatility squeeze breakout | **IMPLEMENTED** `squeeze_breakout` | Volatility clustering is genuinely forecastable; the squeeze is the real part. |
| 29 | Volatility breakout (Williams) | **IMPLEMENTED** `vol_breakout` | Crude, very well studied, decades of out-of-sample survival across markets. |
| 30 | Breakout + retest | **IMPLEMENTED** `breakout_retest` | Trades far less, misses runaways, sidesteps false breaks. |
| 31 | N-day high (long only) | **IMPLEMENTED** `n_day_high` | Control strategy. Anything more complex that can't beat it is complexity without payoff. |
| 32 | Chart patterns (H&S, flags, triangles) | REJECTED | No reproducible detection rule; every implementation encodes the author's hindsight. Studies that formalise them find no edge. |
| 33 | Fibonacci retracement | REJECTED | No mechanism. Levels are arbitrary; apparent efficacy is confirmation bias over a dense grid of lines. |
| 34 | Elliott wave | REJECTED | Unfalsifiable — the count is revised after the fact. Not a testable strategy. |

### 2.4 Volatility (5 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 35 | Volatility regime filter | **IMPLEMENTED** `vol_regime` | Both vol tails are unprofitable, for different reasons. |
| 36 | Volatility targeting | **IMPLEMENTED** `vol_target_trend` | **The single highest-value idea in this codebase.** Near-free Sharpe improvement, used by essentially every real systematic fund. |
| 37 | ATR compression → expansion | **IMPLEMENTED** `atr_expansion` | Direct play on volatility clustering. |
| 38 | Regime switch (trend/revert) | **IMPLEMENTED** `regime_switch` | Encodes the key structural fact: correct strategy is a function of regime. |
| 39 | Vol-of-vol caution | **IMPLEMENTED** `vol_of_vol` | Risk decision more than return: unstable vol makes ATR stops unreliable. |
| 40 | GARCH forecast sizing | REJECTED (future work) | Sound, but a rolling GARCH fit adds heavy compute for a marginal gain over realised-vol targeting. |
| 41 | Options vol-surface arb | REJECTED | Requires an options venue, far more capital, and market-making infrastructure. |

### 2.5 Microstructure & flow (7 implemented, 2 live-only)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 42 | Volume-spike exhaustion | **IMPLEMENTED** `volume_exhaustion` | Aggressive flow absorbed by passive liquidity → aggressors offside. |
| 43 | Liquidation cascade fade | **IMPLEMENTED** `liquidation_cascade` | Forced selling is price-insensitive, so it systematically overshoots. One of the better-founded fades in leveraged crypto. |
| 44 | CVD divergence | **IMPLEMENTED** `cvd_divergence` | ⚠ Uses an OHLCV approximation of CVD, not real aggressor-tagged prints. Weaker than the same idea on tick data. |
| 45 | VWAP flow following | **IMPLEMENTED** `vwap_flow` | Deliberate mirror of `vwap_reversion` so the data can decide which dominates. |
| 46 | Illiquidity veto (Amihud) | **IMPLEMENTED** `liquidity_filter` | Cost-avoidance overlay, not a return generator. |
| 47 | Order-book imbalance | **IMPLEMENTED (live-only)** `book_imbalance` | Signal is real and well documented. Half-life is seconds. Excluded from backtests because OHLCV has no depth — a backtest of an unreconstructable signal is worse than none. |
| 48 | Funding-rate skew | **IMPLEMENTED (live-only)** `funding_skew` | Marks crowded positioning. Needs a perp venue; returns flat on spot rather than inventing data. |
| 49 | Market making / spread capture | REJECTED | Needs sub-ms cancel/replace and inventory management. You will be adversely selected on every fill. |
| 50 | Latency arbitrage | REJECTED | Requires colocation. Structurally unavailable. |
| 51 | Iceberg/spoof detection | REJECTED | Needs full L3 message feed. Not in any public REST API. |
| 52 | **Sandwich attacks / MEV front-running** | **EXCLUDED** | Profit comes directly from a specific victim's worse fill. Beyond that: saturated arms race requiring private orderflow deals with block builders and colocated infra; retail loses gas on failed bundles. Wrong by four orders of magnitude on capital. |
| 53 | Cross-exchange arbitrage | **MONITOR ONLY** (`cli.py arb`) | Legitimate — no victim. But after two taker fees, transfer latency and dual-leg fill risk, net is essentially always negative at retail. Monitored on the dashboard so you can see this rather than assume it. |
| 54 | Triangular arbitrage | REJECTED | Same economics as above with three legs instead of two. Worse. |

### 2.6 Statistical arbitrage (5 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 55 | Cointegrated pair spread | **IMPLEMENTED** `pair_spread` | Rolling hedge ratio + half-life gate. ⚠ Needs a short leg — spot-only degrades it to a long tilt, which is *not* market neutral. |
| 56 | Ratio reversion | **IMPLEMENTED** `ratio_reversion` | Fewer parameters than the spread trade; often no worse on tightly-linked pairs. |
| 57 | Beta-neutral residual | **IMPLEMENTED** `beta_residual` | Nearly all crypto beta is BTC beta; the residual is the closest available thing to idiosyncratic signal. |
| 58 | Cross-sectional momentum | **IMPLEMENTED** `xs_momentum` | Documented (weekly Sharpe ~1.3 for winners), but literature consistently favours time-series momentum. Also wants 10+ positions, which $500 cannot hold. |
| 59 | Lead-lag (BTC → alts) | **IMPLEMENTED** `lead_lag` | Real diffusion mechanism, but the fastest-decaying edge here. Expect better results on older data — **that decay is the actual finding**. |
| 60 | Basis / cash-and-carry | REJECTED | Needs futures margin and enough capital that annualised basis exceeds fees. Not at $500. |
| 61 | Funding-rate harvest (delta neutral) | REJECTED | Sound in principle; needs simultaneous spot long + perp short, doubling fees and adding liquidation risk. Marginal at this size. |
| 62 | Index-inclusion / listing front-run | REJECTED | Information arrives faster to others. You are the exit liquidity. |

### 2.7 Ensembles (3 implemented)

| # | Method | Verdict | Notes |
|---|---|---|---|
| 63 | Majority vote | **IMPLEMENTED** `majority_vote` | Fewer trades, higher conviction. Lower turnover is itself a source of return. |
| 64 | Diversification-weighted vote | **IMPLEMENTED** `diversified_vote` | Down-weights members that merely echo consensus. Stops you believing in diversification you don't have. |
| 65 | Regime router | **IMPLEMENTED** `regime_router` | Picks one logic rather than blending incompatible ones into mush. |

Ensemble maths: k strategies with equal Sharpe and mean pairwise correlation ρ
give ensemble Sharpe × `sqrt(k / (1 + (k-1)ρ))`. At ρ=0.2, k=5 that is ~1.7×.
**Entirely contingent on the "weakly correlated" clause** — five trend
strategies are one strategy wearing five hats.

### 2.8 Machine learning

| # | Method | Verdict | Notes |
|---|---|---|---|
| 66 | Gradient boosting on TA features | REJECTED (documented) | Will fit noise spectacularly. Financial data has a signal-to-noise ratio orders of magnitude worse than the domains where GBMs shine. |
| 67 | LSTM / transformer price prediction | REJECTED | Same problem, more parameters, worse. Published successes almost universally have lookahead leakage in feature construction. |
| 68 | Reinforcement learning agents | REJECTED | Needs a faithful market simulator including your own market impact. You do not have one. |
| 69 | Sentiment / NLP on social feeds | REJECTED | Data access is expensive, sentiment is gamed by the people you'd be trading against, and the edge decays on publication. |
| 70 | Genetic programming for rule discovery | **EXCLUDED BY DESIGN** | This is automated overfitting. It searches millions of configurations, which is exactly what the Deflated Sharpe penalises to zero. |

**Why no ML at all?** Not ideology. With three years of 15m bars you have
~105,000 observations with a signal-to-noise ratio around 0.05. A model with
even a few hundred effective parameters will memorise the noise. The strategies
above have 2–7 parameters each, and *even those* mostly fail walk-forward
validation. Adding capacity makes the overfitting problem worse, not better.

### 2.9 Methods requiring data you don't have

Listed for completeness, all REJECTED: on-chain flow analysis (71), whale wallet
tracking (72), exchange netflow (73), stablecoin supply (74), miner capitulation
metrics (75), options gamma exposure (76), CME gap analysis (77), Google Trends
(78), dark pool prints (79), tick-level VPIN (80).

Each needs a paid data feed costing more per month than your account balance.

### 2.10 Rejected on principle

Also catalogued and rejected: lunar cycle trading (81), Gann angles (82),
astrological (83), Bitcoin rainbow chart (84), stock-to-flow (85), Wyckoff
"composite operator" (86), "smart money concepts" / order blocks (87),
harmonic patterns (88), Bill Williams' Alligator (89), Demark counts (90),
volume profile "value area" trading (91), Renko/Heikin-Ashi signal generation
(92 — smoothed bars hide the intrabar path your stop actually experiences),
signal-service copying (93), grid bots (94 — martingale in a costume),
copy trading (95), and yield-farming leverage loops (96).

Rounding out to 100+: news-headline latency trading (97), exchange-listing
sniping (98), airdrop farming (99), NFT floor arbitrage (100), meme-coin
launch sniping (101), and "AI trading bot" signal subscriptions (102).

---

## Part 2.5 — first real run: what actually happened

Run on **3 years of hourly data (2023-07 → 2026-07)**, 8 majors, full cost model,
231 strategy×symbol configurations, 80% train window.

**Not one configuration was profitable. Not one beat buy-and-hold.**

| | Best result |
|---|---|
| Best strategy Sharpe (in-sample) | **0.98** (rsi_extreme ETH, 4 trades — meaningless sample) |
| Best strategy Sharpe with ≥30 trades | **−0.27** |
| Best buy & hold Sharpe | **1.21** (BTC, +200%) |
| Walk-forward survivors | **0 of 6 tested** (all DSR 0.00) |

Fees consumed 100–9,000% of gross profit depending on configuration.

### The diagnostic that matters

Supertrend on BTC/USD 1h, same data, varying only execution:

| Execution config | Trades | Sharpe | Return | Fees/gross |
|---|---|---|---|---|
| default (2 ATR stop, trailing, 96-bar cap) | 1,587 | −7.91 | −100% | 573% |
| wide stop, no trail, 500-bar cap | 602 | −2.76 | −97% | 460% |
| very wide, no trail, no time exit | 430 | −1.76 | −86% | 529% |
| **same strategy, fees set to ZERO** | 1,581 | **−0.14** | −30% | — |
| **buy & hold** | 1 | **+1.21** | **+200%** | — |

Two conclusions, both important:

1. **The strategy has no edge even at zero cost** (Sharpe −0.14). Costs did not
   destroy a good strategy; they amplified a bad one from −0.14 to −7.91.
2. **Turnover reduction improved Sharpe 4.5×** (−7.91 → −1.76) without changing
   a single entry rule. On a 26bps-per-side venue, *how often you trade* matters
   more than *what you trade*.

### Why this is the correct output, not a failure

The engine was verified against three independent controls before this run:
a random-walk null (everything loses, as it must), a deliberate lookahead
strategy (profitable but bounded, proving the one-bar delay works), and a
zero-cost control (isolates cost effects from signal effects). It behaves
correctly. The strategies genuinely do not work on this data.

If you want to change this outcome, the levers ranked by expected value:

1. **Trade a cheaper venue.** 26bps → 10bps changes the arithmetic more than any
   signal improvement available to you.
2. **Trade slower.** 4h/1d bars, hold for days. The evidence for momentum is
   strongest exactly where turnover is lowest.
3. **Accept that holding may be the right answer.** BTC buy-and-hold returned
   +200% at Sharpe 1.21 with zero effort and zero fees.

---

## Part 3 — what to actually expect

Honest priors before you run anything:

1. **Most strategies here will fail walk-forward validation.** That is the
   expected outcome and the reason walk-forward exists. If 40 configurations
   are tested and 2 survive, those 2 are probably survivorship artifacts.

2. **The families most likely to show something:** volatility targeting applied
   to time-series momentum, on 1h/4h bars, on BTC and ETH. Low turnover, real
   published evidence, minimal parameters.

3. **The families most likely to disappoint:** everything on 5m bars. The cost
   table in §1.1 explains why, and no amount of signal quality fixes it.

4. **A Deflated Sharpe below 0.95 means the result is indistinguishable from
   the best of N random strategies.** Most results will be. Believe the number.

5. **If nothing survives, the correct action is not to trade.** That is a real,
   valuable, money-saving finding — arguably the most valuable output this
   system can produce.

---

## Sources

- [Time-Series and Cross-Sectional Momentum in the Cryptocurrency Market](https://acfr.aut.ac.nz/__data/assets/pdf_file/0009/918729/Time_Series_and_Cross_Sectional_Momentum_in_the_Cryptocurrency_Market_with_IA.pdf)
- [Bitcoin Intraday Time-Series Momentum](https://centaur.reading.ac.uk/100181/3/21Sep2021Bitcoin%20Intraday%20Time-Series%20Momentum.R2.pdf)
- [A Trend Factor for the Cross Section of Cryptocurrency Returns](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4C1509ACBA33D5DCAF0AC24379148178/S0022109024000747a.pdf/trend_factor_for_the_cross_section_of_cryptocurrency_returns.pdf)
- [Risks and Returns of Cryptocurrency (NBER)](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf)
- [The Deflated Sharpe Ratio — Bailey & López de Prado](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf)
- [Backtest overfitting in the machine learning era](https://www.sciencedirect.com/science/article/abs/pii/S0950705124011110)
- [A Rigorous Walk-Forward Validation Framework for Market Microstructure Signals](https://arxiv.org/html/2512.12924v1)
- [Order Book Liquidity on Crypto Exchanges](https://www.mdpi.com/1911-8074/18/3/124)
- [Momentum and trend following for currencies and bitcoin](https://assets.super.so/e46b77e7-ee08-445e-b43f-4ffd88ae0a0e/files/9c27aa78-9b14-4419-a53d-bc56fa9d43b2.pdf)
- [How to Backtest a Crypto Bot: Realistic Fees, Slippage, and Paper Trading](https://paybis.com/blog/how-to-backtest-crypto-bot/)
