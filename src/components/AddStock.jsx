import React, { useState } from 'react'

export default function AddStock({ onAdd, existing }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const sym = value.trim().toUpperCase()
    if (!sym) return
    if (existing.includes(sym)) {
      setError(`${sym} already in watchlist`)
      return
    }
    onAdd(sym)
    setValue('')
    setError('')
  }

  return (
    <div className="add-stock-wrap">
      <form className="add-stock" onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          placeholder="Add symbol  (e.g. NVDA)"
          maxLength={10}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="characters"
        />
        <button type="submit" disabled={!value.trim()}>+</button>
      </form>
      {error && <span className="add-error">{error}</span>}
    </div>
  )
}
