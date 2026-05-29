const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com/',
}

async function fetchSingleQuote(symbol) {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  if (!meta?.regularMarketPrice) throw new Error('No data')

  const price = meta.regularMarketPrice
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change = price - prevClose
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0

  const timestamps = result?.timestamp ?? []
  const allCloses = result?.indicators?.quote?.[0]?.close ?? []
  const reg = meta?.tradingPeriods?.regular?.[0]?.[0]
  const pre = meta?.tradingPeriods?.pre?.[0]?.[0]
  const post = meta?.tradingPeriods?.post?.[0]?.[0]

  const lastCloseIn = (start, end) => {
    if (start == null || end == null) return null
    let last = null
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i]
      if (t >= start && t < end && allCloses[i] != null) last = allCloses[i]
    }
    return last
  }

  // Sparkline uses regular-session bars only — pre/post bars would stretch
  // the chart across hours of mostly-flat trading.
  const closes = reg
    ? timestamps
        .map((t, i) => (t >= reg.start && t < reg.end ? allCloses[i] : null))
        .filter((c) => c != null)
    : allCloses.filter((c) => c != null)

  const prePrice = pre ? lastCloseIn(pre.start, pre.end) : null
  const postPrice = post ? lastCloseIn(post.start, post.end) : null
  // Extended-hours change is measured against the most recent regular close
  // (regularMarketPrice), not chartPreviousClose — when range=1d is requested
  // before the regular session opens, chartPreviousClose points at the session
  // *before* the most recent close.
  const preChange = prePrice != null ? prePrice - price : null
  const preChangePercent = prePrice != null && price !== 0
    ? ((prePrice - price) / price) * 100
    : null
  const postChange = postPrice != null ? postPrice - price : null
  const postChangePercent = postPrice != null && price !== 0
    ? ((postPrice - price) / price) * 100
    : null

  // Yahoo's chart endpoint omits marketState; derive it from the period windows.
  const now = Math.floor(Date.now() / 1000)
  let marketState = 'CLOSED'
  if (reg && now >= reg.start && now < reg.end) marketState = 'REGULAR'
  else if (post && now >= post.start && now < post.end) marketState = 'POST'
  else if (pre && now >= pre.start && now < pre.end) marketState = 'PRE'

  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    price,
    change,
    changePercent,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    marketState,
    closes,
    prevClose,
    prePrice,
    preChange,
    preChangePercent,
    postPrice,
    postChange,
    postChangePercent,
  }
}

async function fetchQuotes(symbols) {
  const results = await Promise.allSettled(symbols.map(fetchSingleQuote))
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: true }
  )
}

module.exports = { fetchQuotes }
