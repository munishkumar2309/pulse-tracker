import { describe, expect, it } from 'vitest'
import { dayKey, formatINR, formatINRShort, minutesToHM } from './format'

describe('format', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(12_500_000)).toBe('₹1,25,000')
    expect(formatINR(12_500_050, true)).toBe('₹1,25,000.50')
  })
  it('short form uses K / L / Cr', () => {
    expect(formatINRShort(95_000)).toBe('₹950')
    expect(formatINRShort(1_250_000)).toBe('₹12.5K')
    expect(formatINRShort(12_000_000)).toBe('₹1.2L')
    expect(formatINRShort(3_400_000_000)).toBe('₹3.4Cr')
  })
  it('day key is local YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05')
  })
  it('minutes to h m', () => {
    expect(minutesToHM(452)).toBe('7h 32m')
    expect(minutesToHM(45)).toBe('45m')
  })
})
