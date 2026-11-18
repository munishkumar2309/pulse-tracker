// Phone-only readiness score (0–100). A heuristic, NOT a medical measure; the UI says so.
// Formula from docs/research/fitbit-whoop-teardown.md §4, documented in docs/HEALTH.md.
// Bands (70 / 40) are Pulse's own, deliberately not WHOOP's recovery cut-offs.

export interface ReadinessInput {
  lastSleepMin: number | null // last night's sleep
  sleepGoalMin: number // user's goal (e.g. 480)
  prevNightsMin: number[] // the 3 nights before last night (for sleep debt)
  recentBedtimes: string[] // ISO start times, last ≤7 nights
  recentWaketimes: string[] // ISO end times, last ≤7 nights
  yesterdaySteps: number | null
  avgSteps14d: number | null
  restingHr?: { today: number; median14d: number; readings: number } // only from Health Connect
}

export type Band = 'ready' | 'steady' | 'easy'

export interface Readiness {
  score: number
  band: Band
  sleepNeedMin: number
  parts: { sleep: number; regularity: number | null; load: number | null; restingHr: number | null }
  regularityNights: number // shown as "3 of 7 nights" while calibrating
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Minutes after an anchor hour, so 23:30 and 00:30 (anchor 18) are 330 and 390, not 1410 and 30. */
export function minutesFrom(iso: string, anchorHour: number): number {
  const d = new Date(iso)
  return (d.getHours() * 60 + d.getMinutes() - anchorHour * 60 + 1440) % 1440
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length)
}

/** Goal plus up to 60 min to pay back the average shortfall of the previous 3 nights. */
export function sleepNeed(goalMin: number, prevNightsMin: number[]): number {
  const debt = prevNightsMin.slice(0, 3).reduce((a, n) => a + Math.max(0, goalMin - n), 0)
  return goalMin + Math.min(60, debt / 3)
}

export function bandOf(score: number): Band {
  return score >= 70 ? 'ready' : score >= 40 ? 'steady' : 'easy'
}

export function readiness(i: ReadinessInput): Readiness | null {
  if (i.lastSleepMin == null) return null
  const need = sleepNeed(i.sleepGoalMin, i.prevNightsMin)

  const sleep = clamp((100 * i.lastSleepMin) / need)

  // Regularity: average std-dev of bed and wake times. ≤15 min → 100, ≥90 min → 0. Needs ≥3 nights.
  const nights = Math.min(i.recentBedtimes.length, i.recentWaketimes.length)
  let regularity: number | null = null
  if (nights >= 3) {
    const sigma = (stdDev(i.recentBedtimes.map((t) => minutesFrom(t, 18))) + stdDev(i.recentWaketimes.map((t) => minutesFrom(t, 0)))) / 2
    regularity = clamp((100 * (90 - sigma)) / 75)
  }

  // Load: yesterday's steps vs 14-day average. ≤1.2× → 100, ≥2.5× → 0.
  let load: number | null = null
  if (i.yesterdaySteps != null && i.avgSteps14d && i.avgSteps14d > 0) {
    load = clamp(100 - ((i.yesterdaySteps / i.avgSteps14d - 1.2) / 1.3) * 100)
  }

  // Resting HR above your 14-day median lowers readiness. Δ ≤ 0 → 100, ≥ +7 bpm → 0. Needs ≥7 readings.
  let restingHr: number | null = null
  if (i.restingHr && i.restingHr.readings >= 7) restingHr = clamp(100 - ((i.restingHr.today - i.restingHr.median14d) / 7) * 100)

  const weights: [number | null, number][] =
    restingHr === null ? [[sleep, 0.6], [regularity, 0.25], [load, 0.15]] : [[sleep, 0.45], [regularity, 0.2], [load, 0.15], [restingHr, 0.2]]
  const have = weights.filter((p): p is [number, number] => p[0] !== null)
  const w = have.reduce((a, [, wt]) => a + wt, 0)
  const score = Math.round(have.reduce((a, [v, wt]) => a + v * wt, 0) / w)
  const r = (x: number | null) => (x === null ? null : Math.round(x))

  return {
    score, band: bandOf(score), sleepNeedMin: Math.round(need), regularityNights: nights,
    parts: { sleep: Math.round(sleep), regularity: r(regularity), load: r(load), restingHr: r(restingHr) },
  }
}
