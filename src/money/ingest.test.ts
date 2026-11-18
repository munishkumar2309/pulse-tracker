import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { ingestSms, ingestStatement, setCategory } from './ingest'
import type { StatementTxn } from './statementImport'

const row = (date: string, rupees: number, merchant: string, ref?: string): StatementTxn => ({
  date, amountPaise: rupees * 100, type: 'debit', narration: `UPI-${merchant.toUpperCase()}`, merchant, merchantKey: merchant.toLowerCase(), channel: 'upi', ref,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('ingestSms', () => {
  it('adds, categorises, and skips duplicates and OTPs', async () => {
    const sms = 'Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112340001'
    const r1 = await ingestSms([{ body: sms }, { body: '123456 is your OTP. Do not share.' }])
    expect(r1.added).toHaveLength(1)
    expect(r1.added[0].category).toBe('Food Delivery')
    expect(r1.skipped).toHaveLength(1)
    const r2 = await ingestSms([{ body: sms }])
    expect(r2).toMatchObject({ duplicates: 1, added: [] })
  })
})

describe('ingestStatement', () => {
  it('skips rows already captured from SMS (same ref, or same amount ±1 day)', async () => {
    await ingestSms([{ body: 'Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112340001' }])
    await ingestSms([{ body: 'Rs.2,899.00 spent on HDFC Bank Card x9876 at AMAZON on 2026-11-16.' }])
    const r = await ingestStatement([
      row('2026-11-18', 450, 'Swiggy', '432112340001'), // same UPI ref
      row('2026-11-17', 2899, 'Amazon Pay'), // posted a day later, no ref
      row('2026-11-15', 180, 'Uber'),
    ])
    expect(r).toEqual({ added: 1, duplicates: 2 })
  })
  it('keeps two identical purchases on the same day', async () => {
    const r = await ingestStatement([row('2026-11-10', 20, 'Chai Point'), row('2026-11-10', 20, 'Chai Point')])
    expect(r.added).toBe(2)
    const again = await ingestStatement([row('2026-11-10', 20, 'Chai Point'), row('2026-11-10', 20, 'Chai Point')])
    expect(again).toEqual({ added: 0, duplicates: 2 })
  })
})

describe('setCategory', () => {
  it('"always" saves a rule and re-tags past payments to that merchant', async () => {
    const r = await ingestStatement([row('2026-11-01', 300, 'Ramu Kirana Store'), row('2026-11-05', 200, 'Ramu Kirana Store')])
    expect(r.added).toBe(2)
    const [first] = await db.transactions.toArray()
    await setCategory(first.id, 'Groceries', true)
    expect((await db.transactions.toArray()).map((t) => t.category)).toEqual(['Groceries', 'Groceries'])
    expect(await db.rules.get('ramu kirana store')).toEqual({ merchantKey: 'ramu kirana store', category: 'Groceries' })
  })
})
