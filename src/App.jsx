import React, { useState, useEffect, useCallback, useRef } from 'react'
import StockItem from './components/StockItem'
import AddStock from './components/AddStock'

export default function App() {
  const [quotes, setQuotes] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [trayMode, setTrayMode] = useState('price')
  const dragSrc = useRef(null)

  const refresh = useCallback(async (symbols) => {
    const data = await window.stockAPI.fetchQuotes(symbols)
    setQuotes(data)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      const [symbols, active, mode] = await Promise.all([
        window.stockAPI.getWatchlist(),
        window.stockAPI.getActiveSymbol(),
        window.stockAPI.getTrayMode(),
      ])
      setTrayMode(mode || 'price')
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

  return (
    <div className="app">
      <div className="header">
        <span className="title">Markets</span>
        <div className="header-right">
          {lastUpdated && (
            <span className="updated">{formatTime(lastUpdated)}</span>
          )}
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
