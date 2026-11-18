// Display helpers. Money is stored as integer paise everywhere.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

/** ₹1,25,000 (rounded) or ₹1,25,000.50 with exact=true. */
export function formatINR(paise: number, exact = false): string {
  return (exact ? inrExact : inr).format(paise / 100)
}

/** Short form for tiles: ₹950, ₹12.5K, ₹1.2L, ₹3.4Cr. */
export function formatINRShort(paise: number): string {
  const r = Math.abs(paise / 100)
  const sign = paise < 0 ? '-' : ''
  if (r >= 1e7) return `${sign}₹${trim(r / 1e7)}Cr`
  if (r >= 1e5) return `${sign}₹${trim(r / 1e5)}L`
  if (r >= 1e3) return `${sign}₹${trim(r / 1e3)}K`
  return `${sign}₹${Math.round(r)}`
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString()

/** Local-time day key, YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function minutesToHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
