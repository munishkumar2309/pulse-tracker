import { describe, expect, it } from 'vitest'
import { isBankSender } from './sms'

describe('isBankSender', () => {
  it('accepts Indian commercial sender IDs', () => {
    for (const s of ['AX-HDFCBK', 'VM-ICICIT', 'JD-SBIUPI-S', 'BZ-KOTAKB-T', 'AD-AXISBK']) expect(isBankSender(s), s).toBe(true)
  })
  it('ignores personal numbers and short codes', () => {
    for (const s of ['+919876543210', '9876543210', '57575', 'Mom']) expect(isBankSender(s), s).toBe(false)
  })
})
