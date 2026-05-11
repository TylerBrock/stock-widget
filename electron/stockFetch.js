const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com/',
}

async function fetchSingleQuote(symbol) {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error('No data')

  const price = meta.regularMarketPrice
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change = price - prevClose
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0

  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    price,
    change,
    changePercent,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    marketState: meta.marketState,
  }
}

async function fetchQuotes(symbols) {
  const results = await Promise.allSettled(symbols.map(fetchSingleQuote))
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: true }
  )
}

module.exports = { fetchQuotes }
