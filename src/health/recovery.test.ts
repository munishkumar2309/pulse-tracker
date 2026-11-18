import { describe, expect, it } from 'vitest'
import { bandOf, minutesFrom, readiness, sleepNeed, type ReadinessInput } from './recovery'

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString()
const base: ReadinessInput = {
  lastSleepMin: 480, sleepGoalMin: 480, prevNightsMin: [480, 480, 480],
  recentBedtimes: [at(15, 23), at(16, 23), at(17, 23)], recentWaketimes: [at(16, 7), at(17, 7), at(18, 7)],
  yesterdaySteps: 8000, avgSteps14d: 8000,
}

describe('sleepNeed', () => {
  it('adds a third of the 3-night shortfall, capped at 60 min', () => {
    expect(sleepNeed(480, [420, 450, 480])).toBe(510)
    expect(sleepNeed(480, [240, 240, 240])).toBe(540)
    expect(sleepNeed(480, [500, 520, 480])).toBe(480)
  })
})

describe('readiness', () => {
  it('null without last night', () => {
    expect(readiness({ ...base, lastSleepMin: null })).toBeNull()
  })
  it('perfect inputs → 100 ready', () => {
    expect(readiness(base)).toMatchObject({ score: 100, band: 'ready', parts: { sleep: 100, regularity: 100, load: 100, restingHr: null } })
  })
  it('teardown worked example → 86 ready', () => {
    // need 510, slept 450 → S 88.2; σ 25 → C 86.7; r 1.5 → L 76.9
    const r = readiness({
      ...base, lastSleepMin: 450, prevNightsMin: [420, 450, 480], yesterdaySteps: 12000, avgSteps14d: 8000,
      // bed σ = wake σ = 25 min (25 min either side of 23:00 / 07:00)
      recentBedtimes: [at(15, 22, 35), at(16, 23, 25), at(17, 22, 35), at(14, 23, 25)],
      recentWaketimes: [at(16, 6, 35), at(17, 7, 25), at(18, 6, 35), at(15, 7, 25)],
    })
    expect(r).toMatchObject({ score: 86, band: 'ready', sleepNeedMin: 510, parts: { sleep: 88, regularity: 87, load: 77 } })
  })
  it('regularity waits for 3 nights and reports progress', () => {
    const r = readiness({ ...base, recentBedtimes: [at(17, 23)], recentWaketimes: [at(18, 7)] })
    expect(r).toMatchObject({ regularityNights: 1, parts: { regularity: null } })
  })
  it('resting HR is used only with ≥7 readings and re-weights', () => {
    const hrHigh = { today: 67, median14d: 60, readings: 10 }
    expect(readiness({ ...base, restingHr: hrHigh })).toMatchObject({ score: 80, parts: { restingHr: 0 } })
    expect(readiness({ ...base, restingHr: { ...hrHigh, readings: 3 } })!.parts.restingHr).toBeNull()
  })
  it('bands are 70 / 40', () => {
    expect([bandOf(70), bandOf(69), bandOf(40), bandOf(39)]).toEqual(['ready', 'steady', 'steady', 'easy'])
  })
  it('bedtimes across midnight compare correctly', () => {
    expect(minutesFrom(at(17, 23, 30), 18)).toBe(330)
    expect(minutesFrom(at(18, 0, 30), 18)).toBe(390)
  })
})
