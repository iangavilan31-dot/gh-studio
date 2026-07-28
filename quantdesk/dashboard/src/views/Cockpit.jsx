import { useMemo } from 'react'
import { Panel, Tile, Tiles, Empty, Note } from '../components/Panel'
import { LineChart, DrawdownChart, Meter, Spark } from '../components/Charts'
import {
  money, signedMoney, pct, signedPct, num, price, compact,
  dirClass, clock, ago, isNum,
} from '../lib/format'

export default function Cockpit({ status, equity, trades, orders, events, scanner }) {
  const risk = status?.risk || {}
  const positions = risk.positions || []
  // Equity points arrive as {ts, equity} from the API; the chart maps them to
  // {x, y} below. Read the raw field here, not the mapped one.
  const start = equity?.length ? equity[0].equity : 500

  const curve = useMemo(
    () => (equity || []).map((p) => ({ x: p.ts, y: p.equity })),
    [equity]
  )

  const m = trades?.metrics || {}
  const closed = (trades?.trades || []).filter((t) => t.exit_time)

  const totalEq = (risk.equity || 0) + (risk.unrealised || 0)
  const totalRet = start > 0 ? totalEq / start - 1 : 0

  return (
    <div className="grid" style={{ gap: 8 }}>
      <Tiles cols={6}>
        <Tile
          label="Equity"
          value={money(totalEq)}
          sub={`${signedPct(totalRet)} since start`}
          tone={dirClass(totalRet)}
        />
        <Tile
          label="Day P&L"
          value={signedMoney(risk.day_pnl)}
          sub={signedPct(risk.day_pnl_pct)}
          tone={dirClass(risk.day_pnl)}
        />
        <Tile
          label="Unrealised"
          value={signedMoney(risk.unrealised)}
          sub={`${risk.open_positions || 0} / ${risk.max_positions || 0} open`}
          tone={dirClass(risk.unrealised)}
        />
        <Tile
          label="Drawdown"
          value={pct(risk.drawdown, 1)}
          sub={`kill at ${pct(risk.max_drawdown_limit, 0)}`}
          tone={risk.drawdown > (risk.max_drawdown_limit || 1) * 0.6 ? 'down' : 'neutral'}
        />
        <Tile
          label="Win rate"
          value={isNum(m.win_rate) ? pct(m.win_rate, 0) : '—'}
          sub={`${m.n_trades || 0} closed trades`}
        />
        <Tile
          label="Expectancy"
          value={isNum(m.expectancy_r) ? `${num(m.expectancy_r, 3)}R` : '—'}
          sub={`PF ${isNum(m.profit_factor) ? num(m.profit_factor, 2) : '—'}`}
          tone={dirClass(m.expectancy_r)}
        />
      </Tiles>

      {(risk.kill_switch || risk.halted_today) && (
        <Note tone="alarm">
          <strong>{risk.kill_switch ? 'KILL SWITCH ACTIVE' : 'DAILY LOSS LIMIT REACHED'}</strong>
          {' — '}
          {risk.kill_switch
            ? `${risk.kill_reason}. No new positions until you manually reset.`
            : 'Trading halted until 00:00 UTC. This is the system working as designed.'}
        </Note>
      )}

      <div className="grid g-main">
        <Panel
          title="Equity curve"
          note={`${status?.mode?.toUpperCase() || '—'} · ${curve.length} marks`}
        >
          {curve.length > 1 ? (
            <>
              <LineChart
                series={[{ name: 'equity', color: 'var(--s1)', points: curve }]}
                height={210}
                yFormat={(v) => money(v, 0)}
                baseline={start}
                fill
              />
              <div style={{ marginTop: 6 }}>
                <div className="tile-label" style={{ marginBottom: 3 }}>Drawdown from peak</div>
                <DrawdownChart equity={curve} height={84} />
              </div>
            </>
          ) : (
            <Empty>
              No equity history yet.<br />
              Start the engine: <code>python cli.py live</code>
            </Empty>
          )}
        </Panel>

        <Panel title="Risk budget">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Meter
              label="Daily loss used"
              value={Math.max(0, -(risk.day_pnl_pct || 0))}
              max={risk.daily_loss_limit || 0.1}
            />
            <Meter
              label="Drawdown vs kill switch"
              value={risk.drawdown || 0}
              max={risk.max_drawdown_limit || 0.3}
            />
            <Meter
              label="Gross exposure"
              value={risk.gross_exposure_pct || 0}
              max={1}
            />
            <Meter
              label="Position slots"
              value={risk.open_positions || 0}
              max={risk.max_positions || 3}
            />

            <dl className="kv" style={{ marginTop: 4 }}>
              <dt>Configured risk/trade</dt>
              <dd>{pct(risk.risk_per_trade, 1)}</dd>
              <dt>Effective (2% stop)</dt>
              <dd className="warn">{pct(risk.effective_risk_per_trade_2pct_stop, 2)}</dd>
              <dt>Trades today</dt>
              <dd>{risk.trades_today ?? 0}</dd>
              <dt>Paper days</dt>
              <dd>{num(status?.paper_days, 1)}</dd>
            </dl>

            {isNum(risk.cap_binds_below_stop_pct) && (
              <div className="tile-sub" style={{ lineHeight: 1.5 }}>
                The no-leverage exposure cap binds for any stop tighter than{' '}
                {pct(risk.cap_binds_below_stop_pct, 1)} of price, so your real risk
                per trade lands below the configured figure.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid g-side">
        <Panel title="Open positions" note={`${positions.length}`} flush>
          {positions.length ? (
            <div className="scroll-y">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th>
                    <th>Last</th><th>Stop</th><th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="sym">{p.symbol}</td>
                      <td>
                        <span className={`tag ${p.direction > 0 ? 'long' : 'short'}`}>
                          {p.direction > 0 ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td>{num(p.qty, 5)}</td>
                      <td>{price(p.entry_price)}</td>
                      <td>{price(p.last_price)}</td>
                      <td className="faint">{price(p.stop_price)}</td>
                      <td className={dirClass(p.unrealised)}>{signedMoney(p.unrealised)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Flat. No open positions.</Empty>
          )}
        </Panel>

        <Panel title="Market scanner" note="ranked by volatility + volume surge" flush>
          {scanner?.length ? (
            <div className="scroll-y">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th><th>Price</th><th>1h</th><th>24h</th>
                    <th>NATR</th><th>Vol z</th><th>Eff</th><th>Sig</th>
                  </tr>
                </thead>
                <tbody>
                  {scanner.slice(0, 14).map((r) => (
                    <tr key={r.symbol}>
                      <td className="sym">{r.symbol}</td>
                      <td>{price(r.price)}</td>
                      <td className={dirClass(r.ret_1h)}>{signedPct(r.ret_1h, 1)}</td>
                      <td className={dirClass(r.ret_24h)}>{signedPct(r.ret_24h, 1)}</td>
                      <td>{pct(r.natr, 2)}</td>
                      <td className={r.volume_z > 2 ? 'warn' : 'dim'}>{num(r.volume_z, 1)}</td>
                      <td className="dim">{num(r.efficiency, 2)}</td>
                      <td>
                        {r.signal > 0 ? <span className="tag long">L</span>
                          : r.signal < 0 ? <span className="tag short">S</span>
                          : <span className="faint">·</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Scanner idle — waiting for the first data poll.</Empty>
          )}
        </Panel>
      </div>

      <div className="grid g-side">
        <Panel title="Order feed" note={`${orders?.length || 0}`} flush>
          {orders?.length ? (
            <div className="scroll-y">
              <table>
                <thead>
                  <tr><th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Fill</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {orders.slice(0, 30).map((o) => (
                    <tr key={o.id}>
                      <td className="faint">{clock(o.ts)}</td>
                      <td className="sym">{o.symbol}</td>
                      <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side?.toUpperCase()}</td>
                      <td>{num(o.qty, 5)}</td>
                      <td>{price(o.avg_fill_price)}</td>
                      <td>
                        <span className={`tag ${o.status === 'filled' ? 'ok'
                          : o.status === 'rejected' ? 'bad' : 'mid'}`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No orders yet.</Empty>
          )}
        </Panel>

        <Panel title="Trade log" note={`${closed.length} closed`} flush>
          {closed.length ? (
            <div className="scroll-y">
              <table>
                <thead>
                  <tr>
                    <th>Exit</th><th>Symbol</th><th>Strategy</th><th>Side</th>
                    <th>Bars</th><th>Reason</th><th>R</th><th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.slice(0, 40).map((t) => (
                    <tr key={t.id}>
                      <td className="faint">{clock(t.exit_time)}</td>
                      <td className="sym">{t.symbol}</td>
                      <td className="dim">{t.strategy}</td>
                      <td className={t.direction > 0 ? 'up' : 'down'}>
                        {t.direction > 0 ? 'L' : 'S'}
                      </td>
                      <td className="dim">{t.bars_held}</td>
                      <td className="faint">{t.exit_reason}</td>
                      <td className={dirClass(t.pnl_r)}>{num(t.pnl_r, 2)}</td>
                      <td className={dirClass(t.pnl)}>{signedMoney(t.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No closed trades yet.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Engine log" note={`${events?.length || 0} events`} flush>
        {events?.length ? (
          <div className="scroll-y" style={{ maxHeight: 200 }}>
            <table>
              <tbody>
                {events.slice(0, 60).map((e) => (
                  <tr key={e.id}>
                    <td className="faint" style={{ width: 74 }}>{clock(e.ts)}</td>
                    <td style={{ width: 70 }}>
                      <span className={`tag ${e.level === 'error' ? 'bad'
                        : e.level === 'warn' ? 'mid' : ''}`}>{e.kind}</span>
                    </td>
                    <td className="dim" style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                      {e.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No events.</Empty>
        )}
      </Panel>
    </div>
  )
}
