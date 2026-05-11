# Stock Widget — Claude instructions

macOS menubar stock ticker built with Electron 33 + React 18 (Vite 5).

## Commands

- **Dev:** `npm run dev` (Vite + Electron with hot reload)
- **Prod:** `npm start` (builds Vite bundle, then launches Electron)

## Architecture

- `electron/main.js` — main process (CJS). Owns the Tray, BrowserWindow, IPC handlers, and 60s refresh interval.
- `electron/preload.js` — exposes `window.stockAPI` via contextBridge (`contextIsolation: true`).
- `electron/stockFetch.js` — fetches quotes from Yahoo Finance v8 chart API. No auth or crumb needed.
- `src/App.jsx` — root React component. Owns watchlist, quotes, activeSymbol, trayMode state.
- `src/components/StockItem.jsx` — single row, draggable, click-to-expand.
- `src/components/AddStock.jsx` — add symbol form.

## IPC surface (window.stockAPI)

`getWatchlist`, `saveWatchlist`, `fetchQuotes`, `getActiveSymbol`, `setActiveSymbol`, `resizeWindow`, `getTrayMode`, `setTrayMode`, `onQuotesUpdated`

## Tray icon rendering

Drawn on a `<canvas>` in the renderer via `win.webContents.executeJavaScript()`, returned as a dataURL, converted to `nativeImage` in the main process with `scaleFactor: 2.0` for retina. The `winReady` flag must be true before calling `executeJavaScript`.

## Critical gotchas

- **Always `import React from 'react'`** in every JSX file. Vite falls back to the classic JSX transform (`React.createElement`) and crashes without it.
- **Do not re-add vibrancy.** `vibrancy: 'under-window'` + `transparent: true` causes a blank popup on macOS Sequoia. Window uses `backgroundColor: '#1c1c1e'`, `transparent: false`.
- **Do not use yahoo-finance2.** It's ESM-only and Yahoo's crumb endpoint rate-limits. All quote fetching goes through `electron/stockFetch.js`.
- **Window width is 280px** — set in both the BrowserWindow config and `.app { width }` in CSS. Change both together.
- **Window height is dynamic** — driven by a ResizeObserver on `.app` in `App.jsx` → `resizeWindow` IPC → `win.setSize(280, h)`.

## Git

- Commit email: `tyler.brock@gmail.com`
