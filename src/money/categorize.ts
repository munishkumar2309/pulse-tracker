// Assign a spend category. Order: user rule → card bill / ATM → merchant keywords → raw-text keywords → default.
import { CATEGORIES, EXCLUDED_CATEGORIES } from '../data/categories'
import type { Channel, TxnType } from '../db/schema'

export interface CategorizeInput {
  merchantKey: string
  raw?: string
  type: TxnType
  channel: Channel
  isCardBillPayment?: boolean
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// matchFirst categories (Investments) are tried first; the rest keep list order.
const MATCHERS = [...CATEGORIES].sort((a, b) => Number(!!b.matchFirst) - Number(!!a.matchFirst)).filter((c) => c.keywords.length).map((c) => ({
  name: c.name,
  income: !!c.income,
  excluded: !!c.excluded,
  re: new RegExp(`(?:^|[^a-z])(?:${c.keywords.map((k) => escape(k.trim().toLowerCase())).join('|')})(?:[^a-z]|$)`),
}))

function match(text: string, type: TxnType): string | undefined {
  const t = text.toLowerCase()
  for (const m of MATCHERS) {
    if (m.income && type === 'debit') continue // "refund"/"interest" words never make a debit income
    if (m.re.test(t)) return m.name
  }
}

export function categorize(t: CategorizeInput, rules: Map<string, string> = new Map()): { category: string; excluded: boolean } {
  const pick = (category: string) => ({ category, excluded: EXCLUDED_CATEGORIES.has(category) })

  const rule = rules.get(t.merchantKey)
  if (rule) return pick(rule)
  if (t.isCardBillPayment) return pick('Transfers')
  if (t.type === 'credit') {
    const m = match(t.merchantKey, 'credit') ?? match(t.raw ?? '', 'credit')
    return pick(m === 'Transfers' ? 'Transfers' : 'Income')
  }
  if (t.channel === 'atm') return pick('Cash')
  return pick(match(t.merchantKey, 'debit') ?? match(t.raw ?? '', 'debit') ?? 'Other')
}
