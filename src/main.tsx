import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { App } from './App'
import { db } from './db/schema'
import { initTheme } from './lib/theme'
import { startNativeSync } from './native/sync'
import './index.css'

// Android: pull new bank SMS + Health Connect data on start and on every resume. No-op in a browser.
startNativeSync()

// Dev only: expose the DB for seeding/debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { db: typeof db }).db = db

// Saved theme choice (Settings → Appearance); default follows the phone.
initTheme()

// HashRouter: works from file:// inside the Android WebView with no server rewrites.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
