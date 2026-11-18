import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/schema'
import { completeMonths, forecastIncome, forecastSpend, holtDamped, projectMonth, projectTotal, spendingExtra } from './forecast'

let n = 0
const tx = (date: string, rupees: number, category: string, merchant = category, extra: Partial<Transaction> = {}): Transaction => ({
  id: `f${n++}`, date, at: `${date}T13:00:00`, amountPaise: rupees * 100, type: 'debit',
  merchant, merchantKey: merchant.toLowerCase(), category, channel: 'upi', source: 'sms', ...extra,
})
const salary = (date: string, rupees: number) => tx(date, rupees, 'Income', 'Acme Pvt Ltd', { type: 'credit' })

describe('holtDamped', () => {
  it('a flat series forecasts flat', () => {
    const f = holtDamped([1000, 1000, 1000, 1000, 1000], 2)
    expect(f.method).toBe('holt-damped')
    expect(f.forecast.map((b) => b.value)).toEqual([1000, 1000])
  })
  it('follows a rising trend, damped, with a widening band', () => {
    const f = holtDamped([100, 200, 300, 400, 500, 600], 3)
    const v = f.forecast.map((b) => b.value)
    expect(v[0]).toBeGreaterThan(600)
    expect(v[0]).toBeLessThan(720)
    expect(v[2]).toBeGreaterThan(v[0])
    expect(v[2] - v[1]).toBeLessThanOrEqual(v[1] - v[0] + 1) // damped: steps shrink
    expect(f.forecast[2].high - f.forecast[2].low).toBeGreaterThan(f.forecast[0].high - f.forecast[0].low)
  })
  it('falls back to the mean under 3 months, and never goes negative', () => {
    expect(holtDamped([800, 1200]).method).toBe('mean')
    expect(holtDamped([800, 1200]).forecast[0].value).toBe(1000)
    expect(holtDamped([900, 500, 100], 3).forecast.every((b) => b.value >= 0 && b.low >= 0)).toBe(true)
    expect(holtDamped([]).forecast).toEqual([])
  })
})

describe('completeMonths', () => {
  it('skips a first month that starts mid-month (SMS backfill) and the current month', () => {
    const t = [tx('2026-08-19', 100, 'Other'), tx('2026-11-02', 100, 'Other')]
    expect(completeMonths(t, '2026-11')).toEqual(['2026-09', '2026-10'])
    expect(completeMonths([tx('2026-08-02', 1, 'Other')], '2026-11')).toEqual(['2026-08', '2026-09', '2026-10'])
  })
})

describe('projectMonth', () => {
  it('early in the month leans on the usual month; late on this month', () => {
    expect(projectMonth(10_000, 30_000, 3, 30).value).toBeGreaterThan(30_000) // fast start, still near usual
    expect(projectMonth(10_000, 30_000, 3, 30).value).toBeLessThan(60_000)
    expect(projectMonth(27_000, 30_000, 27, 30).value).toBeCloseTo(30_000, -3)
    expect(projectMonth(5_000, 30_000, 30, 30)).toMatchObject({ value: 5_000 })
  })
})

describe('forecastSpend and forecastIncome', () => {
  const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  const txns = months.flatMap((m, i) => [
    salary(`${m}-01`, 85000),
    tx(`${m}-02`, 18000, 'Rent', 'Landlord'),
    tx(`${m}-10`, 3000 + i * 500, 'Food Delivery', 'Swiggy'),
    ...(i === 3 ? [tx(`${m}-15`, 2000, 'Income', 'Refund Co', { type: 'credit' })] : []),
  ])
  it('spend forecast continues the trend from complete months', () => {
    const f = forecastSpend(txns, '2026-11')
    expect(f.history.map((h) => h.value / 100)).toEqual([21000, 21500, 22000, 22500, 23000])
    expect(f.months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(f.months[0].value / 100).toBeGreaterThan(23000)
    expect(f.months[0].value / 100).toBeLessThan(24000)
  })
  it('income: salary is regular, a one-off refund is not', () => {
    const f = forecastIncome(txns, '2026-11')
    expect(f.regular).toEqual([{ merchant: 'Acme Pvt Ltd', monthly: 8500000, nextDate: '2026-11-01' }])
    expect(f.otherTypical).toBe(0)
    expect(f.months[0]).toMatchObject({ month: '2026-11', value: 8500000, low: 8500000, high: 8700000 })
  })
})

describe('spendingExtra', () => {
  const hist = ['2026-07', '2026-08', '2026-09', '2026-10'].flatMap((m, i) => [
    tx(`${m}-01`, 18000, 'Rent', 'Landlord'),
    ...[3, 8, 13, 18, 23].map((d) => tx(`${m}-${String(d).padStart(2, '0')}`, 600 + i * 20, 'Food Delivery', 'Swiggy')),
    tx(`${m}-12`, 2000, 'Groceries', 'Blinkit'),
  ])
  it('flags a category running clearly above normal, with the merchants behind it', () => {
    const now = [
      tx('2026-11-01', 18000, 'Rent', 'Landlord'),
      ...[2, 4, 6, 8, 10, 12, 14].map((d) => tx(`2026-11-${String(d).padStart(2, '0')}`, 700, 'Food Delivery', 'Zomato')),
      tx('2026-11-05', 2100, 'Groceries', 'Blinkit'),
    ]
    const x = spendingExtra([...hist, ...now], '2026-11', 15)
    expect(x.map((e) => e.category)).toEqual(['Food Delivery'])
    expect(x[0].usual).toBe(315000)
    expect(x[0].projected).toBeGreaterThan(600000)
    expect(x[0].drivers[0]).toMatchObject({ merchant: 'Zomato', usual: 0 })
  })
  it('rent paid on the 1st is not "extra"; a big new category is', () => {
    const x = spendingExtra([...hist, tx('2026-11-01', 18000, 'Rent', 'Landlord'), tx('2026-11-03', 9000, 'Travel', 'IndiGo')], '2026-11', 3)
    expect(x.map((e) => [e.category, e.isNew])).toEqual([['Travel', true]])
  })
})

describe('projectTotal', () => {
  it('counts rent once instead of extrapolating it, and expects unpaid regular bills', () => {
    const hist = ['2026-08', '2026-09', '2026-10'].flatMap((m) => [
      tx(`${m}-02`, 18000, 'Rent', 'Landlord'),
      ...[5, 10, 15, 20, 25, 30].map((d) => tx(`${m}-${String(d).padStart(2, '0')}`, 500, 'Food Delivery', 'Swiggy')),
    ])
    const early = projectTotal([...hist, ...[5, 10].map((d) => tx(`2026-11-${String(d).padStart(2, '0')}`, 500, 'Food Delivery', 'Swiggy'))], '2026-11', 15)
    expect(early.soFar).toBe(100000)
    // rent still to come + food: ₹1,000 so far, then 15 days at a blend of this month's slower pace and the usual
    expect(early.value).toBe(1800000 + 225000)
    const paid = projectTotal([...hist, tx('2026-11-02', 18000, 'Rent', 'Landlord')], '2026-11', 3)
    expect(paid.value).toBeLessThan(1800000 + 300000 + 1) // rent not multiplied by pace
  })
})
