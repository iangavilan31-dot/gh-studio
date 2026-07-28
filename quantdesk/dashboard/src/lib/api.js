// Thin API client. Every call resolves rather than throwing, so one dead
// endpoint degrades a single panel instead of blanking the whole terminal.

async function get(path) {
  try {
    const r = await fetch(path, { headers: { Accept: 'application/json' } })
    if (!r.ok) return { __error: `${r.status} ${r.statusText}` }
    return await r.json()
  } catch (e) {
    return { __error: String(e.message || e) }
  }
}

async function post(path) {
  try {
    const r = await fetch(path, { method: 'POST' })
    return await r.json()
  } catch (e) {
    return { __error: String(e.message || e) }
  }
}

export const api = {
  status:      () => get('/api/status'),
  equity:      () => get('/api/equity'),
  trades:      () => get('/api/trades'),
  orders:      () => get('/api/orders'),
  events:      () => get('/api/events'),
  scanner:     () => get('/api/scanner'),
  strategies:  () => get('/api/strategies'),
  backtests:   () => get('/api/backtests'),
  walkforward: () => get('/api/walkforward'),
  gate:        () => get('/api/gate'),
  arbitrage:   () => get('/api/arbitrage'),
  control:     (action) => post(`/api/control/${action}`),
}

// WebSocket with automatic reconnect. The engine may be restarted mid-session
// (that is normal during development) and the UI should recover on its own
// rather than requiring a reload.
export function connect(onMessage, onState) {
  let sock = null
  let timer = null
  let closed = false

  const open = () => {
    if (closed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    try {
      sock = new WebSocket(`${proto}://${location.host}/ws`)
    } catch {
      schedule()
      return
    }
    sock.onopen = () => onState('live')
    sock.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch { /* ignore malformed frame */ }
    }
    sock.onclose = () => { onState('off'); schedule() }
    sock.onerror = () => { try { sock.close() } catch { /* already closing */ } }
  }

  const schedule = () => {
    if (closed || timer) return
    timer = setTimeout(() => { timer = null; open() }, 2500)
  }

  open()
  return () => {
    closed = true
    if (timer) clearTimeout(timer)
    if (sock) try { sock.close() } catch { /* noop */ }
  }
}
