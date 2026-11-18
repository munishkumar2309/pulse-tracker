import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { App } from './App'
import { db } from './db/schema'
import './index.css'

// Dev only: expose the DB for seeding/debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { db: typeof db }).db = db

// Saved theme choice (Settings → Appearance). Storage can be unavailable; default to the OS setting.
try {
  const t = localStorage.getItem('theme')
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t)
} catch { /* ignore */ }

// HashRouter: works from file:// inside the Android WebView with no server rewrites.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
