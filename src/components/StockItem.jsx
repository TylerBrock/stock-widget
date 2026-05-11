import React, { useState } from 'react'

const MARKET_BADGE = { PRE: 'Pre', POST: 'After', CLOSED: 'Closed' }

function fmt(n, d = 2) {
  return n != null ? n.toFixed(d) : '—'
}

function fmtVolume(v) {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return String(v)
}

export default function StockItem({ quote, isActive, onSetActive, onRemove, onDragStart, onDragOver, onDragEnd }) {
  const [expanded, setExpanded] = useState(false)

  if (quote.error) {
    return (
      <div className="stock-item">
        <div className="stock-main">
          <div className="active-indicator" />
          <div className="stock-info">
            <span className="symbol">{quote.symbol}</span>
            <span className="price error-label">Failed to load</span>
          </div>
          <button className="remove-btn visible" onClick={onRemove}>×</button>
        </div>
      </div>
    )
  }

  const up = quote.changePercent >= 0
  const sign = up ? '+' : ''
  const badge = MARKET_BADGE[quote.marketState]

  const handleClick = () => {
    onSetActive()
    setExpanded((x) => !x)
  }

  return (
    <div
      className={`stock-item ${up ? 'up' : 'down'} ${isActive ? 'active' : ''} ${expanded ? 'expanded' : ''}`}
      onClick={handleClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="stock-main">
        <div className="active-indicator" />

        <div className="stock-info">
          <div className="symbol-row">
            <span className="symbol">{quote.symbol}</span>
            {badge && <span className="badge">{badge}</span>}
          </div>
          <span className="price">${fmt(quote.price)}</span>
        </div>

        <div className="stock-perf">
          <span className="pct">{sign}{fmt(quote.changePercent)}%</span>
          <span className="chg">{sign}${fmt(Math.abs(quote.change))}</span>
        </div>

        <button
          className="remove-btn"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
        >×</button>
      </div>

      {expanded && (
        <div className="stock-detail">
          <div className="detail-row">
            <span>Name</span><span>{quote.name}</span>
          </div>
          <div className="detail-row">
            <span>High</span><span>${fmt(quote.high)}</span>
          </div>
          <div className="detail-row">
            <span>Low</span><span>${fmt(quote.low)}</span>
          </div>
          {quote.volume != null && (
            <div className="detail-row">
              <span>Volume</span><span>{fmtVolume(quote.volume)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
