// Spending and income forecasts, and "where you're spending extra". Pure functions; amounts in paise.
// Model choices (explained in docs/MONEY.md → Forecasts):
//  - Monthly totals: Holt's linear exponential smoothing with a damped trend (parameters picked per series by
//    one-step-ahead error on a small grid). Works with 3+ months; falls back to the mean below that.
//  - This month's end: per category. One-off payments (rent, EMI) count once; everyday categories run the rest of
//    the month at a daily rate that blends this month's pace with the usual pace (later in the month, more weight
//    on this month). The total is the sum.
//  - Income: regular credits (salary-like: same payer most months, similar amount) at their median, plus the
//    median of everything else.
//  - Spending extra: this month's projected category spend vs its median month, flagged only when it is clearly
//    outside normal variation (robust z-score with MAD) and big enough to matter.
import type { Transaction } from '../db/schema'
import { inMonth, isSpend, monthOf, prevMonth } from './insights'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const daysIn = (month: string) => new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
const isIncome = (t: Transaction) => t.type === 'credit' && !t.excluded && t.category === 'Income'
const Z80 = 1.2816 // 80% prediction interval

export interface Band { value: number; low: number; high: number }
export interface HoltFit { forecast: Band[]; method: 'holt-damped' | 'mean' | 'none'; alpha?: number; beta?: number; phi?: number; rmse: number }

/**
 * Holt's damped-trend exponential smoothing, `horizon` steps ahead, with 80% bands.
 * Grid-searches alpha (level), beta (trend) and phi (damping) by one-step-ahead squared error.
 * Under 3 points: the mean, with a wide band. Forecasts never go below 0.
 */
export function holtDamped(y: number[], horizon = 3): HoltFit {
  if (!y.length) return { forecast: [], method: 'none', rmse: 0 }
  if (y.length < 3) {
    const m = sum(y) / y.length
    const sd = y.length === 2 ? Math.abs(y[1] - y[0]) / Math.SQRT2 : m * 0.25
    const sdUse = Math.max(sd, m * 0.15)
    return { forecast: band(Array(horizon).fill(m), sdUse, horizon), method: 'mean', rmse: sdUse }
  }
  let best = { sse: Infinity, alpha: 0.5, beta: 0.1, phi: 0.9, l: y[0], b: 0 }
  for (const alpha of [0.2, 0.4, 0.6, 0.8])
    for (const beta of [0.05, 0.15, 0.3])
      for (const phi of [0.8, 0.9, 0.98]) {
        let l = y[0]
        let b = y[1] - y[0]
        let sse = 0
        for (let t = 1; t < y.length; t++) {
          const f = l + phi * b
          if (t >= 2) sse += (y[t] - f) ** 2 // t = 1 is fitted by construction
          const ln = alpha * y[t] + (1 - alpha) * f
          b = beta * (ln - l) + (1 - beta) * phi * b
          l = ln
        }
        if (sse < best.sse) best = { sse, alpha, beta, phi, l, b }
      }
  const n = Math.max(1, y.length - 2)
  const rmse = Math.max(Math.sqrt(best.sse / n), (sum(y) / y.length) * 0.05)
  const points: number[] = []
  let damp = 0
  for (let h = 1; h <= horizon; h++) {
    damp += best.phi ** h
    points.push(best.l + damp * best.b)
  }
  return { forecast: band(points, rmse, horizon), method: 'holt-damped', alpha: best.alpha, beta: best.beta, phi: best.phi, rmse }
}

function band(points: number[], sd: number, horizon: number): Band[] {
  return points.slice(0, horizon).map((p, i) => {
    const w = Z80 * sd * Math.sqrt(i + 1) // uncertainty grows with the horizon
    const value = Math.max(0, Math.round(p))
    return { value, low: Math.max(0, Math.round(p - w)), high: Math.round(p + w) }
  })
}

/**
 * Complete months before `current`, oldest first. The first month with data is skipped when it starts after
 * the 5th (the 90-day SMS backfill usually starts mid-month, which would look like a cheap month).
 */
export function completeMonths(txns: Transaction[], current: string, max = 12): string[] {
  if (!txns.length) return []
  const first = txns.reduce((a, t) => (t.date < a ? t.date : a), txns[0].date)
  const start = +first.slice(8, 10) > 5 ? prevMonth(monthOf(first), -1) : monthOf(first)
  const out: string[] = []
  for (let m = prevMonth(current); m >= start && out.length < max; m = prevMonth(m)) out.unshift(m)
  return out
}

const spendIn = (txns: Transaction[], m: string, category?: string) =>
  sum(inMonth(txns, m).filter((t) => isSpend(t) && (!category || t.category === category)).map((t) => t.amountPaise))

/** Next `horizon` months of total spend, from complete months only. */
export function forecastSpend(txns: Transaction[], current: string, horizon = 3) {
  const months = completeMonths(txns, current)
  const history = months.map((m) => ({ month: m, value: spendIn(txns, m) }))
  const fit = holtDamped(history.map((h) => h.value), horizon)
  return { history, fit, months: fit.forecast.map((b, i) => ({ month: prevMonth(current, -i), ...b })) }
}

/**
 * Where this month is heading: spent so far + remaining days × a blended daily rate.
 * Early in the month the usual rate dominates; late in the month this month's own pace does.
 */
export function projectMonth(soFar: number, usualMonth: number, day: number, dim: number): Band {
  const w = day / dim
  const rate = w * (soFar / day) + (1 - w) * (usualMonth / dim)
  const value = Math.round(soFar + rate * (dim - day))
  const spread = Math.abs(soFar / day - usualMonth / dim) * (dim - day) * 0.5 + usualMonth * 0.1 * (1 - w)
  return { value, low: Math.max(soFar, Math.round(value - spread)), high: Math.round(value + spread) }
}

export interface IncomeSource { merchant: string; monthly: number; nextDate: string }

/** Regular income (salary-like) and the rest, with a forecast for the next `horizon` months. */
export function forecastIncome(txns: Transaction[], current: string, horizon = 3) {
  const months = completeMonths(txns, current).slice(-6)
  const credits = txns.filter(isIncome)
  const byPayer = new Map<string, Transaction[]>()
  for (const t of credits) byPayer.set(t.merchantKey, [...(byPayer.get(t.merchantKey) ?? []), t])

  const recent = months.slice(-3)
  const regular: IncomeSource[] = []
  const regularKeys = new Set<string>()
  for (const [key, ts] of byPayer) {
    const perMonth = recent.map((m) => sum(ts.filter((t) => monthOf(t.date) === m).map((t) => t.amountPaise))).filter((x) => x > 0)
    if (perMonth.length < Math.min(2, recent.length) || !recent.length) continue
    const med = median(perMonth)
    if (!perMonth.every((x) => Math.abs(x - med) <= med * 0.25)) continue
    const last = ts.reduce((a, t) => (t.date > a.date ? t : a))
    const next = new Date(last.date + 'T00:00')
    next.setMonth(next.getMonth() + 1)
    regular.push({ merchant: last.merchant, monthly: Math.round(med), nextDate: next.toISOString().slice(0, 10) })
    regularKeys.add(key)
  }
  const regularTotal = sum(regular.map((r) => r.monthly))
  const other = months.map((m) => sum(credits.filter((t) => monthOf(t.date) === m && !regularKeys.has(t.merchantKey)).map((t) => t.amountPaise)))
  const otherTypical = Math.round(median(other))
  const history = months.map((m) => ({ month: m, value: sum(credits.filter((t) => monthOf(t.date) === m).map((t) => t.amountPaise)) }))
  const forecast = [...Array(months.length ? horizon : 0)].map((_, i) => ({
    month: prevMonth(current, -i),
    value: regularTotal + otherTypical,
    low: regularTotal,
    high: regularTotal + Math.max(otherTypical, ...other),
  }))
  return { regular: regular.sort((a, b) => b.monthly - a.monthly), regularTotal, otherTypical, history, months: forecast }
}

export interface CategoryProjection {
  category: string
  soFar: number
  usual: number // median of past complete months
  projected: number // where this month is heading
  spread: number // rough ± for the projection
  hist: number[] // past complete months, oldest first
}

/**
 * Per-category month-end projection. Lumpy categories (≤ 2 payments in a usual month: rent, EMI, fuel fill-ups)
 * are max(spent so far, usual), so a rent paid on the 2nd isn't extrapolated across the month; everyday
 * categories use projectMonth's blended pace. Includes usual categories with nothing spent yet this month.
 */
export function projectCategories(txns: Transaction[], current: string, day: number): CategoryProjection[] {
  const months = completeMonths(txns, current).slice(-6)
  const dim = daysIn(current)
  const cur = inMonth(txns, current).filter(isSpend)
  const past = months.flatMap((m) => inMonth(txns, m).filter(isSpend))
  const cats = new Set([...cur, ...past].map((t) => t.category))
  return [...cats].map((category) => {
    const hist = months.map((m) => spendIn(txns, m, category))
    const counts = months.map((m) => inMonth(txns, m).filter((t) => isSpend(t) && t.category === category).length)
    const usual = Math.round(median(hist))
    const soFar = sum(cur.filter((t) => t.category === category).map((t) => t.amountPaise))
    const lumpy = months.length > 0 && median(counts) <= 2
    const p = lumpy ? { value: Math.max(soFar, usual), low: soFar, high: Math.max(soFar, usual) } : projectMonth(soFar, usual, day, dim)
    return { category, soFar, usual, projected: p.value, spread: (p.high - p.low) / 2, hist }
  })
}

/** This month's total spend, heading for: the sum of the category projections, with a combined band. */
export function projectTotal(txns: Transaction[], current: string, day: number): Band & { soFar: number } {
  const cats = projectCategories(txns, current, day)
  const soFar = sum(cats.map((c) => c.soFar))
  const value = sum(cats.map((c) => c.projected))
  const spread = Math.sqrt(sum(cats.map((c) => c.spread ** 2)))
  return { soFar, value, low: Math.max(soFar, Math.round(value - spread)), high: Math.round(value + spread) }
}

export interface Extra {
  category: string
  projected: number // where this month's category spend is heading
  usual: number // median of past complete months
  extra: number // projected − usual
  isNew: boolean // no spend in this category before
  drivers: { merchant: string; paise: number; usual: number }[] // merchants up the most this month
}

export function spendingExtra(txns: Transaction[], current: string, day: number, minPaise = 50_000): Extra[] {
  const months = completeMonths(txns, current).slice(-6)
  if (!months.length) return []
  const cur = inMonth(txns, current).filter(isSpend)
  const out: Extra[] = []
  for (const { category, usual, projected, hist, soFar } of projectCategories(txns, current, day)) {
    if (!soFar) continue
    const extra = projected - usual
    const isNew = hist.every((x) => x === 0)
    const sigma = 1.4826 * median(hist.map((x) => Math.abs(x - usual)))
    const unusual = months.length < 3 || extra > 1.5 * sigma
    if (!(extra >= minPaise && (isNew || extra >= usual * 0.2) && unusual)) continue
    // Merchants that moved the most: this month so far vs their average month.
    const merch = new Map<string, { merchant: string; paise: number }>()
    for (const t of cur.filter((t) => t.category === category)) {
      const e = merch.get(t.merchantKey) ?? { merchant: t.merchant, paise: 0 }
      e.paise += t.amountPaise
      merch.set(t.merchantKey, e)
    }
    const drivers = [...merch.entries()]
      .map(([key, m]) => {
        const before = sum(txns.filter((t) => isSpend(t) && t.merchantKey === key && months.includes(monthOf(t.date))).map((t) => t.amountPaise))
        return { ...m, usual: Math.round(before / months.length) }
      })
      .sort((a, b) => b.paise - b.usual - (a.paise - a.usual))
      .slice(0, 2)
    out.push({ category, projected, usual, extra, isNew, drivers })
  }
  return out.sort((a, b) => b.extra - a.extra)
}
