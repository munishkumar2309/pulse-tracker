import { describe, expect, it } from 'vitest'
import { detectColumns, merchantFromNarration, parseAmount, parseStatementDate, rowsToTxns } from './statementImport'

// Layouts modelled on common Indian bank statement exports. Data is made up.
const HDFC = [
  ['HDFC BANK Ltd.', '', '', '', '', '', ''],
  ['Statement of account', '', '', '', '', '', ''],
  ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
  ['01/11/26', 'NEFT CR-CITI0000001-ACME CORP-SALARY NOV', 'CITIN26000001', '01/11/26', '', '85,000.00', '1,02,345.60'],
  ['02/11/26', 'UPI-SWIGGY-SWIGGY.ORDER@ICICI-ICIC0DC0099-432112340001-PAYMENT', '0000432112340001', '02/11/26', '450.00', '', '1,01,895.60'],
  ['03/11/26', 'POS 416021XXXXXX1234 AMAZON PAY INDIA', '0000000000', '03/11/26', '2,899.00', '', '98,996.60'],
  ['04/11/26', 'ATW-416021XXXXXX1234-S1AW1234-BANGALORE', '0000000000', '04/11/26', '5,000.00', '', '93,996.60'],
  ['', '', '', '', '', '', ''],
]
const ICICI = [
  ['S No.', 'Value Date', 'Transaction Date', 'Cheque Number', 'Transaction Remarks', 'Withdrawal Amount (INR )', 'Deposit Amount (INR )', 'Balance (INR )'],
  ['1', '05/11/2026', '05/11/2026', '-', 'UPI/432112340002/DR/ZOMATO/YESB/zomato.pay@ybl/Payment', '620.00', '0.00', '50,000.00'],
  ['2', '06/11/2026', '06/11/2026', '-', 'UPI/432112340003/CR/RAHUL SHARMA/HDFC/rahul@okhdfc/split', '0.00', '300.00', '50,300.00'],
]
const SBI_SINGLE = [
  ['Txn Date', 'Description', 'Ref No./Cheque No.', 'Amount', 'Dr / Cr', 'Balance'],
  ['7 Nov 2026', 'TO TRANSFER-UPI/DR/432112340004/BLINKIT/YESB/blinkit@ybl/Pay', 'TRANSFER TO 4897', '1,240.00', 'DR', '10,000.00'],
  ['8 Nov 2026', 'BY TRANSFER-NEFT*HDFC0000001*ACME CORP', 'TRANSFER FROM 5555', '500.00', 'CR', '10,500.00'],
]

describe('detectColumns', () => {
  it('HDFC: header after preamble, separate withdrawal/deposit', () => {
    expect(detectColumns(HDFC)).toEqual({ headerRow: 2, date: 0, narration: 1, debit: 4, credit: 5, ref: 2 })
  })
  it('ICICI: "Transaction Remarks" and "(INR )" headers', () => {
    expect(detectColumns(ICICI)).toMatchObject({ headerRow: 0, narration: 4, debit: 5, credit: 6 })
  })
  it('single amount + Dr/Cr column', () => {
    expect(detectColumns(SBI_SINGLE)).toMatchObject({ date: 0, narration: 1, amount: 3, drcr: 4 })
  })
  it('null when no header found', () => {
    expect(detectColumns([['a', 'b'], ['1', '2']])).toBeNull()
  })
})

describe('parsers', () => {
  it('dates (day-first)', () => {
    expect(parseStatementDate('02/11/26')).toBe('2026-11-02')
    expect(parseStatementDate('05/11/2026')).toBe('2026-11-05')
    expect(parseStatementDate('7 Nov 2026')).toBe('2026-11-07')
    expect(parseStatementDate('07-Nov-26')).toBe('2026-11-07')
    expect(parseStatementDate('2026-11-08')).toBe('2026-11-08')
    expect(parseStatementDate(46333)).toBe('2026-11-07') // Excel serial (46023 = 1 Jan 2026)
    expect(parseStatementDate('Opening Balance')).toBeNull()
  })
  it('amounts', () => {
    expect(parseAmount('1,02,345.60')).toBe(102345.6)
    expect(parseAmount('₹ 500')).toBe(500)
    expect(parseAmount('500.00 Dr')).toBe(500)
    expect(parseAmount('(250.00)')).toBe(-250)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-')).toBeNull()
  })
  it('merchant from narration', () => {
    expect(merchantFromNarration('UPI-SWIGGY-SWIGGY.ORDER@ICICI-ICIC0DC0099-432112340001-PAYMENT')).toBe('Swiggy')
    expect(merchantFromNarration('UPI/432112340002/DR/ZOMATO/YESB/zomato.pay@ybl/Payment')).toBe('Zomato')
    expect(merchantFromNarration('POS 416021XXXXXX1234 AMAZON PAY INDIA')).toBe('Amazon Pay India')
    expect(merchantFromNarration('NEFT CR-CITI0000001-ACME CORP-SALARY NOV')).toBe('Acme Corp')
    expect(merchantFromNarration('ATW-416021XXXXXX1234-S1AW1234-BANGALORE')).toBe('ATM Withdrawal')
  })
})

describe('rowsToTxns', () => {
  it('HDFC rows → debits/credits with UPI ref for SMS dedupe', () => {
    const t = rowsToTxns(HDFC, detectColumns(HDFC)!)
    expect(t).toHaveLength(4)
    expect(t[0]).toMatchObject({ date: '2026-11-01', type: 'credit', amountPaise: 8_500_000, merchant: 'Acme Corp', channel: 'neft_imps' })
    expect(t[1]).toMatchObject({ type: 'debit', amountPaise: 45_000, merchant: 'Swiggy', channel: 'upi', ref: '432112340001' })
    expect(t[2]).toMatchObject({ merchant: 'Amazon Pay India', channel: 'card' })
    expect(t[3]).toMatchObject({ merchant: 'ATM Withdrawal', channel: 'atm', amountPaise: 500_000 })
  })
  it('ICICI zero-filled columns', () => {
    const t = rowsToTxns(ICICI, detectColumns(ICICI)!)
    expect(t.map((x) => [x.type, x.amountPaise, x.merchant])).toEqual([['debit', 62_000, 'Zomato'], ['credit', 30_000, 'Rahul Sharma']])
  })
  it('single amount column with Dr/Cr flag', () => {
    const t = rowsToTxns(SBI_SINGLE, detectColumns(SBI_SINGLE)!)
    expect(t.map((x) => [x.type, x.amountPaise, x.merchant])).toEqual([['debit', 124_000, 'Blinkit'], ['credit', 50_000, 'Acme Corp']])
  })
})
