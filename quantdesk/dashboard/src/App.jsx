import { useCallback, useEffect, useRef, useState } from 'react'
import { api, connect } from './lib/api'
import { ago, money, signedPct, dirClass } from './lib/format'
import Cockpit from './views/Cockpit'
import Research from './views/Research'
import RiskView from './views/RiskView'
import Strategies from './views/Strategies'

const TABS = [
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'research', label: 'Research' },
  { id: 'risk', label: 'Risk & Gate' },
  { id: 'strategies', label: 'Strategies' },
]

export default function App() {
  const [tab, setTab] = useState('cockpit')
  const [conn, setConn] = useState('off')

  const [status, setStatus] = useState(null)
  const [equity, setEquity] = useState([])
  const [trades, setTrades] = useState(null)
  const [orders, setOrders] = useState([])
  const [events, setEvents] = useState([])
  const [scanner, setScanner] = useState([])
  const [strategies, setStrategies] = useState(null)
  const [backtests, setBacktests] = useState(null)
  const [walkforward, setWalkforward] = useState(null)
  const [gate, setGate] = useState(null)
  const [arbitrage, setArbitrage] = useState(null)

  // The websocket carries the fast-moving state (status, orders, events).
  // Everything else is polled on a slower cadence -- pushing a 5000-point
  // equity curve every two seconds would be wasteful and pointless.
  useEffect(() => {
    const close = connect(
      (msg) => {
        if (!msg?.attached) { setConn('stale'); return }
        setConn('live')
        if (msg.status) {
          setStatus(msg.status)
          setScanner(msg.status.scanner || [])
        }
        if (msg.orders) setOrders(msg.orders)
        if (msg.events) setEvents(msg.events)
      },
      setConn
    )
    return close
  }, [])

  const pullFast = useCallback(async () => {
    const [s, e, t] = await Promise.all([api.status(), api.equity(), api.trades()])
    if (!s.__error) { setStatus(s); setScanner(s.scanner || []) }
    if (!e.__error) setEquity(e.points || [])
    if (!t.__error) setTrades(t)
  }, [])

  const pullSlow = useCallback(async () => {
    const [st, bt, wf, g, arb] = await Promise.all([
      api.strategies(), api.backtests(), api.walkforward(), api.gate(), api.arbitrage(),
    ])
    if (!st.__error) setStrategies(st)
    if (!bt.__error) setBacktests(bt)
    if (!wf.__error) setWalkforward(wf)
    if (!g.__error) setGate(g)
    if (!arb.__error) setArbitrage(arb)
  }, [])

  useEffect(() => {
    pullFast(); pullSlow()
    const a = setInterval(pullFast, 6000)
    const b = setInterval(pullSlow, 45000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [pullFast, pullSlow])

  const control = async (action) => {
    if (action === 'flatten' &&
        !confirm('Close every open position at market, right now?')) return
    await api.control(action)
    pullFast()
  }

  const risk = status?.risk || {}
  const eq = (risk.equity || 0) + (risk.unrealised || 0)
  const start = equity?.length ? equity[0].equity : 500
  const ret = start > 0 ? eq / start - 1 : 0

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">QUANT<span>DESK</span></div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          {status?.attached && (
            <>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                <span className="faint" style={{ fontSize: 10, marginRight: 6 }}>EQ</span>
                {money(eq)}
                <span className={dirClass(ret)} style={{ marginLeft: 8 }}>
                  {signedPct(ret)}
                </span>
              </span>
              <span
                className="tag"
                style={status.mode === 'live'
                  ? { color: 'var(--down-bright)', borderColor: 'var(--down)' }
                  : undefined}
              >
                {status.mode}
              </span>
              <button className="btn" onClick={() => control(status.running ? 'stop' : 'start')}>
                {status.running ? 'Pause' : 'Resume'}
              </button>
              <button className="btn danger" onClick={() => control('flatten')}>
                Flatten
              </button>
              {risk.kill_switch && (
                <button className="btn" onClick={() => control('reset_kill')}>
                  Reset kill
                </button>
              )}
            </>
          )}
          <span className="conn">
            <span className={`dot ${conn}`} />
            {conn === 'live' ? `tick ${ago(status?.last_tick)}` : conn === 'stale' ? 'no runner' : 'offline'}
          </span>
        </div>
      </div>

      <div className="body">
        {tab === 'cockpit' && (
          <Cockpit
            status={status} equity={equity} trades={trades}
            orders={orders} events={events} scanner={scanner}
          />
        )}
        {tab === 'research' && <Research backtests={backtests} walkforward={walkforward} />}
        {tab === 'risk' && <RiskView status={status} gate={gate} arbitrage={arbitrage} />}
        {tab === 'strategies' && <Strategies strategies={strategies} />}
      </div>
    </div>
  )
}
