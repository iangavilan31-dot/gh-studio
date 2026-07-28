import { useMemo, useState } from 'react'
import { Panel, Tile, Tiles, Empty, Note } from '../components/Panel'
import { LineChart, BarChart, Spark } from '../components/Charts'
import { money, pct, num, signedPct, dirClass, verdictClass, isNum } from '../lib/format'

/* The research lab.
 *
 * Deliberately puts walk-forward results ABOVE in-sample backtests, and labels
 * the in-sample table as weak evidence. A dashboard that shows a glowing
 * backtest first and buries the out-of-sample number is how people talk
 * themselves into trading noise.
 */

export default function Research({ backtests, walkforward }) {
  const [sel, setSel] = useState(null)

  const wf = walkforward?.results || []
  const bt = backtests?.results || []

  const bench = backtests?.benchmarks || []
  const bestBench = bench.length ? Math.max(...bench.map((b) => b.sharpe ?? -99)) : null
  const beatsBench = bestBench == null
    ? []
    : bt.filter((r) => (r.metrics?.sharpe ?? -99) > bestBench)

  const survivors = wf.filter((r) => r.verdict === 'CANDIDATE')
  const selected = sel != null ? wf[sel] : wf[0]

  const wfCurve = useMemo(() => {
    if (!selected?.equity?.length) return []
    return selected.equity.map((y, i) => ({
      x: selected.equity_ts?.[i], y,
    }))
  }, [selected])

  const foldBars = useMemo(() => {
    if (!selected?.folds?.length) return []
    return selected.folds.map((f) => ({
      label: `f${f.index}`,
      value: f.test_return ?? 0,
    }))
  }, [selected])

  return (
    <div className="grid" style={{ gap: 8 }}>
      <Tiles cols={5}>
        <Tile label="Configs tested" value={bt.length || 0} sub="strategy × symbol × timeframe" />
        <Tile label="Walk-forward runs" value={wf.length || 0} sub="out-of-sample validated" />
        <Tile
          label="Survivors"
          value={survivors.length}
          sub="verdict = CANDIDATE"
          tone={survivors.length ? 'up' : 'down'}
        />
        <Tile
          label="Best OOS Sharpe"
          value={wf.length ? num(wf[0]?.metrics?.sharpe, 2) : '—'}
          sub="stitched test windows"
        />
        <Tile
          label="Best DSR"
          value={wf.length ? num(wf[0]?.metrics?.deflated_sharpe, 2) : '—'}
          sub="≥0.95 to be credible"
          tone={(wf[0]?.metrics?.deflated_sharpe ?? 0) >= 0.95 ? 'up' : 'warn'}
        />
      </Tiles>

      {!wf.length && (
        <Note tone="caution">
          <strong>No walk-forward results yet.</strong> Run{' '}
          <code>python cli.py download</code> then <code>python cli.py walkforward</code>.
          In-sample backtests alone are not evidence of anything.
        </Note>
      )}

      {wf.length > 0 && !survivors.length && (
        <Note tone="alarm">
          <strong>Nothing survived walk-forward validation.</strong> Every configuration
          that looked good in its training window failed to repeat out of sample. This is
          the most common outcome in retail quant research and it is a real result, not a
          bug — it means these strategies did not demonstrate an edge on this data. Do not
          trade any of them live.
        </Note>
      )}

      <div className="grid g-main">
        <Panel
          title="Walk-forward equity"
          note={selected ? `${selected.strategy} · ${selected.symbol} · ${selected.timeframe}` : '—'}
        >
          {wfCurve.length > 1 ? (
            <LineChart
              series={[{ name: 'out-of-sample', color: 'var(--s1)', points: wfCurve }]}
              height={230}
              yFormat={(v) => money(v, 0)}
              baseline={wfCurve[0]?.y}
              fill
            />
          ) : (
            <Empty>Select a walk-forward run below.</Empty>
          )}
        </Panel>

        <Panel title="Per-fold return" note="each bar = one untouched test window">
          {foldBars.length ? (
            <>
              <BarChart data={foldBars} height={230} valueFormat={(v) => pct(v, 0)} />
              <div className="tile-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Consistency across folds matters more than the total. One huge fold
                carrying an otherwise flat record is luck wearing a strategy's name.
              </div>
            </>
          ) : (
            <Empty>No fold data.</Empty>
          )}
        </Panel>
      </div>

      {selected && (
        <Panel title="Selected run detail" note={selected.verdict}>
          <div className="grid g-3 kv-group">
            <dl className="kv">
              <dt>Strategy</dt><dd>{selected.strategy}</dd>
              <dt>Symbol / TF</dt><dd>{selected.symbol} · {selected.timeframe}</dd>
              <dt>Folds</dt><dd>{selected.n_folds}</dd>
              <dt>Trials searched</dt><dd>{selected.total_trials}</dd>
            </dl>
            <dl className="kv">
              <dt>OOS Sharpe</dt><dd>{num(selected.metrics?.sharpe, 2)}</dd>
              <dt>Deflated Sharpe</dt>
              <dd className={(selected.metrics?.deflated_sharpe ?? 0) >= 0.95 ? 'up' : 'warn'}>
                {num(selected.metrics?.deflated_sharpe, 3)}
              </dd>
              <dt>Profit factor</dt><dd>{num(selected.metrics?.profit_factor, 2)}</dd>
              <dt>Expectancy</dt>
              <dd className={dirClass(selected.metrics?.expectancy_r)}>
                {num(selected.metrics?.expectancy_r, 3)}R
              </dd>
            </dl>
            <dl className="kv">
              <dt>Efficiency (OOS/IS)</dt>
              <dd className={(selected.efficiency ?? 0) >= 0.5 ? 'up' : 'warn'}>
                {num(selected.efficiency, 2)}
              </dd>
              <dt>Param stability</dt><dd>{pct(selected.param_stability, 0)}</dd>
              <dt>Max drawdown</dt><dd>{pct(selected.metrics?.max_drawdown, 1)}</dd>
              <dt>Fees / gross</dt>
              <dd className={(selected.metrics?.fees_pct_of_gross ?? 0) > 0.4 ? 'down' : 'dim'}>
                {pct(selected.metrics?.fees_pct_of_gross, 0)}
              </dd>
            </dl>
          </div>
          <div className="note" style={{ marginTop: 10 }}>{selected.why}</div>
        </Panel>
      )}

      <Panel title="Walk-forward leaderboard" note="out-of-sample — this is the table that counts" flush>
        {wf.length ? (
          <div className="scroll-y tall">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th><th>Symbol</th><th>TF</th><th>Folds</th><th>Trades</th>
                  <th>OOS Sharpe</th><th>DSR</th><th>PF</th><th>Exp R</th>
                  <th>Eff</th><th>Stab</th><th>MaxDD</th><th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {wf.map((r, i) => (
                  <tr key={i} className={i === (sel ?? 0) ? 'sel' : ''}
                      onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                    <td className="sym">{r.strategy}</td>
                    <td>{r.symbol}</td>
                    <td className="dim">{r.timeframe}</td>
                    <td className="dim">{r.n_folds}</td>
                    <td>{r.metrics?.n_trades ?? 0}</td>
                    <td className={dirClass(r.metrics?.sharpe)}>{num(r.metrics?.sharpe, 2)}</td>
                    <td className={(r.metrics?.deflated_sharpe ?? 0) >= 0.95 ? 'up' : 'faint'}>
                      {num(r.metrics?.deflated_sharpe, 2)}
                    </td>
                    <td>{num(r.metrics?.profit_factor, 2)}</td>
                    <td className={dirClass(r.metrics?.expectancy_r)}>
                      {num(r.metrics?.expectancy_r, 3)}
                    </td>
                    <td className="dim">{num(r.efficiency, 2)}</td>
                    <td className="dim">{pct(r.param_stability, 0)}</td>
                    <td>{pct(r.metrics?.max_drawdown, 0)}</td>
                    <td><span className={`tag ${verdictClass(r.verdict)}`}>{r.verdict}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Run <code>python cli.py walkforward</code></Empty>
        )}
      </Panel>

      {bench.length > 0 && (
        <Panel
          title="Buy & hold benchmark"
          note={beatsBench.length
            ? `${beatsBench.length} configs beat it in sample`
            : 'no strategy beat it'}
          flush
        >
          <table>
            <thead>
              <tr><th>Symbol</th><th>TF</th><th>Return</th><th>Sharpe</th><th>Max DD</th></tr>
            </thead>
            <tbody>
              {bench.slice(0, 8).map((b, i) => (
                <tr key={i}>
                  <td className="sym">{b.symbol}</td>
                  <td className="dim">{b.timeframe}</td>
                  <td className={dirClass(b.total_return)}>{pct(b.total_return, 0)}</td>
                  <td>{num(b.sharpe, 2)}</td>
                  <td>{pct(b.max_drawdown, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 9 }}>
            <div className="tile-sub" style={{ lineHeight: 1.6 }}>
              {beatsBench.length
                ? `${beatsBench.length} of ${bt.length} configs beat the best buy-and-hold Sharpe (${num(bestBench, 2)}) in sample. Check walk-forward before believing it.`
                : `None of the ${bt.length} configs beat the best buy-and-hold Sharpe (${num(bestBench, 2)}). On this data, trading actively was worse than doing nothing — which is a real finding, not a bug.`}
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="In-sample backtests"
        note="WEAK EVIDENCE — optimised and measured on the same data"
        flush
      >
        {bt.length ? (
          <div className="scroll-y">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th><th>Symbol</th><th>TF</th><th>Family</th><th>Trades</th>
                  <th>Sharpe</th><th>PF</th><th>Exp R</th><th>MaxDD</th>
                  <th>Fees%</th><th>Curve</th><th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {bt.slice(0, 60).map((r, i) => (
                  <tr key={i}>
                    <td className="sym">{r.strategy}</td>
                    <td>{r.symbol}</td>
                    <td className="dim">{r.timeframe}</td>
                    <td className="faint">{r.family}</td>
                    <td>{r.metrics?.n_trades ?? 0}</td>
                    <td className={dirClass(r.metrics?.sharpe)}>{num(r.metrics?.sharpe, 2)}</td>
                    <td>{num(r.metrics?.profit_factor, 2)}</td>
                    <td className={dirClass(r.metrics?.expectancy_r)}>
                      {num(r.metrics?.expectancy_r, 3)}
                    </td>
                    <td>{pct(r.metrics?.max_drawdown, 0)}</td>
                    <td className={(r.metrics?.fees_pct_of_gross ?? 0) > 0.5 ? 'down' : 'dim'}>
                      {pct(r.metrics?.fees_pct_of_gross, 0)}
                    </td>
                    <td><Spark values={r.equity_tail} /></td>
                    <td><span className={`tag ${verdictClass(r.verdict)}`}>{r.verdict}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Run <code>python cli.py backtest</code></Empty>
        )}
      </Panel>
    </div>
  )
}
