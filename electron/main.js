const { app, BrowserWindow, Tray, nativeImage, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { fetchQuotes } = require('./stockFetch')

const isDev = !!process.env.VITE_DEV_SERVER_URL

let tray = null
let win = null
let winReady = false
let activeSymbol = null
let trayMode = 'price'

// --- Persistence ---

function watchlistPath() {
  return path.join(app.getPath('userData'), 'watchlist.json')
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadWatchlist() {
  try {
    return JSON.parse(fs.readFileSync(watchlistPath(), 'utf8'))
  } catch {
    return ['MDB', 'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'SPY']
  }
}

function saveWatchlist(symbols) {
  fs.writeFileSync(watchlistPath(), JSON.stringify(symbols), 'utf8')
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
  } catch {
    return {}
  }
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings), 'utf8')
}

// --- Tray icon rendering ---

async function makeTrayIcon(symbol, valueStr, valueColor) {
  if (!winReady || !win || win.isDestroyed()) return null

  const H = 44

  try {
    const dataURL = await win.webContents.executeJavaScript(`
      (() => {
        const H = ${H}
        const mid = H / 2

        const measure = document.createElement('canvas').getContext('2d')
        measure.font = 'bold 28px -apple-system, BlinkMacSystemFont'
        const tickerW = measure.measureText(${JSON.stringify(symbol)}).width
        measure.font = '26px -apple-system, BlinkMacSystemFont'
        const valW = measure.measureText(${JSON.stringify(valueStr)}).width
        const gap = 10
        const W = Math.ceil(tickerW + gap + valW)

        const c = document.createElement('canvas')
        c.width = W
        c.height = H
        const ctx = c.getContext('2d')
        ctx.textBaseline = 'middle'

        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont'
        ctx.fillStyle = '#f2f2f7'
        ctx.fillText(${JSON.stringify(symbol)}, 0, mid)

        ctx.font = '26px -apple-system, BlinkMacSystemFont'
        ctx.fillStyle = ${JSON.stringify(valueColor)}
        ctx.fillText(${JSON.stringify(valueStr)}, tickerW + gap, mid)

        return c.toDataURL()
      })()
    `)
    const buf = Buffer.from(dataURL.split(',')[1], 'base64')
    return nativeImage.createFromBuffer(buf, { scaleFactor: 2.0 })
  } catch (err) {
    console.error('makeTrayIcon failed:', err.message)
    return null
  }
}

async function updateTray(quotes) {
  if (!tray) return
  const valid = quotes.filter((q) => !q.error)
  if (!valid.length) {
    tray.setImage(nativeImage.createEmpty())
    tray.setTitle(' ●')
    return
  }

  const q = valid.find((x) => x.symbol === activeSymbol) || valid[0]
  const isUp = q.changePercent >= 0
  const valueColor = isUp ? '#6ee7b7' : '#fda4af'
  const valueStr = trayMode === 'pct'
    ? `${isUp ? '+' : ''}${q.changePercent.toFixed(2)}%`
    : `$${q.price.toFixed(2)}`

  const icon = await makeTrayIcon(q.symbol, valueStr, valueColor)
  if (icon) {
    tray.setImage(icon)
    tray.setTitle('')
  } else {
    tray.setImage(nativeImage.createEmpty())
    tray.setTitle(` ${q.symbol}  ${valueStr}`)
  }
}

// --- Window positioning ---

function positionWindow() {
  const tb = tray.getBounds()
  const wb = win.getBounds()
  const display = screen.getDisplayNearestPoint({ x: tb.x, y: tb.y })
  const wa = display.workArea

  let x = Math.round(tb.x + tb.width / 2 - wb.width / 2)
  const y = tb.y + tb.height + 4

  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - wb.width - 8))
  win.setPosition(x, y, false)
}

// --- App lifecycle ---

app.whenReady().then(async () => {
  app.dock?.hide()

  const settings = loadSettings()
  const watchlist = loadWatchlist()
  activeSymbol = settings.activeSymbol || watchlist[0] || null
  trayMode = settings.trayMode || 'price'

  tray = new Tray(nativeImage.createEmpty())
  tray.setToolTip('Stock Ticker')

  win = new BrowserWindow({
    width: 280,
    height: 540,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    transparent: false,
    backgroundColor: '#1c1c1e',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }


  win.webContents.once('did-finish-load', async () => {
    winReady = true
    try {
      const quotes = await fetchQuotes(loadWatchlist())
      await updateTray(quotes)
      win.webContents.send('quotes-updated', quotes)
    } catch (err) {
      console.error('Post-load fetch error:', err.message)
    }
  })

  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      positionWindow()
      win.show()
      app.focus({ steal: true })
      win.focus()
      win.webContents.focus()
    }
  })

  // Delay hiding so click events inside the window fire before it disappears.
  // Without this, mousedown on the + button triggers blur before the click
  // event, and the form submit never runs.
  let blurTimer = null
  win.on('focus', () => { clearTimeout(blurTimer) })
  win.on('blur', () => {
    if (!isDev) blurTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.hide()
    }, 300)
  })

  // IPC
  ipcMain.handle('get-watchlist', () => loadWatchlist())

  ipcMain.handle('save-watchlist', (_, symbols) => {
    saveWatchlist(symbols)
    // If active symbol was removed, fall back to first
    if (!symbols.includes(activeSymbol)) {
      activeSymbol = symbols[0] || null
      saveSettings({ ...loadSettings(), activeSymbol })
    }
    return symbols
  })

  ipcMain.handle('get-active-symbol', () => activeSymbol)

  ipcMain.handle('set-active-symbol', async (_, symbol) => {
    activeSymbol = symbol
    saveSettings({ ...loadSettings(), activeSymbol })
    // Re-render tray immediately with the new active symbol
    try {
      const quotes = await fetchQuotes(loadWatchlist())
      await updateTray(quotes)
    } catch (err) {
      console.error('set-active-symbol fetch error:', err.message)
    }
    return symbol
  })

  ipcMain.handle('get-tray-mode', () => trayMode)

  ipcMain.handle('set-tray-mode', async (_, mode) => {
    trayMode = mode
    saveSettings({ ...loadSettings(), trayMode })
    try {
      const quotes = await fetchQuotes(loadWatchlist())
      await updateTray(quotes)
    } catch (err) {
      console.error('set-tray-mode fetch error:', err.message)
    }
    return mode
  })

  ipcMain.handle('resize-window', (_, height) => {
    if (win && !win.isDestroyed()) win.setSize(280, Math.max(100, height + 2))
  })

  ipcMain.handle('fetch-quotes', async (_, symbols) => {
    const quotes = await fetchQuotes(symbols)
    await updateTray(quotes)
    return quotes
  })

  // Initial fetch
  try {
    const quotes = await fetchQuotes(watchlist)
    await updateTray(quotes)
  } catch (err) {
    console.error('Initial fetch error:', err.message)
  }

  setInterval(async () => {
    try {
      const quotes = await fetchQuotes(loadWatchlist())
      await updateTray(quotes)
      if (!win.isDestroyed()) win.webContents.send('quotes-updated', quotes)
    } catch (err) {
      console.error('Refresh error:', err.message)
    }
  }, 60_000)
})

app.on('window-all-closed', (e) => e.preventDefault())
