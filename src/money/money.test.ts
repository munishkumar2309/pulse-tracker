import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/schema'
import { categorize, recategorizeOther } from './categorize'
import { isParsed, parseSms } from './smsParser'
import { budgetStatus, byCategory, categoryShifts, compareMonths, dailySpend, habits, monthlyHistory, monthSummary, prevMonth, recurring, topMerchants } from './insights'

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
    expect(monthSummary(txns, '2026-11')).toEqual({ spend: 280000, income: 8500000, invested: 0, prevSpend: 100000, prevSameSpend: 100000, changePct: 180, likeForLike: false })
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

describe('categorize: investments (FD, stocks, mutual funds, gold)', () => {
  // Illustrative SMS shapes, not real messages; add the user's own to REAL_SAMPLES in smsParser.test.ts.
  const cat = (body: string) => {
    const p = parseSms(body, new Date(2026, 10, 18, 10, 0))
    if (!isParsed(p)) throw new Error(`rejected (${p.rejected}): ${body}`)
    return categorize({ merchantKey: p.merchantKey, raw: p.raw, type: p.type, channel: p.channel, isCardBillPayment: p.isCardBillPayment }).category
  }
  it('SIPs by NACH/ACH/ECS go to Investments, not EMI', () => {
    expect(cat('Rs.5,000.00 debited from A/c XX1234 on 05-11-26 towards NACH-DR- HDFC MUTUAL FUND. Avl Bal Rs 20,000.00')).toBe('Investments')
    expect(cat('Your A/c XX1234 is debited for Rs.10,000.00 on 05-Nov-26 by ACH-DR ICCL. Avl Bal Rs 9,000.00')).toBe('Investments')
    expect(cat('Rs 2500 debited from A/c XX1234 on 10-11-26 via ECS to BSE STAR MF. -Axis')).toBe('Investments')
  })
  it('fixed and recurring deposits', () => {
    expect(cat('Rs.1,00,000.00 transferred from A/c XX1234 to FD A/c XX5678 on 18-11-26. -SBI')).toBe('Investments')
    expect(cat('Rs 3000.00 debited from A/c XX1234 on 18-11-26 towards Recurring Deposit instalment. -ICICI')).toBe('Investments')
  })
  it('stocks and brokers', () => {
    expect(cat('Sent Rs.25,000.00 From HDFC Bank A/C *1234 To zerodha.broking@hdfcbank On 18/11/26 Ref 432112340001')).toBe('Investments')
    expect(cat('Rs 15000 debited from A/c XX1234 on 18-11-26 to INDIAN CLEARING CORP. -Kotak')).toBe('Investments')
  })
  it('gold', () => {
    expect(cat('Sent Rs.2,000.00 From HDFC Bank A/C *1234 To SAFEGOLD On 18/11/26 Ref 432112340002')).toBe('Investments')
    const base = { type: 'debit' as const, channel: 'card' as const }
    expect(categorize({ ...base, merchantKey: 'tanishq' }).category).toBe('Investments')
    expect(categorize({ ...base, merchantKey: 'sovereign gold bond' }).category).toBe('Investments')
  })
  it('a lender FD is an investment; the same lender EMI stays a loan', () => {
    const base = { type: 'debit' as const, channel: 'neft_imps' as const }
    expect(categorize({ ...base, merchantKey: 'bajaj finance fd' }).category).toBe('Investments')
    expect(categorize({ ...base, merchantKey: 'bajaj finance' }).category).toBe('EMI & Loans')
    expect(categorize({ ...base, merchantKey: 'unknown', raw: 'Rs 12000 debited from A/c XX1234 towards NACH HOME LOAN EMI' }).category).toBe('EMI & Loans')
  })
  it('does not misfire', () => {
    const base = { type: 'debit' as const, channel: 'card' as const }
    expect(categorize({ ...base, merchantKey: 'unknown', raw: 'Rs 500 debited from A/c XX1234 for debit card AMC charges' }).category).not.toBe('Investments')
    expect(categorize({ ...base, merchantKey: 'golds gym' }).category).not.toBe('Investments')
    expect(categorize({ type: 'credit', channel: 'neft_imps', merchantKey: 'infosys dividend' }).category).toBe('Income')
  })
})

describe('month-wise comparison', () => {
  const txns = [
    tx('2026-10-03', 1000, 'Food Delivery', 'Swiggy'),
    tx('2026-10-20', 4000, 'Shopping', 'Amazon'),
    tx('2026-10-05', 5000, 'Investments', 'Groww'),
    tx('2026-11-02', 1500, 'Food Delivery', 'Swiggy'),
    tx('2026-11-04', 600, 'Groceries', 'Blinkit'),
    tx('2026-11-05', 10000, 'Investments', 'Zerodha'),
  ]
  it('investments are tracked apart from spend', () => {
    const s = monthSummary(txns, '2026-11')
    expect(s.spend).toBe(210000)
    expect(s.invested).toBe(1000000)
    expect(byCategory(txns).map((c) => c.category)).not.toContain('Investments')
  })
  it('an in-progress month compares like-for-like (same days of last month)', () => {
    const s = monthSummary(txns, '2026-11', 10)
    expect(s.prevSpend).toBe(500000) // October in full
    expect(s.prevSameSpend).toBe(100000) // October 1–10 only
    expect(s.changePct).toBe(110)
    expect(s.likeForLike).toBe(true)
  })
  it('category comparison, biggest change first; new categories have null pct', () => {
    expect(compareMonths(txns, '2026-11')).toEqual([
      { category: 'Shopping', now: 0, prev: 400000, delta: -400000, pct: -100 },
      { category: 'Groceries', now: 60000, prev: 0, delta: 60000, pct: null },
      { category: 'Food Delivery', now: 150000, prev: 100000, delta: 50000, pct: 50 },
    ])
    expect(compareMonths(txns, '2026-11', 10).map((r) => r.category)).toEqual(['Groceries', 'Food Delivery'])
  })
  it('monthly history: oldest first, with the top category', () => {
    expect(monthlyHistory(txns, '2026-11', 3)).toEqual([
      { month: '2026-09', spend: 0, invested: 0, topCategory: null, topPaise: 0 },
      { month: '2026-10', spend: 500000, invested: 500000, topCategory: 'Shopping', topPaise: 400000 },
      { month: '2026-11', spend: 210000, invested: 1000000, topCategory: 'Food Delivery', topPaise: 150000 },
    ])
  })
})

describe('auto-categorise', () => {
  const base = { type: 'debit' as const, channel: 'upi' as const }
  it('new keywords', () => {
    expect(categorize({ ...base, merchantKey: 'sharma medical' }).category).toBe('Health')
    expect(categorize({ ...base, merchantKey: 'lenskart' }).category).toBe('Shopping')
    expect(categorize({ ...base, merchantKey: 'gupta milk dairy' }).category).toBe('Groceries')
    expect(categorize({ ...base, merchantKey: 'nhai toll plaza' }).category).toBe('Transport')
    expect(categorize({ ...base, merchantKey: 'policybazaar' }).category).toBe('Bills & Utilities')
    expect(categorize({ ...base, merchantKey: 'smartbuy' }).category).toBe('Other') // "mart" only as a whole word
  })
  it('re-checks "Other" rows but never hand-picked ones', () => {
    const rows = [
      { id: 'a', merchantKey: 'lenskart', type: 'debit' as const, channel: 'upi' as const, category: 'Other' },
      { id: 'b', merchantKey: 'lenskart', type: 'debit' as const, channel: 'upi' as const, category: 'Other', userSet: true },
      { id: 'c', merchantKey: 'ramesh kumar', type: 'debit' as const, channel: 'upi' as const, category: 'Other' },
      { id: 'd', merchantKey: 'ramesh kumar', type: 'debit' as const, channel: 'upi' as const, category: 'Other' },
    ]
    expect(recategorizeOther(rows)).toEqual([{ id: 'a', category: 'Shopping', excluded: false }])
    expect(recategorizeOther(rows, new Map([['ramesh kumar', 'Rent']])).map((c) => c.id)).toEqual(['a', 'c', 'd'])
  })
})
