# A short, honest primer on quantitative trading

Read this before you trust a single number this system produces. It is the
difference between using the tool and being used by it.

---

## 1. The one thing to understand first

**Markets are close to efficient at the timescales you can access.**

That is not a slogan. It means: for any simple rule you can code, thousands of
people with more capital, faster infrastructure, and better data have already
tested it. If it worked reliably, they traded it until it stopped working.

This does not mean edges do not exist. It means:

- Real edges are small, unstable, and expensive to find
- Most apparent edges are statistical artifacts
- The gap between "backtest looks great" and "makes money" is enormous and is
  where nearly everyone loses

Every design decision in this codebase follows from that.

---

## 2. Why backtests lie

### 2.1 Lookahead bias

Using information that would not have existed yet. The classic form:

```python
# WRONG -- executes at the same bar's close that generated the signal
signal = close > sma(close, 20)
returns = signal * close.pct_change()
```

You cannot compute a signal from a bar's close and also trade at that close.
This engine executes on the **next bar's open**, always
(`engine/backtest/engine.py`). Subtler versions: centred rolling windows,
unshifted pivot detection, fitting a hedge ratio over the full sample then
"trading" it, and — most commonly — using the still-forming final candle from
an exchange API.

`tests/test_engine.py::test_no_lookahead` verifies the guard holds by running a
strategy that deliberately peeks and confirming it cannot print money.

### 2.2 Survivorship bias

Backtesting today's top coins over three years means selecting assets that
survived and succeeded. The 2021 universe was full of tokens now worth nothing.
Your backtest never sees them. This inflates every crypto backtest, including
this one — there is no clean fix without a delisted-asset dataset.

### 2.3 Overfitting / data mining

The big one. Test enough variations and something looks good by chance.

With 40 strategies × 8 symbols × 4 timeframes × a parameter grid, you are
running **tens of thousands of trials**. The best result from that many trials
looks excellent even if every strategy is worthless.

The defence is the **Deflated Sharpe Ratio**: it deflates your observed Sharpe
by the expected maximum from N independent worthless trials, then reports the
probability the remainder is real. Read it as a confidence: **below 0.95, you
have not distinguished your strategy from noise.**

### 2.4 Cost understatement

Covered in `STRATEGIES.md` §1.1. Assuming maker fills is the single most common
way retail backtests lie. This engine assumes taker on every fill by default.

### 2.5 Cross-venue data substitution

This system researches on KuCoin USDT pairs and trades on Kraken USD pairs,
because Kraken's public API will not serve deep history (see README). Prices
track closely enough that strategy *signals* transfer.

What does **not** transfer: fee tiers, spread, liquidity depth, and the exact
timing of wicks. A stop that was hit on KuCoin at 03:14 may not have been hit on
Kraken. For strategies with tight stops this introduces real error, and it is
one more reason to treat a marginal backtest result as noise rather than a
finding.

### 2.6 Regime dependence

Three years of crypto data contains maybe two distinct regimes. A strategy that
works in both may still fail in the third. Walk-forward helps; it does not solve
this.

---

## 3. Walk-forward analysis

A single backtest asks: *what would the best parameters have been, in hindsight?*

Walk-forward asks: *if I had re-optimised periodically using only past data and
traded the winner forward, what would have happened?* That is the question that
matters.

```
[---- train: optimise ----][-- test: trade, never tune --]
         roll forward, repeat
```

Only concatenated **test** segments count.

### Reading the output

| Metric | Meaning | Good |
|---|---|---|
| OOS Sharpe | Risk-adjusted return on untouched data | > 1.0 |
| **Deflated Sharpe** | P(edge is real) after multiple-testing correction | **> 0.95** |
| Efficiency | OOS return ÷ IS return | > 0.5 |
| Param stability | How often the optimiser picked the same params | > 0.5 |
| Fees / gross | Share of gross profit eaten by costs | < 0.4 |

**Efficiency near 1.0 is not a triumph.** It usually means your parameter grid
barely mattered — worth knowing, but not evidence of skill.

**Low param stability is a red flag.** If the optimal lookback swings between 48
and 336 across folds, there is no stable optimum; you are fitting noise.

---

## 4. Position sizing matters more than strategy selection

Most people spend 95% of their effort on entry signals. The returns come from
elsewhere.

### 4.1 Risk of ruin

With a 50% win rate, 1.5:1 payoff, and 200 trades:

| Risk per trade | P(losing half the account) |
|---|---|
| 1% | ~2% |
| 2% | ~15% |
| 5% | ~60% |
| 10% | ~95% |

Run `python cli.py montecarlo` for your actual configured value.

**You configured 5%.** The engine honours it, capped at that ceiling. Two things
to know:

1. The no-leverage exposure cap means your *effective* risk on a typical 2% ATR
   stop is around 0.8%, not 5%. The dashboard shows both numbers. Your setting
   is partly self-limiting on spot — which is luck, not design.

2. If you ever raise `max_position_pct` or trade with leverage, that safety
   disappears and the table above becomes literal.

### 4.2 Why ATR sizing

Fixed sizing (always buy $100) means a wild SOL trade risks 4× what a calm BTC
trade does. ATR sizing solves size back from stop distance, so **dollar risk is
constant** regardless of the asset's volatility. This is standard practice for
a reason.

### 4.3 Kelly

Kelly gives the growth-optimal fraction. `metrics.py` computes it and the engine
**deliberately does not act on it**, because Kelly assumes you know your true
edge. You have an estimate from a finite sample, and it is always more
optimistic than reality. Practitioners who use Kelly use quarter-Kelly or less.

---

## 5. Metrics, and what they hide

| Metric | What it hides |
|---|---|
| Total return | Path. +100% with a 70% drawdown is unholdable. |
| Win rate | Payoff. 90% wins with 20:1 losses is a losing system. |
| Sharpe | Fat tails and skew. Selling options has a great Sharpe until it doesn't. |
| Max drawdown | It's *one sample*. Monte Carlo p95 is the number to plan around. |
| Profit factor | Trade count. PF 3.0 on 8 trades is meaningless. |
| **Expectancy (R)** | Least hideable. Average earnings per unit of risk, after costs. |

**Read expectancy and Deflated Sharpe first.** Everything else is commentary.

MAE/MFE are also recorded per trade: how far a trade went against you before
working, and how far in your favour before you exited. Systematically large MFE
with small realised gains means your exits are leaving money on the table.

---

## 6. What paper trading does and does not prove

**Does:** catch implementation bugs, reveal data feed problems, expose the gap
between backtest costs and real fills, prove the system runs unattended.

**Does not:** prove profitability. Two weeks is 10–60 trades. That sample cannot
distinguish a 55% win rate from a 45% one. It is a *systems* test, not a
*strategy* test.

**Does not:** model your psychology. Paper trading has no fear. The first real
$50 loss changes behaviour in ways no simulator captures.

This is why the gate requires backtest *agreement*, not just paper profit. Paper
results far better than the backtest predicted mean your model is wrong — and a
wrong model that flatters you is still wrong.

---

## 7. Failure modes, ranked by how often they kill accounts

1. **Overleveraging.** Position sizing that cannot survive a normal losing streak.
2. **Revenge trading.** Overriding the system after a loss. The daily loss limit exists for this.
3. **Strategy hopping.** Abandoning a system during its expected drawdown, adopting the next one just before *its* drawdown.
4. **Overfitting.** Trading a backtest artifact.
5. **Ignoring costs.** Covered above.
6. **Martingale/averaging down.** Works until it takes everything.
7. **Not stopping.** No kill switch, no daily limit, no plan for being wrong.

Items 1, 2, 6 and 7 are handled in code here. Items 3, 4 and 5 are handled by
the research tooling. None of it helps if you disable the guardrails.

---

## 8. A realistic picture of $500

Suppose you find something genuinely good — a walk-forward Sharpe of 1.0, which
would be a real accomplishment.

- Expected annual return at ~15% volatility: **~15%, or $75**
- Expected worst drawdown: 15–25%, so **$75–125**
- Time to double: **~5 years**

That is what *success* looks like. Not doubling in a month.

Two honest conclusions follow:

**On the money:** $500 is not enough capital for trading returns to change your
life, whatever the return rate. Compounding needs capital and time, and you have
neither yet. Anyone showing you 10×-in-a-month is either lying, gambling, or
selling something.

**On the project:** it is still worth doing. Not because the $500 will multiply,
but because building it teaches you statistics, systems programming, risk
management and intellectual honesty about evidence. Those transfer to work that
pays far more than $75/year. The most likely genuine return on this project is
**what you learn**, and that is not a consolation prize.

Go in expecting that, and you cannot really lose. Go in expecting to get rich,
and the $500 is gone plus the lesson costs more than it needed to.

---

## 9. What to do next

1. `python cli.py download` — get real data
2. `python cli.py backtest` — get a rough map. Distrust the good results.
3. `python cli.py walkforward` — the real test. Expect most things to fail.
4. `python cli.py montecarlo` — see the distribution, not one path
5. If ≥1 config survives with DSR > 0.95: paper trade it for 14 days
6. `python cli.py gate` — let the checklist decide, not your mood
7. If the gate blocks you, **it is right and you are impatient**

If nothing survives step 3, the system worked. It saved you $500 and told you
the truth, which is more than most trading software does.

---

## 10. Further reading

- **Advances in Financial Machine Learning** — López de Prado. Chapters 7 & 11 on cross-validation and backtest overfitting are the essential ones.
- **The Deflated Sharpe Ratio** — Bailey & López de Prado. The paper behind the number this system reports.
- **Systematic Trading** — Rob Carver. The best practical book on position sizing and why simple beats complex.
- **Evidence-Based Technical Analysis** — Aronson. Applies statistical rigour to TA rules; most do not survive.
