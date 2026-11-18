import { describe, expect, it } from 'vitest'
import type { SleepEntry } from '../db/schema'
import { acceptPhoneSleep, overlaps, phoneRowsReplacedBy, pickSteps } from './sources'

describe('pickSteps', () => {
  const day = '2026-11-18'
  it('saves when nothing exists', () => {
    expect(pickSteps(undefined, { date: day, count: 500, source: 'phone' })).toEqual({ date: day, count: 500, source: 'phone' })
  })
  it('never overwrites a manual entry, even with a higher count', () => {
    expect(pickSteps({ date: day, count: 100, source: 'manual' }, { date: day, count: 9000, source: 'phone' })).toBeNull()
  })
  it('keeps the higher of phone and Health Connect', () => {
    expect(pickSteps({ date: day, count: 8000, source: 'health_connect' }, { date: day, count: 7000, source: 'phone' })).toBeNull()
    expect(pickSteps({ date: day, count: 7000, source: 'phone' }, { date: day, count: 8000, source: 'health_connect' })?.source).toBe('health_connect')
  })
  it('never lowers a count from the same source', () => {
    expect(pickSteps({ date: day, count: 7000, source: 'phone' }, { date: day, count: 300, source: 'phone' })).toBeNull()
  })
})

const entry = (start: string, end: string, source: SleepEntry['source'], date = '2026-11-18'): SleepEntry => ({
  date, start, end, source, minutes: Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
})

describe('sleep sources', () => {
  const phone = entry('2026-11-17T17:30:00.000Z', '2026-11-18T01:00:00.000Z', 'phone') // 23:00–06:30 IST
  it('detects overlap across UTC and local ISO strings', () => {
    expect(overlaps(phone, { start: '2026-11-18T05:00:00+05:30', end: '2026-11-18T07:00:00+05:30' })).toBe(true)
    expect(overlaps(phone, { start: '2026-11-18T13:00:00+05:30', end: '2026-11-18T14:00:00+05:30' })).toBe(false)
  })
  it('accepts a phone night when nothing else covers it', () => {
    expect(acceptPhoneSleep(phone, [])).toBe(true)
  })
  it('drops short phone segments', () => {
    expect(acceptPhoneSleep(entry('2026-11-18T08:00:00.000Z', '2026-11-18T08:40:00.000Z', 'phone'), [])).toBe(false)
  })
  it('loses to a manual entry for the same morning, even without overlap', () => {
    expect(acceptPhoneSleep(phone, [entry('2026-11-17T19:00:00.000Z', '2026-11-17T19:30:00.000Z', 'manual')])).toBe(false)
  })
  it('loses to an overlapping Health Connect session, and that session replaces it', () => {
    const hc = entry('2026-11-17T17:45:00.000Z', '2026-11-18T01:10:00.000Z', 'health_connect')
    expect(acceptPhoneSleep(phone, [hc])).toBe(false)
    expect(phoneRowsReplacedBy(hc, [phone, hc])).toEqual([phone])
  })
})
