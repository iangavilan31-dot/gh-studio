export function Panel({ title, note, children, flush = false, actions }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {note && <span className="panel-note">{note}</span>}
        {actions && <span style={{ marginLeft: note ? 8 : 'auto', display: 'flex', gap: 6 }}>{actions}</span>}
      </div>
      <div className={`panel-body${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  )
}

export function Tiles({ cols = 4, children }) {
  return <div className={`tiles c${cols}`}>{children}</div>
}

export function Tile({ label, value, sub, tone = 'neutral' }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className={`tile-value ${tone}`}>{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function Note({ children, tone = '' }) {
  return <div className={`note ${tone}`}>{children}</div>
}
