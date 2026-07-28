import { useMemo, useRef, useState, useCallback } from 'react'
import { money, num, pct, dayStamp, isNum } from '../lib/format'

/* Hand-rolled SVG charts.
 *
 * No charting library: the shapes needed here are simple, and every library
 * brings its own default styling that fights the terminal aesthetic. The
 * tradeoff is that axis ticks and hit-testing are written out explicitly below.
 *
 * Every chart with a plot ships a crosshair and tooltip -- an HTML chart is
 * interactive by nature and a static one wastes that.
 */

function niceTicks(lo, hi, count = 5) {
  if (!isNum(lo) || !isNum(hi) || lo === hi) return [lo || 0]
  const span = hi - lo
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag
  const start = Math.ceil(lo / step) * step
  const out = []
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(v)
  return out
}

function useTooltip() {
  const [tip, setTip] = useState(null)
  const show = useCallback((x, y, content) => setTip({ x, y, content }), [])
  const hide = useCallback(() => setTip(null), [])
  const node = tip ? (
    <div
      className="tooltip"
      style={{
        left: Math.min(tip.x + 12, window.innerWidth - 190),
        top: Math.max(8, tip.y - 12),
      }}
    >
      {tip.content}
    </div>
  ) : null
  return { show, hide, node }
}

/* ------------------------------------------------------------------ line */

export function LineChart({
  series,           // [{ name, color, points: [{ x, y }] }]
  height = 220,
  yFormat = (v) => num(v, 2),
  xFormat = dayStamp,
  baseline = null,  // draw a reference line (e.g. starting equity)
  fill = false,
}) {
  const wrap = useRef(null)
  const [w, setW] = useState(720)
  const { show, hide, node } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState(null)

  const onRef = useCallback((el) => {
    wrap.current = el
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    setW(Math.max(240, el.clientWidth))
  }, [])

  const pad = { l: 54, r: 12, t: 10, b: 20 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = Math.max(10, height - pad.t - pad.b)

  const model = useMemo(() => {
    const live = (series || []).filter((s) => s.points && s.points.length > 1)
    if (!live.length) return null

    const allY = live.flatMap((s) => s.points.map((p) => p.y)).filter(isNum)
    if (!allY.length) return null

    let lo = Math.min(...allY, baseline ?? Infinity)
    let hi = Math.max(...allY, baseline ?? -Infinity)
    if (lo === hi) { lo -= 1; hi += 1 }
    const padY = (hi - lo) * 0.08
    lo -= padY; hi += padY

    const n = Math.max(...live.map((s) => s.points.length))
    const sx = (i) => pad.l + (i / Math.max(1, n - 1)) * iw
    const sy = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih

    return { live, lo, hi, n, sx, sy }
  }, [series, baseline, iw, ih, w, height])

  const onMove = (e) => {
    if (!model) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - rect.left - pad.l
    const i = Math.round((rel / iw) * (model.n - 1))
    if (i < 0 || i >= model.n) { setHoverIdx(null); hide(); return }
    setHoverIdx(i)

    const rows = model.live.map((s) => {
      const p = s.points[Math.min(i, s.points.length - 1)]
      return (
        <div className="tt-row" key={s.name}>
          <span className="tt-key">
            <i className="swatch" style={{ background: s.color }} />
            {s.name}
          </span>
          <span>{yFormat(p?.y)}</span>
        </div>
      )
    })
    const anchor = model.live[0].points[Math.min(i, model.live[0].points.length - 1)]
    show(e.clientX, e.clientY, (
      <>
        <div className="tt-row" style={{ marginBottom: 3 }}>
          <span className="tt-key">{xFormat(anchor?.x)}</span>
        </div>
        {rows}
      </>
    ))
  }

  const onLeave = () => { setHoverIdx(null); hide() }

  if (!model) {
    return <div ref={onRef} className="empty">no data</div>
  }

  const ticks = niceTicks(model.lo, model.hi, 5)

  return (
    <div ref={onRef} style={{ width: '100%' }}>
      <svg className="chart" width={w} height={height} onMouseMove={onMove} onMouseLeave={onLeave}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={w - pad.r} y1={model.sy(t)} y2={model.sy(t)} />
            <text x={pad.l - 6} y={model.sy(t) + 3} textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}

        {isNum(baseline) && (
          <line
            x1={pad.l} x2={w - pad.r}
            y1={model.sy(baseline)} y2={model.sy(baseline)}
            stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="4 4"
          />
        )}

        {model.live.map((s) => {
          const d = s.points
            .map((p, i) => `${i ? 'L' : 'M'}${model.sx(i).toFixed(1)},${model.sy(p.y).toFixed(1)}`)
            .join(' ')
          const area = fill
            ? `${d} L${model.sx(s.points.length - 1).toFixed(1)},${pad.t + ih} L${pad.l},${pad.t + ih} Z`
            : null
          return (
            <g key={s.name}>
              {area && <path d={area} fill={s.color} opacity="0.10" />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {hoverIdx != null && (
          <>
            <line className="crosshair" x1={model.sx(hoverIdx)} x2={model.sx(hoverIdx)}
                  y1={pad.t} y2={pad.t + ih} />
            {model.live.map((s) => {
              const p = s.points[Math.min(hoverIdx, s.points.length - 1)]
              if (!p || !isNum(p.y)) return null
              return (
                <circle key={s.name} cx={model.sx(hoverIdx)} cy={model.sy(p.y)} r="4"
                        fill={s.color} stroke="var(--panel)" strokeWidth="2" />
              )
            })}
          </>
        )}

        <line className="axis-line" x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} />
      </svg>
      {node}
    </div>
  )
}

/* ------------------------------------------------------- drawdown (area) */

export function DrawdownChart({ equity, height = 96 }) {
  const points = useMemo(() => {
    if (!equity?.length) return []
    let peak = -Infinity
    return equity.map((p) => {
      peak = Math.max(peak, p.y)
      return { x: p.x, y: peak > 0 ? p.y / peak - 1 : 0 }
    })
  }, [equity])

  return (
    <LineChart
      series={[{ name: 'drawdown', color: 'var(--down-bright)', points }]}
      height={height}
      yFormat={(v) => pct(v, 0)}
      fill
    />
  )
}

/* ------------------------------------------------------------------ bars */

export function BarChart({ data, height = 200, valueFormat = (v) => num(v, 2), color }) {
  const wrap = useRef(null)
  const [w, setW] = useState(600)
  const { show, hide, node } = useTooltip()

  const onRef = useCallback((el) => {
    wrap.current = el
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    setW(Math.max(200, el.clientWidth))
  }, [])

  const pad = { l: 54, r: 10, t: 8, b: 46 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = Math.max(10, height - pad.t - pad.b)

  if (!data?.length) return <div ref={onRef} className="empty">no data</div>

  const vals = data.map((d) => d.value).filter(isNum)
  const lo = Math.min(0, ...vals)
  const hi = Math.max(0, ...vals)
  const span = hi - lo || 1
  const sy = (v) => pad.t + ih - ((v - lo) / span) * ih
  // 2px gap between adjacent bars so fills never touch.
  const bw = Math.max(2, iw / data.length - 2)
  const ticks = niceTicks(lo, hi, 4)

  return (
    <div ref={onRef} style={{ width: '100%' }}>
      <svg className="chart" width={w} height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end">{valueFormat(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + (i / data.length) * iw + 1
          const y0 = sy(0)
          const y1 = sy(d.value)
          const top = Math.min(y0, y1)
          const h = Math.max(1, Math.abs(y1 - y0))
          const c = color || (d.value >= 0 ? 'var(--up)' : 'var(--down)')
          return (
            <g key={d.label + i}>
              <rect
                x={x} y={top} width={bw} height={h} fill={c}
                rx="2"
                onMouseMove={(e) => show(e.clientX, e.clientY, (
                  <>
                    <div className="tt-row"><span className="tt-key">{d.label}</span></div>
                    <div className="tt-row">
                      <span className="tt-key">value</span><span>{valueFormat(d.value)}</span>
                    </div>
                  </>
                ))}
                onMouseLeave={hide}
              />
              {data.length <= 26 && (
                <text
                  x={x + bw / 2} y={height - pad.b + 12}
                  textAnchor="end"
                  transform={`rotate(-40 ${x + bw / 2} ${height - pad.b + 12})`}
                >
                  {d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label}
                </text>
              )}
            </g>
          )
        })}
        <line className="axis-line" x1={pad.l} x2={w - pad.r} y1={sy(0)} y2={sy(0)} />
      </svg>
      {node}
    </div>
  )
}

/* ------------------------------------------------------------- sparkline */

export function Spark({ values, width = 78, height = 20, color }) {
  if (!values?.length || values.length < 2) return <span className="faint">—</span>
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - lo) / span) * height
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const c = color || (values[values.length - 1] >= values[0] ? 'var(--up-bright)' : 'var(--down-bright)')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={c} strokeWidth="1.5" />
    </svg>
  )
}

/* ------------------------------------------------------------ meter bar */

export function Meter({ value, max, danger = 0.8, label }) {
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const color = frac >= danger ? 'var(--down-bright)' : frac >= 0.5 ? 'var(--warn)' : 'var(--up)'
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}
             className="tile-label">
          <span>{label}</span>
          <span>{pct(frac, 0)}</span>
        </div>
      )}
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </div>
  )
}

/* --------------------------------------------------- monte carlo bands */

export function BandChart({ bands, height = 200, starting = 500 }) {
  const wrap = useRef(null)
  const [w, setW] = useState(600)
  const onRef = useCallback((el) => {
    wrap.current = el
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    setW(Math.max(240, el.clientWidth))
  }, [])

  if (!bands?.p50?.length) return <div ref={onRef} className="empty">no simulation data</div>

  const pad = { l: 54, r: 10, t: 8, b: 18 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = Math.max(10, height - pad.t - pad.b)
  const n = bands.p50.length
  const all = [...bands.p05, ...bands.p95]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const sx = (i) => pad.l + (i / Math.max(1, n - 1)) * iw
  const sy = (v) => pad.t + ih - ((v - lo) / ((hi - lo) || 1)) * ih

  const ribbon = (a, b) =>
    a.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ') +
    ' ' +
    b.map((v, i) => `L${sx(b.length - 1 - i).toFixed(1)},${sy(b[b.length - 1 - i]).toFixed(1)}`).join(' ') +
    ' Z'

  const line = (a) =>
    a.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')

  const ticks = niceTicks(lo, hi, 4)

  return (
    <div ref={onRef} style={{ width: '100%' }}>
      <svg className="chart" width={w} height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end">{money(t, 0)}</text>
          </g>
        ))}
        <path d={ribbon(bands.p05, bands.p95)} fill="var(--s1)" opacity="0.13" />
        <path d={ribbon(bands.p25, bands.p75)} fill="var(--s1)" opacity="0.22" />
        <path d={line(bands.p50)} fill="none" stroke="var(--s1)" strokeWidth="2" />
        <line x1={pad.l} x2={w - pad.r} y1={sy(starting)} y2={sy(starting)}
              stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="4 4" />
        <line className="axis-line" x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} />
      </svg>
    </div>
  )
}
