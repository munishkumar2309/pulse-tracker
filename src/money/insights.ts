// Spending analytics over Transaction[]. Pure functions; amounts in paise.
import type { Transaction } from '../db/schema'

/** Money put away (FD, SIP, stocks, gold). Tracked on its own, not counted as spending. */
export const INVESTMENTS = 'Investments'
export const isInvestment = (t: Transaction) => t.type === 'debit' && !t.excluded && t.category === INVESTMENTS
export const isSpend = (t: Transaction) => t.type === 'debit' && !t.excluded && t.category !== INVESTMENTS
export const monthOf = (date: string) => date.slice(0, 7) // YYYY-MM
const sum = (ts: Transaction[]) => ts.reduce((a, t) => a + t.amountPaise, 0)

export function prevMonth(month: string, back = 1): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 - back, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function totals(txns: Transaction[]) {
  return {
    spend: sum(txns.filter(isSpend)),
    income: sum(txns.filter((t) => t.type === 'credit' && !t.excluded)),
    invested: sum(txns.filter(isInvestment)),
  }
}

export function inMonth(txns: Transaction[], month: string) {
  return txns.filter((t) => monthOf(t.date) === month)
}

/** Rows of `month` dated on or before day `uptoDay` (1–31). Without `uptoDay`, the whole month. */
export function inMonthUpTo(txns: Transaction[], month: string, uptoDay?: number) {
  const rows = inMonth(txns, month)
  return uptoDay ? rows.filter((t) => +t.date.slice(8, 10) <= uptoDay) : rows
}

/**
 * Month totals and the change against last month. With `uptoDay` (a month still in progress),
 * the change is like-for-like: this month's days 1..uptoDay against the same days of last month.
 * `prevSpend` is always last month's full total.
 */
export function monthSummary(txns: Transaction[], month: string, uptoDay?: number) {
  const cur = totals(inMonth(txns, month))
  const prevFull = totals(inMonth(txns, prevMonth(month)))
  const prevSame = uptoDay ? totals(inMonthUpTo(txns, prevMonth(month), uptoDay)).spend : prevFull.spend
  const changePct = prevSame ? Math.round(((cur.spend - prevSame) / prevSame) * 100) : null
  return { ...cur, prevSpend: prevFull.spend, prevSameSpend: prevSame, changePct, likeForLike: !!uptoDay }
}

/**
 * Category-by-category comparison with last month (like-for-like when `uptoDay` is given).
 * Sorted by the size of the change, biggest first. `pct` is null for a category new this month.
 */
export function compareMonths(txns: Transaction[], month: string, uptoDay?: number) {
  const now = new Map(byCategory(inMonth(txns, month)).map((c) => [c.category, c.paise]))
  const before = new Map(byCategory(inMonthUpTo(txns, prevMonth(month), uptoDay)).map((c) => [c.category, c.paise]))
  return [...new Set([...now.keys(), ...before.keys()])]
    .map((category) => {
      const a = now.get(category) ?? 0
      const b = before.get(category) ?? 0
      return { category, now: a, prev: b, delta: a - b, pct: b ? Math.round(((a - b) / b) * 100) : null }
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || y.now - x.now)
}

/** Spend per month for the `count` months ending at `month`, oldest first, with the biggest category of each. */
export function monthlyHistory(txns: Transaction[], month: string, count = 6) {
  return [...Array(count)].map((_, i) => {
    const m = prevMonth(month, count - 1 - i)
    const rows = inMonth(txns, m)
    const top = byCategory(rows)[0]
    return { month: m, spend: totals(rows).spend, invested: totals(rows).invested, topCategory: top?.category ?? null, topPaise: top?.paise ?? 0 }
  })
}

export function byCategory(txns: Transaction[]) {
  const map = new Map<string, { category: string; paise: number; count: number }>()
  for (const t of txns.filter(isSpend)) {
    const e = map.get(t.category) ?? { category: t.category, paise: 0, count: 0 }
    e.paise += t.amountPaise
    e.count++
    map.set(t.category, e)
  }
  return [...map.values()].sort((a, b) => b.paise - a.paise)
}

export function topMerchants(txns: Transaction[], n = 5) {
  const map = new Map<string, { merchant: string; paise: number; count: number }>()
  for (const t of txns.filter(isSpend)) {
    const e = map.get(t.merchantKey) ?? { merchant: t.merchant, paise: 0, count: 0 }
    e.paise += t.amountPaise
    e.count++
    map.set(t.merchantKey, e)
  }
  return [...map.values()].sort((a, b) => b.paise - a.paise).slice(0, n)
}

/** One entry per day from `from` to `to` inclusive (YYYY-MM-DD), zero-filled. */
export function dailySpend(txns: Transaction[], from: string, to: string) {
  const per = new Map<string, number>()
  for (const t of txns.filter(isSpend)) per.set(t.date, (per.get(t.date) ?? 0) + t.amountPaise)
  const out: { date: string; paise: number }[] = []
  const d = new Date(from + 'T00:00')
  const end = new Date(to + 'T00:00')
  while (d <= end) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({ date: k, paise: per.get(k) ?? 0 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function splitByAccountKind(txns: Transaction[]) {
  const s = txns.filter(isSpend)
  return { bank: sum(s.filter((t) => t.accountKind !== 'card')), card: sum(s.filter((t) => t.accountKind === 'card')) }
}

/** Habit signals over a set of transactions (usually last 30–90 days). */
export function habits(txns: Transaction[]) {
  const s = txns.filter(isSpend)
  const days = new Set(s.map((t) => t.date))
  const weekendDays = [...days].filter((d) => [0, 6].includes(new Date(d + 'T00:00').getDay()))
  const weekdayDays = [...days].filter((d) => ![0, 6].includes(new Date(d + 'T00:00').getDay()))
  const onDays = (ds: string[]) => sum(s.filter((t) => ds.includes(t.date)))
  const late = s.filter((t) => {
    const h = new Date(t.at).getHours()
    return h >= 22 || h < 3
  })
  return {
    weekdayAvgPerDay: weekdayDays.length ? Math.round(onDays(weekdayDays) / weekdayDays.length) : 0,
    weekendAvgPerDay: weekendDays.length ? Math.round(onDays(weekendDays) / weekendDays.length) : 0,
    lateNight: { count: late.length, paise: sum(late) },
    foodDelivery: { count: s.filter((t) => t.category === 'Food Delivery').length, paise: sum(s.filter((t) => t.category === 'Food Delivery')) },
  }
}

/** Same merchant charged in ≥2 different months, amounts within ±15%, roughly monthly gaps. */
export function recurring(txns: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const t of txns.filter(isSpend)) groups.set(t.merchantKey, [...(groups.get(t.merchantKey) ?? []), t])
  const out: { merchant: string; category: string; avgPaise: number; lastDate: string; nextExpected: string }[] = []
  for (const list of groups.values()) {
    const ts = [...list].sort((a, b) => a.date.localeCompare(b.date))
    if (new Set(ts.map((t) => monthOf(t.date))).size < 2) continue
    const avg = sum(ts) / ts.length
    if (!ts.every((t) => Math.abs(t.amountPaise - avg) <= avg * 0.15)) continue
    const gaps = ts.slice(1).map((t, i) => (new Date(t.date).getTime() - new Date(ts[i].date).getTime()) / 864e5)
    if (!gaps.every((g) => g >= 25 && g <= 35)) continue
    const last = ts[ts.length - 1]
    const next = new Date(last.date + 'T00:00')
    next.setMonth(next.getMonth() + 1) // monthly billing renews on the same date
    out.push({
      merchant: last.merchant,
      category: last.category,
      avgPaise: Math.round(avg),
      lastDate: last.date,
      nextExpected: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
    })
  }
  return out.sort((a, b) => b.avgPaise - a.avgPaise)
}

/**
 * Categories whose spend this month moved ≥25% vs the average of the previous 3 months
 * (and by at least ₹500), biggest move first. Drives the "habit" callouts.
 */
export function categoryShifts(txns: Transaction[], month: string, minPaise = 50_000) {
  const cur = new Map(byCategory(inMonth(txns, month)).map((c) => [c.category, c.paise]))
  const hist = new Map<string, number>()
  for (let i = 1; i <= 3; i++) for (const c of byCategory(inMonth(txns, prevMonth(month, i)))) hist.set(c.category, (hist.get(c.category) ?? 0) + c.paise / 3)
  const cats = new Set([...cur.keys(), ...hist.keys()])
  return [...cats]
    .map((category) => {
      const now = cur.get(category) ?? 0
      const avg = Math.round(hist.get(category) ?? 0)
      return { category, now, avg, delta: now - avg, pct: avg ? Math.round(((now - avg) / avg) * 100) : null }
    })
    .filter((x) => Math.abs(x.delta) >= minPaise && (x.pct === null || Math.abs(x.pct) >= 25))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export function budgetStatus(spentByCategory: { category: string; paise: number }[], budgets: { category: string; monthlyPaise: number }[], dayOfMonth: number, daysInMonth: number) {
  return budgets.map((b) => {
    const spent = spentByCategory.find((c) => c.category === b.category)?.paise ?? 0
    const pct = b.monthlyPaise ? Math.round((spent / b.monthlyPaise) * 100) : 0
    const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100)
    return { ...b, spent, pct, status: pct >= 100 ? 'over' : pct > expectedPct + 10 ? 'ahead' : 'ok' } as const
  })
}
