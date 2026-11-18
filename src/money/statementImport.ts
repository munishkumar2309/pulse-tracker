// Bank statement rows (from CSV / XLSX / PDF text) → transactions. Pure functions; file reading is in statementFiles.ts.
import type { Channel, TxnType } from '../db/schema'
import { dayKey } from '../lib/format'
import { normaliseMerchant } from './smsParser'

export interface ColumnMap {
  headerRow: number
  date: number
  narration: number
  debit?: number
  credit?: number
  amount?: number // single signed/flagged amount column
  drcr?: number // "Dr"/"Cr" flag column used with `amount`
  ref?: number
}

export interface StatementTxn {
  date: string
  amountPaise: number
  type: TxnType
  narration: string
  merchant: string
  merchantKey: string
  channel: Channel
  ref?: string
}

const H = {
  date: /^(txn |transaction |value |tran )?date$|^date$/i,
  narration: /narration|description|particulars|remarks|details|transaction details/i,
  debit: /withdrawal|debit|dr\.?\s*amount|^dr$|amount\s*\(dr\)/i,
  credit: /deposit|credit|cr\.?\s*amount|^cr$|amount\s*\(cr\)/i,
  amount: /^(txn |transaction )?amount( \(inr\)| \(rs\.?\))?$/i,
  drcr: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|debit\/credit)$/i,
  ref: /ref|chq|cheque|utr/i,
}

/** Find the header row (within the first 40 rows) and which column holds what. */
export function detectColumns(rows: string[][]): ColumnMap | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const cells = rows[r].map((c) => String(c ?? '').trim())
    const find = (re: RegExp, exclude: number[] = []) => cells.findIndex((c, i) => !exclude.includes(i) && re.test(c))
    const date = find(H.date)
    const narration = find(H.narration)
    if (date < 0 || narration < 0) continue
    const debit = find(H.debit, [date, narration])
    const credit = find(H.credit, [date, narration, debit])
    const amount = find(H.amount, [date, narration])
    const drcr = find(H.drcr, [date, narration])
    const ref = find(H.ref, [date, narration, debit, credit])
    if (debit >= 0 && credit >= 0) return { headerRow: r, date, narration, debit, credit, ref: ref >= 0 ? ref : undefined }
    if (amount >= 0) return { headerRow: r, date, narration, amount, drcr: drcr >= 0 ? drcr : undefined, ref: ref >= 0 ? ref : undefined }
  }
  return null
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** Statement dates: dd/mm/yy(yy), dd-mm-yyyy, dd-Mon-yy(yy), dd Mon yyyy, yyyy-mm-dd, Excel serial. Day-first (Indian banks). */
export function parseStatementDate(v: string | number): string | null {
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v))) {
    const serial = Math.floor(Number(v))
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 864e5)
    return dayKey(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const s = String(v).trim()
  const mk = (y: number, m: number, d: number) => {
    const year = y < 100 ? 2000 + y : y
    if (m < 0 || m > 11 || d < 1 || d > 31) return null
    return dayKey(new Date(year, m, d))
  }
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return mk(+m[1], +m[2] - 1, +m[3])
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) return mk(+m[3], +m[2] - 1, +m[1])
  if ((m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s,-]+(\d{2,4})/)) && MONTHS[m[2].toLowerCase()] !== undefined) return mk(+m[3], MONTHS[m[2].toLowerCase()], +m[1])
  return null
}

/** "1,23,456.78", "₹ 500", "500.00 Dr", "(500.00)" → rupees (number, sign kept for parentheses/minus). */
export function parseAmount(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = v.replace(/[₹,\s]|inr|rs\.?/gi, '').replace(/(dr|cr)$/i, '')
  if (!s || s === '-') return null
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-')
  const n = parseFloat(s.replace(/[()-]/g, ''))
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

// Tokens that are never the merchant: rails, directions, IFSC codes, masked card/account numbers, refs.
const SKIP_TOKEN = /^(upi|dr|cr|p2m|p2a|pos|ecom|neft|imps|rtgs|ach|nach|mb|ib|inb|ft|trf|transfer|to|from|by|payment|via|sent|received|collect|request|ref|no|txn|bil|bill|onl|[a-z]{4}0[a-z0-9]{6}|(?=[\dx*]*\d)[\dx*]+|\d+[a-z]*|[a-z]{1,2})$/i

// ATM: "ATM WDL", HDFC "ATW-…", "NWD-…" (non-home ATM), "CASH WDL".
const ATM_RE = /\batm\b|\batw\b|\bnwd\b|atm wdl|cash wdl/i

/** Pull a merchant out of a statement narration (UPI-SWIGGY-..., UPI/123/DR/SWIGGY/..., POS 1234XX AMAZON ...). */
export function merchantFromNarration(n: string): string {
  const s = n.trim()
  if (ATM_RE.test(s)) return 'ATM Withdrawal'
  const tokens = s.split(/[/\-|:*]+|\s{2,}/).map((t) => t.trim()).filter(Boolean)
  for (const t of tokens) {
    if (t.includes('@')) continue
    const words = t.split(/\s+/).filter((w) => !SKIP_TOKEN.test(w))
    const name = words.join(' ').replace(/[^A-Za-z0-9 &.']/g, '').trim()
    if (/[A-Za-z]{3,}/.test(name)) return name.replace(/\b\w+/g, (w) => (w === w.toUpperCase() && /[AEIOU]/.test(w) && w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w))
  }
  const vpa = tokens.find((t) => t.includes('@'))
  return vpa ? vpa.split('@')[0].replace(/[._]+/g, ' ') : s.slice(0, 40)
}

function channelOf(n: string): Channel {
  if (/\bupi\b/i.test(n)) return 'upi'
  if (ATM_RE.test(n)) return 'atm'
  if (/\b(neft|imps|rtgs)\b/i.test(n)) return 'neft_imps'
  if (/\bpos\b|card|ecom/i.test(n)) return 'card'
  if (/\b(inb|ib|net ?banking|billpay|bil\/)/i.test(n)) return 'netbanking'
  return 'other'
}

/** Rows + mapping → transactions. Rows that aren't transactions (opening balance, totals, blank) are skipped. */
export function rowsToTxns(rows: string[][], map: ColumnMap): StatementTxn[] {
  const out: StatementTxn[] = []
  for (const row of rows.slice(map.headerRow + 1)) {
    const date = parseStatementDate(row[map.date] ?? '')
    if (!date) continue
    const narration = String(row[map.narration] ?? '').replace(/\s+/g, ' ').trim()
    if (!narration || /opening balance|closing balance|^total/i.test(narration)) continue
    let type: TxnType | null = null
    let amount: number | null = null
    if (map.debit !== undefined && map.credit !== undefined) {
      const dr = parseAmount(row[map.debit])
      const cr = parseAmount(row[map.credit])
      if (dr && Math.abs(dr) > 0) { type = 'debit'; amount = Math.abs(dr) }
      else if (cr && Math.abs(cr) > 0) { type = 'credit'; amount = Math.abs(cr) }
    } else if (map.amount !== undefined) {
      const raw = String(row[map.amount] ?? '')
      const a = parseAmount(raw)
      if (a !== null && a !== 0) {
        amount = Math.abs(a)
        const flag = map.drcr !== undefined ? String(row[map.drcr] ?? '') : raw
        type = /cr/i.test(flag) ? 'credit' : /dr/i.test(flag) ? 'debit' : a < 0 ? 'debit' : 'credit'
      }
    }
    if (!type || !amount) continue
    const merchant = merchantFromNarration(narration)
    const refCell = map.ref !== undefined ? String(row[map.ref] ?? '').trim() : ''
    const ref = narration.match(/\b(\d{12})\b/)?.[1] ?? (/\d{6,}/.test(refCell) && !/^0+$/.test(refCell) ? refCell : undefined)
    out.push({ date, amountPaise: Math.round(amount * 100), type, narration, merchant, merchantKey: normaliseMerchant(merchant) || 'unknown', channel: channelOf(narration), ref })
  }
  return out
}
