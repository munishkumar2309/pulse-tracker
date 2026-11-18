import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/schema'
import { categorize } from './categorize'
import { budgetStatus, byCategory, categoryShifts, dailySpend, habits, monthSummary, prevMonth, recurring, topMerchants } from './insights'

describe('categorize', () => {
  const base = { type: 'debit' as const, channel: 'upi' as const }
  it('merchant keywords', () => {
    expect(categorize({ ...base, merchantKey: 'swiggy' }).category).toBe('Food Delivery')
    expect(categorize({ ...base, merchantKey: 'blinkit payu' }).category).toBe('Groceries')
    expect(categorize({ ...base, merchantKey: 'uber india' }).category).toBe('Transport')
    expect(categorize({ ...base, merchantKey: 'indian oil' }).category).toBe('Fuel')
    expect(categorize({ ...base, merchantKey: 'netflix' }).category).toBe('Subscriptions')
  })
  it('does not match inside words ("ola" in "coca cola")', () => {
    expect(categorize({ ...base, merchantKey: 'coca cola' }).category).toBe('Other')
  })
  it('user rule wins', () => {
    expect(categorize({ ...base, merchantKey: 'swiggy' }, new Map([['swiggy', 'Groceries']])).category).toBe('Groceries')
  })
  it('card bill payments and CRED are excluded transfers', () => {
    expect(categorize({ type: 'credit', channel: 'other', merchantKey: 'unknown', isCardBillPayment: true })).toEqual({ category: 'Transfers', excluded: true })
    expect(categorize({ ...base, merchantKey: 'cred club' })).toEqual({ category: 'Transfers', excluded: true })
  })
  it('ATM → Cash; credits → Income', () => {
    expect(categorize({ type: 'debit', channel: 'atm', merchantKey: 'atm withdrawal' }).category).toBe('Cash')
    expect(categorize({ type: 'credit', channel: 'neft_imps', merchantKey: 'acme corp' }).category).toBe('Income')
  })
})

let n = 0
const tx = (date: string, rupees: number, category: string, merchant = category, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, at: `${date}T13:00:00`, amountPaise: rupees * 100, type: 'debit',
  merchant, merchantKey: merchant.toLowerCase(), category, channel: 'upi', source: 'sms', ...extra,
})

describe('insights', () => {
  const txns = [
    tx('2026-11-01', 500, 'Food Delivery', 'Swiggy'),
    tx('2026-11-02', 300, 'Food Delivery', 'Zomato'),
    tx('2026-11-02', 2000, 'Groceries', 'BigBasket'),
    tx('2026-11-03', 15000, 'Transfers', 'CRED', { excluded: true }),
    tx('2026-11-04', 85000, 'Income', 'Acme', { type: 'credit' }),
    tx('2026-10-05', 1000, 'Food Delivery', 'Swiggy'),
  ]
  it('month summary excludes transfers and compares with last month', () => {
    expect(monthSummary(txns, '2026-11')).toEqual({ spend: 280000, income: 8500000, prevSpend: 100000, changePct: 180 })
  })
  it('by category, sorted', () => {
    expect(byCategory(txns.filter((t) => t.date >= '2026-11')).map((c) => [c.category, c.paise])).toEqual([['Groceries', 200000], ['Food Delivery', 80000]])
  })
  it('top merchants', () => {
    expect(topMerchants(txns, 2).map((m) => m.merchant)).toEqual(['BigBasket', 'Swiggy'])
  })
  it('daily spend is zero-filled', () => {
    expect(dailySpend(txns, '2026-11-01', '2026-11-04').map((d) => d.paise)).toEqual([50000, 230000, 0, 0])
  })
  it('prevMonth crosses years', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
    expect(prevMonth('2026-03', 3)).toBe('2025-12')
  })
  it('habits: weekend vs weekday, late night', () => {
    // 2026-11-01 is a Sunday
    const h = habits([tx('2026-11-01', 1000, 'Shopping'), tx('2026-11-02', 200, 'Shopping'), tx('2026-11-03', 400, 'Food Delivery', 'Swiggy', { at: '2026-11-03T23:30:00' })])
    expect(h.weekendAvgPerDay).toBe(100000)
    expect(h.weekdayAvgPerDay).toBe(30000)
    expect(h.lateNight).toEqual({ count: 1, paise: 40000 })
    expect(h.foodDelivery.count).toBe(1)
  })
  it('recurring detects monthly subscriptions only', () => {
    const r = recurring([
      tx('2026-09-05', 649, 'Subscriptions', 'Netflix'), tx('2026-10-05', 649, 'Subscriptions', 'Netflix'), tx('2026-11-05', 649, 'Subscriptions', 'Netflix'),
      tx('2026-10-01', 300, 'Food Delivery', 'Swiggy'), tx('2026-10-03', 900, 'Food Delivery', 'Swiggy'),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ merchant: 'Netflix', avgPaise: 64900, nextExpected: '2026-12-05' })
  })
  it('category shifts vs 3-month average', () => {
    const s = categoryShifts([
      tx('2026-08-10', 1000, 'Food Delivery'), tx('2026-09-10', 1000, 'Food Delivery'), tx('2026-10-10', 1000, 'Food Delivery'),
      tx('2026-11-10', 2500, 'Food Delivery'), tx('2026-11-11', 100, 'Groceries'),
    ], '2026-11')
    expect(s).toEqual([{ category: 'Food Delivery', now: 250000, avg: 100000, delta: 150000, pct: 150 }])
  })
  it('budget status', () => {
    const b = budgetStatus([{ category: 'Food Delivery', paise: 300000 }], [{ category: 'Food Delivery', monthlyPaise: 400000 }, { category: 'Shopping', monthlyPaise: 500000 }], 10, 30)
    expect(b.map((x) => [x.category, x.pct, x.status])).toEqual([['Food Delivery', 75, 'ahead'], ['Shopping', 0, 'ok']])
  })
})
