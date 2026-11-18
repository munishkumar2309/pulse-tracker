// Bank / credit card SMS → structured transaction. See docs/MONEY.md for supported formats.
// Pure function: no DB access. Categorisation happens later in categorize.ts.
import type { Channel, TxnType } from '../db/schema'
import { dayKey } from '../lib/format'

export interface ParsedSms {
  amountPaise: number
  type: TxnType
  account?: string
  accountKind: 'bank' | 'card'
  bank?: string
  merchant: string
  merchantKey: string
  channel: Channel
  ref?: string
  date: string
  at: string
  isCardBillPayment: boolean
  raw: string
}

export type SmsRejectReason = 'otp' | 'not_transaction' | 'future_or_reminder' | 'failed' | 'no_amount'

const BANKS: [RegExp, string][] = [
  [/hdfc/i, 'HDFC'], [/icici/i, 'ICICI'], [/\bsbi\b|state bank|sbicard|sbiinb|sbiupi/i, 'SBI'],
  [/axis/i, 'Axis'], [/kotak|kotakb/i, 'Kotak'], [/yes ?bank|yesbnk/i, 'Yes'], [/idfc/i, 'IDFC First'],
  [/indusind|indusb/i, 'IndusInd'], [/\bpnb\b|punjab national/i, 'PNB'], [/bank of baroda|\bbob\b|bobtxn/i, 'BoB'],
  [/canara/i, 'Canara'], [/union bank|unionb/i, 'Union'], [/\bau bank|au small|aubank/i, 'AU'],
  [/federal/i, 'Federal'], [/\brbl\b/i, 'RBL'], [/onecard/i, 'OneCard'], [/amex|american express/i, 'Amex'],
  [/paytm payments|paytmb/i, 'Paytm'], [/airtel payments/i, 'Airtel PB'],
]

const OTP = /\b(otp|one[\s-]?time password|verification code|passcode)\b/i
const REMINDER = /\b(will be debited|is due|due on|due date|due by|minimum amount due|total amount due|statement (?:is )?generated|has requested|requested (?:money|rs|inr)|collect request|auto[- ]?pay(?:ment)? (?:is )?scheduled|mandate (?:created|registered))\b/i
const PROMO = /\b(pre-?approved|apply now|t&c apply|limited period|eligible for|offer (?:valid|ends)|get (?:upto|up to|flat))\b/i
// Fund-house / broker confirmations (CAMS, KFin, Zerodha…) repeat money the bank SMS already recorded.
// Rejected only when they carry no a/c or card number, so a bank's "debited from A/c XX1234 for SIP" still parses.
const INVEST_CONFIRMATION = /\b(folio|nav|units? (?:allotted|allocated|credited)|contract note|trade confirmation|order (?:executed|placed))\b/i
const FAILED = /\b(declined|failed|unsuccessful|could not be processed|insufficient)\b/i
const DEBIT = /\b(debited|spent|paid|withdrawn|withdrawal|sent|purchase|purchased|transferred|deducted|dr\.?)\b/i
const CREDIT = /\b(credited|received|deposited|refund(?:ed)?|reversed|cr\.?)\b/i
const AMOUNT = /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi
const AMOUNT_AFTER_VERB = /\b(?:debited|credited)\s+(?:by|with|for)\s+(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i
const BALANCE_PREFIX = /(bal|balance|limit|lmt|avl|available|outstanding|o\/s)[\s.:a-z]*$/i
const CARD_BILL = /(payment (?:of|for).{0,40}(?:received|credited).{0,40}card|towards (?:your )?(?:credit )?card|credit card (?:bill )?payment|card payment received|payment received.{0,30}credit card)/i

const ACCOUNT = /(?:a\/c|\bac\b|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s*with)?|xx))?\s*[:-]?\s*[xX*]*(\d{3,4})\b/i
const REF = /\b(?:ref(?:erence)?(?:\s*no)?|refno|upi(?:\s*ref)?|txn(?:\s*id)?|rrn|utr)[\s:.#-]*([A-Za-z]*\d[A-Za-z0-9]{5,})/i

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Merchant extraction. Group 1 is the merchant; END marks where a merchant name stops.
const END = String.raw`(?=\s+(?:on|via|using|ref|refno|txn|avl|upi|not you|info|from|by)\b|\s*\.(?:\s|$)|\s*$|\s*[,;(])`
const NAME = String.raw`([A-Za-z0-9 .&'*_@/-]+?)`
const rx = (src: string) => new RegExp(src, 'i')
const COMMON: RegExp[] = [
  /;\s*([A-Za-z0-9 .&'_-]+?)\s+credited\b/i, // ICICI: "debited for Rs X on DATE; SWIGGY credited"
  rx(String.raw`\btrf to\s+` + NAME + END), // SBI UPI
  rx(String.raw`\bat\s+` + NAME + END), // card spends
  /\bon\s+([A-Z][A-Za-z0-9 .&'*_-]+?)\.\s*avl/i, // ICICI CC: "on 18-Nov-26 on AMAZON. Avl Limit"
  /\d{2}:\d{2}(?::\d{2})?\s*(?:ist)?\s+([A-Za-z0-9 .&'*_-]+?)\s+avl/i, // Axis CC: "10:22:11 IST AMAZON Avl Limit"
]
const TO = rx(String.raw`\bto\s+(?:vpa\s+)?` + NAME + END)
const FROM = rx(String.raw`\b(?:from|by)\s+(?:vpa\s+)?` + NAME + END)
const INFO = /\binfo[:\s-]+([^.]+)/i
/** Debits name the payee after "to"; credits name the payer after "from"/"by". */
const merchantPatterns = (type: TxnType) => [...COMMON, ...(type === 'debit' ? [TO, FROM] : [FROM, TO]), INFO]

const NOT_MERCHANT = /^(?:(?:your|you|my|the|a\/c|ac|acct|account|card|beneficiary)\b|(?:neft|imps|rtgs|upi|[a-z]+ bank|[a-z]+ bank (?:a\/c|ac|card).*|[x*]+\d+|\d+)$)/i

export function normaliseMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/@.*$/, '') // VPA → handle
    .replace(/\b(pvt|private|ltd|limited|llp|india|technologies|tech|retail|services|payments?|online|www|com|in)\b/g, ' ')
    .replace(/[^a-z& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanMerchant(m: string): string {
  let s = m.trim().replace(/\s+/g, ' ')
  // UPI info strings: UPI/P2M/123456789/SWIGGY LIMITED/...
  if (/\//.test(s)) {
    const parts = s.split('/').map((p) => p.trim()).filter((p) => p && !/^\d+$/.test(p) && !/^(upi|p2m|p2a|imps|neft|pos|ecom|dr|cr)$/i.test(p))
    if (parts.length) s = parts[0]
  }
  // VPA: swiggy.order@icici → swiggy order
  if (s.includes('@')) s = s.split('@')[0].replace(/[._-]+/g, ' ')
  s = s.replace(/^(vpa|mr|ms|mrs)\s+/i, '').trim()
  // Display case: "SWIGGY" → "Swiggy", "INDIAN OIL" → "Indian Oil"; acronyms (KFC, HP, IRCTC: no vowels) stay upper.
  const isAcronym = (w: string) => w === w.toUpperCase() && (w.length <= 2 || !/[AEIOU]/.test(w))
  return s
    .split(' ')
    .map((w) => (isAcronym(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

function findAmount(body: string): number | null {
  const after = body.match(AMOUNT_AFTER_VERB)
  const candidates: { value: number; index: number }[] = []
  for (const m of body.matchAll(AMOUNT)) {
    const before = body.slice(Math.max(0, m.index! - 25), m.index!)
    if (BALANCE_PREFIX.test(before)) continue
    candidates.push({ value: parseFloat(m[1].replace(/,/g, '')), index: m.index! })
  }
  if (after) {
    const idx = body.indexOf(after[0])
    if (!candidates.length || idx < candidates[0].index) return parseFloat(after[1].replace(/,/g, ''))
  }
  return candidates.length ? candidates[0].value : null
}

function findType(body: string): TxnType | null {
  const d = body.search(DEBIT)
  const c = body.search(CREDIT)
  if (d < 0 && c < 0) return null
  if (d < 0) return 'credit'
  if (c < 0) return 'debit'
  return d < c ? 'debit' : 'credit'
}

export function parseSmsDate(body: string, fallback: Date): Date {
  const pick = (y: number, mo: number, d: number) => {
    const year = y < 100 ? 2000 + y : y
    const dt = new Date(year, mo, d, fallback.getHours(), fallback.getMinutes())
    return Number.isNaN(dt.getTime()) || mo < 0 || mo > 11 || d < 1 || d > 31 ? null : dt
  }
  let m: RegExpMatchArray | null
  if ((m = body.match(/\b(\d{4})-(\d{2})-(\d{2})/))) return pick(+m[1], +m[2] - 1, +m[3]) ?? fallback
  if ((m = body.match(/\b(\d{1,2})[-\s]?([A-Za-z]{3})[a-z]*[-\s,]?(\d{2,4})\b/)) && MONTHS[m[2].toLowerCase()] !== undefined)
    return pick(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) ?? fallback
  if ((m = body.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/))) return pick(+m[3], +m[2] - 1, +m[1]) ?? fallback
  return fallback
}

function detectChannel(body: string, kind: 'bank' | 'card'): Channel {
  if (/\bupi\b|\bvpa\b|@[a-z]+/i.test(body)) return 'upi'
  if (/\batm\b|cash withdrawal/i.test(body)) return 'atm'
  if (/\b(neft|imps|rtgs)\b/i.test(body)) return 'neft_imps'
  if (/net ?banking|netbanking/i.test(body)) return 'netbanking'
  if (kind === 'card' || /\b(pos|card)\b/i.test(body)) return 'card'
  return 'other'
}

export function detectBank(sender: string | undefined, body: string): string | undefined {
  // Sender ID is most reliable; otherwise the earliest bank name in the text. UPI IDs (x@hdfcbank) are ignored.
  if (sender) {
    const s = BANKS.find(([re]) => re.test(sender))
    if (s) return s[1]
  }
  const text = body.replace(/\S+@\S+/g, ' ')
  let best: { i: number; name: string } | undefined
  for (const [re, name] of BANKS) {
    const i = text.search(re)
    if (i >= 0 && (!best || i < best.i)) best = { i, name }
  }
  return best?.name
}

/** Parse one SMS. Returns the transaction, or the reason it was skipped. */
export function parseSms(body: string, receivedAt: Date = new Date(), sender?: string): ParsedSms | { rejected: SmsRejectReason } {
  const text = body.replace(/\s+/g, ' ').trim()
  if (OTP.test(text)) return { rejected: 'otp' }
  if (REMINDER.test(text)) return { rejected: 'future_or_reminder' }
  if (FAILED.test(text)) return { rejected: 'failed' }
  if (PROMO.test(text)) return { rejected: 'not_transaction' }
  if (INVEST_CONFIRMATION.test(text) && !ACCOUNT.test(text)) return { rejected: 'not_transaction' }

  const type = findType(text)
  if (!type) return { rejected: 'not_transaction' }
  const amount = findAmount(text)
  if (amount === null || amount <= 0) return { rejected: 'no_amount' }

  const accountKind: 'bank' | 'card' = /credit card|\bcard\b|\bcc\b/i.test(text) && !/debit card/i.test(text) ? 'card' : 'bank'
  const account = text.match(ACCOUNT)?.[1]
  const ref = text.match(REF)?.[1]

  let merchant = ''
  search: for (const re of merchantPatterns(type)) {
    // Try every occurrence: "by NEFT from ACME" → skip "NEFT", take "ACME".
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const cand = m[1]?.trim()
      if (!cand || NOT_MERCHANT.test(cand) || /^(inr|rs)\b/i.test(cand)) continue
      merchant = cleanMerchant(cand)
      if (merchant) break search
    }
  }
  const isCardBillPayment = type === 'credit' && CARD_BILL.test(text)
  if (isCardBillPayment) merchant = 'Card bill payment'
  if (!merchant) merchant = /\batm\b/i.test(text) ? 'ATM Withdrawal' : 'Unknown'

  const when = parseSmsDate(text, receivedAt)
  return {
    amountPaise: Math.round(amount * 100),
    type,
    account,
    accountKind,
    bank: detectBank(sender, text),
    merchant,
    merchantKey: normaliseMerchant(merchant) || 'unknown',
    channel: detectChannel(text, accountKind),
    ref,
    date: dayKey(when),
    at: when.toISOString(),
    isCardBillPayment,
    raw: body,
  }
}

export const isParsed = (r: ReturnType<typeof parseSms>): r is ParsedSms => !('rejected' in r)

/** Stable id for dedupe: bank ref if present, else amount+type+account+day+merchant. */
export function txnId(p: Pick<ParsedSms, 'ref' | 'amountPaise' | 'type' | 'account' | 'date' | 'merchantKey'>): string {
  const key = p.ref ? `ref:${p.ref}` : `${p.amountPaise}|${p.type}|${p.account ?? ''}|${p.date}|${p.merchantKey}`
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0
  return `t_${h.toString(36)}_${key.length}`
}
