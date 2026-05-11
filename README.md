# Stock Widget

A macOS menubar widget that shows live stock quotes. Click the tray icon to open a popup with your watchlist; the active symbol's price or % change is rendered directly in the menu bar.

## Features

- Live quotes from Yahoo Finance, auto-refreshed every 60 seconds
- Canvas-rendered tray icon — shows price or % change (toggle with the `%` button)
- Click any stock to set it as the active tray symbol
- Click to expand detail view (high, low, volume)
- Drag to reorder watchlist
- Add / remove symbols
- Watchlist and settings persist between launches

## Requirements

- macOS
- Node.js 18+ (via nvm recommended)

## Setup

```bash
nvm use        # or: nvm install --lts
npm install
```

## Running

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

## Project structure

```
electron/
  main.js        # Electron main process, tray, IPC handlers
  preload.js     # contextBridge — exposes window.stockAPI to renderer
  stockFetch.js  # Yahoo Finance v8 chart API (no auth required)
src/
  App.jsx                  # Root component, watchlist state, drag-to-reorder
  components/
    StockItem.jsx          # Individual row — expandable, draggable
    AddStock.jsx           # Add symbol form
  index.css                # Dark theme, pastel green/red
scripts/
  generate-icon.js         # Generates placeholder app icon on postinstall
```

## Persistence

Settings are stored in Electron's `userData` directory:

- `~/Library/Application Support/stock-widget/watchlist.json`
- `~/Library/Application Support/stock-widget/settings.json` — active symbol, tray mode
