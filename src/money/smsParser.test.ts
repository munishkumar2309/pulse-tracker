import { describe, expect, it } from 'vitest'
import { isParsed, parseSms, txnId, type ParsedSms } from './smsParser'

// Fixtures follow the public formats of major Indian banks. Numbers/names are made up.
// TODO(user): add your own anonymised SMS below in REAL_SAMPLES as you collect them.
const RX = new Date(2026, 10, 18, 10, 22)

function ok(body: string, sender?: string): ParsedSms {
  const r = parseSms(body, RX, sender)
  if (!isParsed(r)) throw new Error(`rejected (${r.rejected}): ${body}`)
  return r
}

describe('bank account debits (UPI)', () => {
  it('HDFC "Sent Rs ... To X"', () => {
    const r = ok('Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112345678 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808', 'AX-HDFCBK')
    expect(r).toMatchObject({ amountPaise: 50000, type: 'debit', account: '1234', bank: 'HDFC', merchant: 'Swiggy', channel: 'upi', ref: '432112345678', date: '2026-11-18', accountKind: 'bank' })
  })
  it('ICICI "debited for Rs X; MERCHANT credited"', () => {
    const r = ok('ICICI Bank Acct XX123 debited for Rs 250.00 on 17-Nov-26; ZOMATO credited. UPI:432198765432. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.')
    expect(r).toMatchObject({ amountPaise: 25000, type: 'debit', account: '123', bank: 'ICICI', merchant: 'Zomato', ref: '432198765432', date: '2026-11-17' })
  })
  it('SBI "debited by 500.0 ... trf to X Refno"', () => {
    const r = ok('Dear UPI user A/C X1234 debited by 120.0 on date 18Nov26 trf to RAPIDO Refno 612345678901. If not u? call 1800111109. -SBI')
    expect(r).toMatchObject({ amountPaise: 12000, type: 'debit', account: '1234', bank: 'SBI', merchant: 'Rapido', ref: '612345678901', date: '2026-11-18' })
  })
  it('Kotak "Sent Rs ... to vpa@bank"', () => {
    const r = ok('Sent Rs.899.00 from Kotak Bank AC X1234 to blinkit.payu@hdfcbank on 18-11-26.UPI Ref 432155556666. Not you, kotak.com/fraud')
    expect(r).toMatchObject({ amountPaise: 89900, type: 'debit', account: '1234', bank: 'Kotak', merchant: 'Blinkit Payu', merchantKey: 'blinkit payu', ref: '432155556666' })
  })
})

describe('credit card spends', () => {
  it('HDFC card "spent on ... at MERCHANT"', () => {
    const r = ok('Rs.1,250.00 spent on HDFC Bank Card x1234 at AMAZON on 2026-11-18:10:22:11. Avl Lmt: Rs 1,20,000.00. Not you? Call 18002586161')
    expect(r).toMatchObject({ amountPaise: 125000, type: 'debit', account: '1234', accountKind: 'card', merchant: 'Amazon', channel: 'card', date: '2026-11-18' })
  })
  it('ICICI card "spent using ... on DATE on MERCHANT. Avl Limit"', () => {
    const r = ok('INR 3,499.00 spent using ICICI Bank Card XX9876 on 16-Nov-26 on MYNTRA. Avl Limit: INR 1,00,000.00. If not you, call 1800 2662/SMS BLOCK 9876 to 9215676766')
    expect(r).toMatchObject({ amountPaise: 349900, account: '9876', accountKind: 'card', merchant: 'Myntra', date: '2026-11-16' })
  })
  it('Axis card "Spent INR ... TIME IST MERCHANT Avl Limit"', () => {
    const r = ok('Spent INR 640 Axis Bank Card no. XX4321 18-11-26 20:15:02 IST STARBUCKS Avl Limit: INR 85000. Not you? SMS BLOCK 4321 to 919951860002')
    expect(r).toMatchObject({ amountPaise: 64000, account: '4321', accountKind: 'card', merchant: 'Starbucks', bank: 'Axis' })
  })
  it('SBI Card "spent on your SBI Credit Card ending 1234 at X"', () => {
    const r = ok('Rs.2,100.00 spent on your SBI Credit Card ending 5678 at INDIAN OIL on 15/11/26. Trxn. not done by you? Report at https://sbicard.com/Dispute')
    expect(r).toMatchObject({ amountPaise: 210000, account: '5678', accountKind: 'card', merchant: 'Indian Oil', date: '2026-11-15' })
  })
})

describe('credits', () => {
  it('salary via NEFT picks the payer, not "your A/c"', () => {
    const r = ok('Rs.85,000.00 credited to your A/c XX1234 on 01-11-26 by NEFT from ACME CORP. Avl Bal Rs 1,02,345.60 -HDFC Bank')
    expect(r).toMatchObject({ amountPaise: 8_500_000, type: 'credit', merchant: 'Acme Corp', channel: 'neft_imps', date: '2026-11-01' })
  })
  it('card bill payment is flagged', () => {
    const r = ok('Payment of Rs 15,000.00 received towards your HDFC Bank Credit Card XX1234 on 18-11-26. Thank you.')
    expect(r.type).toBe('credit')
    expect(r.isCardBillPayment).toBe(true)
  })
  it('UPI refund is a credit', () => {
    expect(ok('Rs 199.00 credited to A/c XX1234 from VPA swiggy.refund@icici on 18-11-26 UPI Ref 432100001111').type).toBe('credit')
  })
})

describe('ATM', () => {
  it('cash withdrawal', () => {
    const r = ok('Rs.5000.00 withdrawn at ATM S1AW1234 from A/c XX1234 on 18-11-26. Avl Bal Rs 20,000.00')
    expect(r).toMatchObject({ amountPaise: 500000, type: 'debit', channel: 'atm' })
  })
})

describe('rejections', () => {
  const rej = (body: string) => {
    const r = parseSms(body, RX)
    return isParsed(r) ? 'parsed' : r.rejected
  }
  it('OTPs', () => expect(rej('123456 is your OTP for txn of Rs 500.00 at AMAZON on HDFC Bank card 1234. Do not share.')).toBe('otp'))
  it('bill reminders', () => expect(rej('Your HDFC Bank Credit Card XX1234 statement: Total Amount Due Rs 15,000.00, Minimum Amount Due Rs 750. Due on 05-12-26.')).toBe('future_or_reminder'))
  it('auto-debit notice in future', () => expect(rej('Rs 999 will be debited from your A/c XX1234 on 20-11-26 towards NETFLIX mandate.')).toBe('future_or_reminder'))
  it('collect requests', () => expect(rej('ABC has requested money from you. Pay Rs 500 on GPay.')).toBe('future_or_reminder'))
  it('declined', () => expect(rej('Txn of Rs 2000 on your ICICI Bank Card XX1234 declined due to insufficient balance.')).toBe('failed'))
  it('promos', () => expect(rej('Pre-approved personal loan of Rs 5,00,000 credited instantly! Apply now. T&C apply.')).toBe('not_transaction'))
  it('non-transaction text', () => expect(rej('Dear customer, your KYC is updated. Thank you for banking with us.')).toBe('not_transaction'))
})

describe('balance is never taken as the amount', () => {
  it('ignores "Avl Bal" even when it comes first', () => {
    const r = ok('Avl Bal Rs 50,000.00. Rs 300.00 debited from A/c XX1234 to OLA on 18-11-26.')
    expect(r.amountPaise).toBe(30000)
  })
})

describe('txnId', () => {
  it('same ref → same id; different ref → different id', () => {
    const a = ok('Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112345678')
    const b = ok('Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112345678')
    const c = ok('Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 432112349999')
    expect(txnId(a)).toBe(txnId(b))
    expect(txnId(a)).not.toBe(txnId(c))
  })
})

// Add the user's real SMS here: [body, expected partial ParsedSms]
const REAL_SAMPLES: [string, Partial<ParsedSms>][] = []
describe.skipIf(REAL_SAMPLES.length === 0)('user samples', () => {
  it.each(REAL_SAMPLES)('%s', (body, expected) => expect(ok(body)).toMatchObject(expected))
})
