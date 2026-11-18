// SMS / manual transactions → DB. The only module that writes transactions.
import { db, type Transaction } from '../db/schema'
import { categorize } from './categorize'
import { dayKey } from '../lib/format'
import { isParsed, parseSms, txnId, type SmsRejectReason } from './smsParser'
import type { StatementTxn } from './statementImport'

export interface IngestResult {
  added: Transaction[]
  duplicates: number
  skipped: { body: string; reason: SmsRejectReason }[]
}

/** Split pasted text into separate SMS: blank lines separate messages. */
export function splitPasted(text: string): string[] {
  return text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
}

async function loadRules() {
  return new Map((await db.rules.toArray()).map((r) => [r.merchantKey, r.category]))
}

export async function ingestSms(items: { body: string; at?: Date; sender?: string }[]): Promise<IngestResult> {
  const rules = await loadRules()
  const res: IngestResult = { added: [], duplicates: 0, skipped: [] }
  const fresh: Transaction[] = []
  for (const it of items) {
    const p = parseSms(it.body, it.at ?? new Date(), it.sender)
    if (!isParsed(p)) {
      res.skipped.push({ body: it.body, reason: p.rejected })
      continue
    }
    const { category, excluded } = categorize(p, rules)
    const t: Transaction = {
      id: txnId(p), date: p.date, at: p.at, amountPaise: p.amountPaise, type: p.type,
      account: p.account, accountKind: p.accountKind, bank: p.bank, merchant: p.merchant, merchantKey: p.merchantKey,
      category, excluded, channel: p.channel, ref: p.ref, source: 'sms', raw: p.raw,
    }
    if (fresh.some((f) => f.id === t.id) || (await db.transactions.get(t.id))) res.duplicates++
    else fresh.push(t)
  }
  await db.transactions.bulkAdd(fresh)
  res.added = fresh
  return res
}

/**
 * Save statement rows. Duplicates of SMS rows are skipped: same UPI/bank ref (same txnId),
 * or same amount + type on the same or adjacent day (statements post a day late sometimes).
 */
export async function ingestStatement(rows: StatementTxn[], account?: string): Promise<{ added: number; duplicates: number }> {
  const rules = await loadRules()
  const fresh: Transaction[] = []
  const claimed = new Set<string>() // existing rows already matched to a statement row
  const seen = new Map<string, number>() // identical rows within this statement (two ₹20 chais on one day)
  let duplicates = 0
  for (const r of rows) {
    const base = txnId({ ref: r.ref, amountPaise: r.amountPaise, type: r.type, account, date: r.date, merchantKey: r.merchantKey })
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const id = r.ref || n === 0 ? base : `${base}_${n}`
    if (await db.transactions.get(id)) { duplicates++; continue }
    // Same amount + type within ±1 day, not already matched → it's the SMS copy of this row.
    const d = new Date(r.date + 'T00:00')
    const near = [-1, 0, 1].map((o) => { const x = new Date(d); x.setDate(x.getDate() + o); return dayKey(x) })
    const match = await db.transactions.where('date').anyOf(near).filter((t) => t.amountPaise === r.amountPaise && t.type === r.type && !claimed.has(t.id)).first()
    if (match) { claimed.add(match.id); duplicates++; continue }
    if (fresh.some((f) => f.id === id)) { duplicates++; continue }
    const { category, excluded } = categorize({ merchantKey: r.merchantKey, raw: r.narration, type: r.type, channel: r.channel }, rules)
    fresh.push({
      id, date: r.date, at: new Date(r.date + 'T12:00').toISOString(), amountPaise: r.amountPaise, type: r.type,
      account, accountKind: 'bank', merchant: r.merchant, merchantKey: r.merchantKey, category, excluded,
      channel: r.channel, ref: r.ref, source: 'statement', raw: r.narration,
    })
  }
  await db.transactions.bulkAdd(fresh)
  return { added: fresh.length, duplicates }
}

export async function addManualTxn(t: Omit<Transaction, 'id' | 'source' | 'merchantKey' | 'excluded' | 'category'> & { category?: string }) {
  const rules = await loadRules()
  const merchantKey = t.merchant.toLowerCase().replace(/[^a-z& ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'manual'
  const auto = categorize({ merchantKey, type: t.type, channel: t.channel }, rules)
  const category = t.category ?? auto.category
  const row: Transaction = { ...t, id: `m_${Date.now().toString(36)}`, source: 'manual', merchantKey, category, excluded: category === 'Transfers' }
  await db.transactions.add(row)
  return row
}

/** Change a transaction's category; with `always`, remember it for this merchant and re-tag past ones. */
export async function setCategory(id: string, category: string, always: boolean) {
  const t = await db.transactions.get(id)
  if (!t) return
  const excluded = category === 'Transfers'
  await db.transaction('rw', db.transactions, db.rules, async () => {
    await db.transactions.update(id, { category, excluded })
    if (always) {
      await db.rules.put({ merchantKey: t.merchantKey, category })
      await db.transactions.where('merchantKey').equals(t.merchantKey).modify({ category, excluded })
    }
  })
}
