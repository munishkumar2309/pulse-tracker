// GPS maths for tracked walks/runs. Pure functions (tested in geo.test.ts).

export interface Fix { lat: number; lng: number; t: number; accuracy?: number }

const R = 6371000 // Earth radius, metres

/** Great-circle distance in metres (haversine). */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const MAX_ACCURACY_M = 30 // ignore fixes vaguer than this
export const MAX_SPEED_MS = 12 // ~43 km/h: anything faster on foot is a GPS jump

/**
 * Should this fix be added after `prev`? Rejects inaccurate fixes, GPS jumps,
 * and jitter while standing still (< 3 m moved).
 */
export function acceptFix(prev: Fix | null, next: Fix): { ok: boolean; meters: number } {
  if (next.accuracy !== undefined && next.accuracy > MAX_ACCURACY_M) return { ok: false, meters: 0 }
  if (!prev) return { ok: true, meters: 0 }
  const meters = haversine(prev, next)
  const secs = Math.max(1, (next.t - prev.t) / 1000)
  if (meters / secs > MAX_SPEED_MS) return { ok: false, meters: 0 }
  if (meters < 3) return { ok: false, meters: 0 }
  return { ok: true, meters }
}

/** Minutes per km, or null when too short to be meaningful. */
export function paceMinPerKm(distanceM: number, seconds: number): number | null {
  if (distanceM < 50 || seconds < 10) return null
  return seconds / 60 / (distanceM / 1000)
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || !Number.isFinite(minPerKm)) return '--'
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Energy estimate from MET by speed (Compendium of Physical Activities):
 * walking ~3.5 (5 km/h) to 5 (6.5 km/h), running ~8 (8 km/h) to 11.5 (12 km/h).
 * kcal = MET × kg × hours. An estimate, labelled as such.
 */
export function kcalEstimate(distanceM: number, seconds: number, weightKg: number): number {
  if (seconds <= 0) return 0
  const kmh = distanceM / 1000 / (seconds / 3600)
  const met = kmh < 3 ? 2.5 : kmh < 5.5 ? 3.5 : kmh < 7 ? 5 : kmh < 9 ? 8.3 : kmh < 11 ? 9.8 : 11.5
  return Math.round(met * weightKg * (seconds / 3600))
}
