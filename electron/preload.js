const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('stockAPI', {
  getWatchlist: () => ipcRenderer.invoke('get-watchlist'),
  saveWatchlist: (symbols) => ipcRenderer.invoke('save-watchlist', symbols),
  fetchQuotes: (symbols) => ipcRenderer.invoke('fetch-quotes', symbols),
  getActiveSymbol: () => ipcRenderer.invoke('get-active-symbol'),
  setActiveSymbol: (symbol) => ipcRenderer.invoke('set-active-symbol', symbol),
  resizeWindow: (height) => ipcRenderer.invoke('resize-window', height),
  getTrayMode: () => ipcRenderer.invoke('get-tray-mode'),
  setTrayMode: (mode) => ipcRenderer.invoke('set-tray-mode', mode),
  getAfterHours: () => ipcRenderer.invoke('get-after-hours'),
  setAfterHours: (enabled) => ipcRenderer.invoke('set-after-hours', enabled),
  onQuotesUpdated: (cb) => {
    const handler = (_, quotes) => cb(quotes)
    ipcRenderer.on('quotes-updated', handler)
    return () => ipcRenderer.removeListener('quotes-updated', handler)
  },
})
