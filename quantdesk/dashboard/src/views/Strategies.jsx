import { useMemo, useState } from 'react'
import { Panel, Tile, Tiles, Empty } from '../components/Panel'
import { SERIES } from '../lib/format'

const FAMILY_COLOR = {
  trend: SERIES[0],
  mean_reversion: SERIES[1],
  breakout: SERIES[2],
  volatility: SERIES[3],
  microstructure: SERIES[4],
  statarb: SERIES[5],
  ensemble: 'var(--ink-faint)',
}

export default function Strategies({ strategies }) {
  const list = strategies?.strategies || []
  const [family, setFamily] = useState('all')
  const [open, setOpen] = useState(null)

  const families = useMemo(() => {
    const s = new Set(list.map((x) => x.family))
    return ['all', ...Array.from(s).sort()]
  }, [list])

  const shown = family === 'all' ? list : list.filter((s) => s.family === family)

  return (
    <div className="grid" style={{ gap: 8 }}>
      <Tiles cols={4}>
        <Tile label="Registered" value={list.length} sub="strategy implementations" />
        <Tile label="Families" value={families.length - 1} sub="distinct approaches" />
        <Tile
          label="Backtestable"
          value={list.filter((s) => s.backtestable).length}
          sub="reconstructable from OHLCV"
        />
        <Tile
          label="Live-only"
          value={list.filter((s) => !s.backtestable).length}
          sub="need L2 depth or funding"
          tone="warn"
        />
      </Tiles>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {families.map((f) => (
          <button
            key={f}
            className={`btn${family === f ? ' on' : ''}`}
            onClick={() => setFamily(f)}
            style={family === f
              ? { color: 'var(--ink)', borderColor: 'var(--accent)' }
              : undefined}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Panel title="Strategy registry" note={`${shown.length} shown`} flush>
        {shown.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Family</th><th>Timeframes</th>
                <th>Short</th><th>Params</th><th>Backtestable</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr
                  key={s.name}
                  onClick={() => setOpen(open === s.name ? null : s.name)}
                  style={{ cursor: 'pointer' }}
                  className={open === s.name ? 'sel' : ''}
                >
                  <td className="sym">{s.name}</td>
                  <td>
                    <span className="tag" style={{ color: FAMILY_COLOR[s.family] }}>
                      {s.family.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="dim">{s.timeframes.join(' ')}</td>
                  <td className="dim">{s.allow_short ? 'yes' : 'long only'}</td>
                  <td className="dim">{Object.keys(s.params).length}</td>
                  <td>
                    <span className={`tag ${s.backtestable ? 'ok' : 'mid'}`}>
                      {s.backtestable ? 'yes' : 'live only'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No strategies loaded — is the engine API running?</Empty>
        )}
      </Panel>

      {open && (() => {
        const s = list.find((x) => x.name === open)
        if (!s) return null
        return (
          <Panel title={s.name} note={s.family.replace('_', ' ')}>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--ink-dim)', marginBottom: 12 }}>
              {s.description}
            </div>
            <div className="tile-label" style={{ marginBottom: 6 }}>Parameters</div>
            <table>
              <thead>
                <tr><th>Parameter</th><th>Default</th><th>Search grid</th></tr>
              </thead>
              <tbody>
                {Object.entries(s.params).map(([k, v]) => (
                  <tr key={k}>
                    <td className="sym" style={{ textAlign: 'left' }}>{k}</td>
                    <td>{String(v.default)}</td>
                    <td className="dim">
                      {Array.isArray(v.grid) && v.grid.length > 1
                        ? v.grid.join(', ')
                        : <span className="faint">fixed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tile-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Every grid combination the optimiser tests inflates selection bias. The
              Deflated Sharpe Ratio in the research tab subtracts the expected best-of-N
              result, so a wider grid actively costs this strategy credibility rather
              than earning it.
            </div>
          </Panel>
        )
      })()}
    </div>
  )
}
