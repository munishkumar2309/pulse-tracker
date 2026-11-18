// Light / dark / follow-the-phone. Sets <html class="dark"> (used by shadcn `dark:` styles and tokens)
// and data-theme="light" to override a dark OS. Choice saved in localStorage (try/catch: may be unavailable).
export type ThemeMode = 'system' | 'light' | 'dark'

const media = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function getThemeMode(): ThemeMode {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function apply(mode: ThemeMode) {
  const root = document.documentElement
  const dark = mode === 'dark' || (mode === 'system' && !!media()?.matches)
  root.classList.toggle('dark', dark)
  if (mode === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0A0D10' : '#F1F3F4')
}

export function setThemeMode(mode: ThemeMode) {
  try { localStorage.setItem('theme', mode) } catch { /* ignore */ }
  apply(mode)
}

/** Call once at startup: applies the saved mode and follows OS changes while in "system". */
export function initTheme() {
  apply(getThemeMode())
  media()?.addEventListener('change', () => { if (getThemeMode() === 'system') apply('system') })
}
