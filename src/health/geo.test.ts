import { describe, expect, it } from 'vitest'
import { acceptFix, formatDuration, formatPace, haversine, kcalEstimate, paceMinPerKm } from './geo'

describe('haversine', () => {
  it('India Gate → Rashtrapati Bhavan ≈ 2.4 km', () => {
    const d = haversine({ lat: 28.6129, lng: 77.2295 }, { lat: 28.6143, lng: 77.1994 })
    expect(d).toBeGreaterThan(2900)
    expect(d).toBeLessThan(3000)
  })
  it('0 for the same point', () => expect(haversine({ lat: 19, lng: 72 }, { lat: 19, lng: 72 })).toBe(0))
})

describe('acceptFix', () => {
  const p = { lat: 28.6, lng: 77.2, t: 0, accuracy: 5 }
  const north = (m: number, s: number, accuracy = 5) => ({ lat: 28.6 + m / 111_195, lng: 77.2, t: s * 1000, accuracy })
  it('first good fix is accepted with 0 m', () => expect(acceptFix(null, p)).toEqual({ ok: true, meters: 0 }))
  it('normal walking step', () => {
    const r = acceptFix(p, north(14, 10))
    expect(r.ok).toBe(true)
    expect(r.meters).toBeCloseTo(14, 0)
  })
  it('rejects inaccurate fixes, jumps and standing-still jitter', () => {
    expect(acceptFix(p, north(14, 10, 80)).ok).toBe(false) // accuracy 80 m
    expect(acceptFix(p, north(500, 10)).ok).toBe(false) // 50 m/s
    expect(acceptFix(p, north(1, 10)).ok).toBe(false) // < 3 m
  })
})

describe('pace, duration, kcal', () => {
  it('5 km in 30 min = 6:00 /km', () => {
    expect(formatPace(paceMinPerKm(5000, 1800))).toBe('6:00')
  })
  it('short distances have no pace', () => expect(formatPace(paceMinPerKm(20, 30))).toBe('--'))
  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
  it('kcal: 1 h brisk walk (5 km/h) at 70 kg ≈ 245', () => {
    expect(kcalEstimate(5000, 3600, 70)).toBe(245) // MET 3.5
  })
  it('kcal: 30 min run at 10 km/h, 70 kg ≈ 343', () => {
    expect(kcalEstimate(5000, 1800, 70)).toBe(343) // MET 9.8
  })
})
