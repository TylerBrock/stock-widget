import React, { useState, useEffect, useCallback, useRef } from 'react'
import StockItem from './components/StockItem'
import AddStock from './components/AddStock'

const MARKET_BADGE = { PRE: 'Pre', POST: 'After', CLOSED: 'Closed' }

export default function App() {
  const [quotes, setQuotes] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [trayMode, setTrayMode] = useState('price')
  const [afterHours, setAfterHours] = useState(false)
  const dragSrc = useRef(null)

  const refresh = useCallback(async (symbols) => {
    const data = await window.stockAPI.fetchQuotes(symbols)
    setQuotes(data)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      const [symbols, active, mode, ah] = await Promise.all([
        window.stockAPI.getWatchlist(),
        window.stockAPI.getActiveSymbol(),
        window.stockAPI.getTrayMode(),
        window.stockAPI.getAfterHours(),
      ])
      setTrayMode(mode || 'price')
      setAfterHours(!!ah)
      setWatchlist(symbols)
      setActiveSymbol(active || symbols[0])
      await refresh(symbols)
    })()

    const cleanup = window.stockAPI.onQuotesUpdated((data) => {
      setQuotes(data)
      setLastUpdated(new Date())
    })
    return cleanup
  }, [refresh])

  const addSymbol = async (symbol) => {
    if (watchlist.includes(symbol)) return
    const next = [...watchlist, symbol]
    await window.stockAPI.saveWatchlist(next)
    setWatchlist(next)
    await refresh(next)
  }

  const removeSymbol = async (symbol) => {
    const next = watchlist.filter((s) => s !== symbol)
    await window.stockAPI.saveWatchlist(next)
    setWatchlist(next)
    setQuotes((q) => q.filter((x) => x.symbol !== symbol))
    if (activeSymbol === symbol) {
      const fallback = next[0] || null
      setActiveSymbol(fallback)
    }
  }

  const selectActive = async (symbol) => {
    setActiveSymbol(symbol)
    await window.stockAPI.setActiveSymbol(symbol)
  }

  const toggleTrayMode = async () => {
    const next = trayMode === 'price' ? 'pct' : 'price'
    setTrayMode(next)
    await window.stockAPI.setTrayMode(next)
  }

  const toggleAfterHours = async () => {
    const next = !afterHours
    setAfterHours(next)
    await window.stockAPI.setAfterHours(next)
  }

  const handleDragStart = (symbol) => {
    dragSrc.current = symbol
  }

  const handleDragOver = (e, symbol) => {
    e.preventDefault()
    if (dragSrc.current === symbol) return
    const src = dragSrc.current
    setQuotes((prev) => {
      const next = [...prev]
      const fromIdx = next.findIndex((q) => q.symbol === src)
      const toIdx = next.findIndex((q) => q.symbol === symbol)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
    setWatchlist((prev) => {
      const next = [...prev]
      const fromIdx = next.indexOf(src)
      const toIdx = next.indexOf(symbol)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  const handleDragEnd = async () => {
    setWatchlist((current) => {
      window.stockAPI.saveWatchlist(current)
      return current
    })
    dragSrc.current = null
  }

  useEffect(() => {
    const el = document.querySelector('.app')
    if (!el) return
    const observer = new ResizeObserver(() => {
      window.stockAPI.resizeWindow(Math.ceil(el.offsetHeight))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const formatTime = (d) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const activeQuote = quotes.find((q) => q.symbol === activeSymbol && !q.error)
  const marketBadge = activeQuote && MARKET_BADGE[activeQuote.marketState]

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <span className="title">Markets</span>
          {marketBadge && <span className="badge header-badge">{marketBadge}</span>}
        </div>
        <div className="header-right">
          {lastUpdated && (
            <span className="updated">{formatTime(lastUpdated)}</span>
          )}
          <button
            className={`icon-btn moon-btn ${afterHours ? 'active' : ''}`}
            onClick={toggleAfterHours}
            title="Show after-hours price"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <button
            className={`icon-btn tray-mode-btn ${trayMode === 'pct' ? 'active' : ''}`}
            onClick={toggleTrayMode}
            title="Toggle tray display"
          >%</button>
          <button className="icon-btn" onClick={() => refresh(watchlist)} title="Refresh">
            ↻
          </button>
        </div>
      </div>

      <div className="stock-list">
        {loading ? (
          <div className="state-msg">Fetching quotes…</div>
        ) : quotes.length === 0 ? (
          <div className="state-msg">Add a symbol below to get started.</div>
        ) : (
          quotes.map((quote) => (
            <StockItem
              key={quote.symbol}
              quote={quote}
              isActive={quote.symbol === activeSymbol}
              onSetActive={() => selectActive(quote.symbol)}
              onRemove={() => removeSymbol(quote.symbol)}
              onDragStart={() => handleDragStart(quote.symbol)}
              onDragOver={(e) => handleDragOver(e, quote.symbol)}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>

      <AddStock onAdd={addSymbol} existing={watchlist} />
    </div>
  )
}
