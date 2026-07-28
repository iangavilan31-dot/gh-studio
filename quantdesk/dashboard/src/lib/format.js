// Formatting helpers. Everything returns a string; nothing throws on null.
// A dashboard that renders "NaN" or "undefined" during a reconnect teaches you
// to distrust it, so every formatter has a defined answer for missing data.

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function money(v, dp = 2) {
  if (!isNum(v)) return '—'
  const s = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  })
  return (v < 0 ? '-$' : '$') + s
}

export function signedMoney(v, dp = 2) {
  if (!isNum(v)) return '—'
  const s = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  })
  return (v < 0 ? '-' : '+') + '$' + s
}

export function pct(v, dp = 1) {
  if (!isNum(v)) return '—'
  return (v * 100).toFixed(dp) + '%'
}

export function signedPct(v, dp = 2) {
  if (!isNum(v)) return '—'
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(dp) + '%'
}

export function num(v, dp = 2) {
  if (!isNum(v)) return '—'
  return v.toFixed(dp)
}

export function price(v) {
  if (!isNum(v)) return '—'
  // Scale precision to magnitude: 4 decimals on BTC is noise, 2 on DOGE is
  // a total loss of information.
  const dp = v >= 1000 ? 1 : v >= 10 ? 2 : v >= 0.1 ? 4 : 6
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function compact(v) {
  if (!isNum(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}

export function ago(iso) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function clock(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(11, 19)
}

export function dayStamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(5, 16).replace('T', ' ')
}

export const dirClass = (v) => (!isNum(v) || v === 0 ? 'neutral' : v > 0 ? 'up' : 'down')

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)']

// Verdict -> tag class. The verdict strings come from metrics.verdict() in
// Python; keep these in sync with that function.
export function verdictClass(v) {
  if (v === 'CANDIDATE') return 'ok'
  if (v === 'MARGINAL' || v === 'INSUFFICIENT') return 'mid'
  return 'bad'
}
