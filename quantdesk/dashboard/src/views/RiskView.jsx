import { Panel, Tile, Tiles, Empty, Note } from '../components/Panel'
import { Meter, BandChart } from '../components/Charts'
import { money, pct, num, signedMoney, dirClass, isNum } from '../lib/format'

/* Risk + go-live gate.
 *
 * The gate checklist is the most important thing on this screen. It is the
 * mechanism standing between a promising two-week paper run and a real $500.
 */

export default function RiskView({ status, gate, arbitrage }) {
  const risk = status?.risk || {}
  const positions = risk.positions || []

  const gateChecks = gate?.checks || []
  const passed = gateChecks.filter((c) => c.passed).length

  return (
    <div className="grid" style={{ gap: 8 }}>
      <Tiles cols={5}>
        <Tile
          label="Gate status"
          value={gate?.passed ? 'OPEN' : 'BLOCKED'}
          sub={`${passed}/${gateChecks.length} checks passed`}
          tone={gate?.passed ? 'up' : 'down'}
        />
        <Tile
          label="Paper days"
          value={num(gate?.paper_days ?? status?.paper_days, 1)}
          sub={`need ${gate?.min_paper_days ?? 14}`}
        />
        <Tile
          label="Paper trades"
          value={gate?.n_paper_trades ?? 0}
          sub="closed only"
        />
        <Tile
          label="Kill switch"
          value={risk.kill_switch ? 'TRIPPED' : 'ARMED'}
          sub={risk.kill_switch ? risk.kill_reason : `trips at ${pct(risk.max_drawdown_limit, 0)} DD`}
          tone={risk.kill_switch ? 'down' : 'neutral'}
        />
        <Tile
          label="Mode"
          value={(status?.mode || '—').toUpperCase()}
          sub={status?.running ? 'running' : 'stopped'}
          tone={status?.mode === 'live' ? 'down' : 'neutral'}
        />
      </Tiles>

      <div className="grid g-side">
        <Panel title="Exposure limits">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Meter label="Daily loss used" value={Math.max(0, -(risk.day_pnl_pct || 0))}
                   max={risk.daily_loss_limit || 0.1} />
            <Meter label="Total drawdown" value={risk.drawdown || 0}
                   max={risk.max_drawdown_limit || 0.3} />
            <Meter label="Gross exposure" value={risk.gross_exposure_pct || 0} max={1} />
            <Meter label="Position slots" value={risk.open_positions || 0}
                   max={risk.max_positions || 3} />
          </div>

          <dl className="kv" style={{ marginTop: 14 }}>
            <dt>Equity</dt><dd>{money(risk.equity)}</dd>
            <dt>Peak equity</dt><dd>{money(risk.peak_equity)}</dd>
            <dt>Gross notional</dt><dd>{money(risk.gross_exposure)}</dd>
            <dt>Max position</dt><dd>{pct(risk.max_position_pct, 0)} of equity</dd>
            <dt>Configured risk</dt><dd>{pct(risk.risk_per_trade, 1)} per trade</dd>
            <dt>Effective risk</dt>
            <dd className="warn">{pct(risk.effective_risk_per_trade_2pct_stop, 2)} on a 2% stop</dd>
          </dl>

          {risk.clamp_notes?.length > 0 && (
            <Note tone="caution">
              <strong>Config values were clamped:</strong>
              <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                {risk.clamp_notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </Note>
          )}
        </Panel>

        <Panel title="Go-live gate" note={gate?.passed ? 'PASSED' : 'BLOCKED'} flush>
          {gateChecks.length ? (
            <table>
              <thead>
                <tr><th>Check</th><th>Actual</th><th>Required</th><th>Result</th></tr>
              </thead>
              <tbody>
                {gateChecks.map((c) => (
                  <tr key={c.name}>
                    <td className="sym" style={{ textAlign: 'left' }}>{c.name}</td>
                    <td>{c.actual}</td>
                    <td className="dim">{c.required}</td>
                    <td>
                      <span className={`tag ${c.passed ? 'ok' : 'bad'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>{gate?.summary || 'No paper trading history yet.'}</Empty>
          )}
          <div style={{ padding: 9 }}>
            <div className="note">{gate?.summary}</div>
            {!gate?.passed && (
              <div className="tile-sub" style={{ lineHeight: 1.6, marginTop: 6 }}>
                Live trading is refused while any check fails. Even once it passes you
                must separately set <code>live.mode: live</code>, export{' '}
                <code>QUANTDESK_ALLOW_LIVE=1</code>, and supply API keys — three
                independent switches so no single mistake arms real money.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Position correlation risk" flush>
        {positions.length > 1 ? (
          <table>
            <thead>
              <tr><th>Symbol</th><th>Side</th><th>Notional</th><th>% of equity</th><th>Unrealised</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol}>
                  <td className="sym">{p.symbol}</td>
                  <td className={p.direction > 0 ? 'up' : 'down'}>
                    {p.direction > 0 ? 'LONG' : 'SHORT'}
                  </td>
                  <td>{money(p.notional)}</td>
                  <td>{pct(p.notional / Math.max(risk.equity || 1, 1), 1)}</td>
                  <td className={dirClass(p.unrealised)}>{signedMoney(p.unrealised)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>
            Fewer than two open positions — no correlation exposure to assess.
          </Empty>
        )}
        <div style={{ padding: 9 }}>
          <div className="tile-sub" style={{ lineHeight: 1.6 }}>
            Long BTC, long ETH and long SOL simultaneously is one bet with three
            tickers. The engine blocks new entries whose 30-day return correlation with
            existing positions exceeds the configured threshold.
          </div>
        </div>
      </Panel>

      <Panel
        title="Cross-exchange spread monitor"
        note="net of two taker fees"
        flush
      >
        {arbitrage?.rows?.length ? (
          <>
            <table>
              <thead>
                <tr>
                  <th>Pair</th><th>Buy venue</th><th>Ask</th>
                  <th>Sell venue</th><th>Bid</th><th>Gross bps</th><th>Net bps</th>
                </tr>
              </thead>
              <tbody>
                {arbitrage.rows.map((r) => (
                  <tr key={r.symbol}>
                    <td className="sym">{r.symbol}</td>
                    <td className="dim">{r.buy_venue}</td>
                    <td>{num(r.buy, 2)}</td>
                    <td className="dim">{r.sell_venue}</td>
                    <td>{num(r.sell, 2)}</td>
                    <td className="dim">{num(r.gross_bps, 1)}</td>
                    <td className={r.net_bps > 0 ? 'up' : 'down'}>{num(r.net_bps, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: 9 }}>
              <div className="tile-sub" style={{ lineHeight: 1.6 }}>
                This is the legitimate form of cross-venue arbitrage: same asset, two
                prices, no counterparty harmed. Expect net to be negative nearly always —
                after fees, transfer time and the requirement that both legs fill, retail
                cross-exchange arb is generally not viable. A positive number here is far
                more likely to be a stale quote than free money.
              </div>
            </div>
          </>
        ) : (
          <Empty>
            Run <code>python cli.py arb</code> to sample venue spreads.
          </Empty>
        )}
      </Panel>
    </div>
  )
}
