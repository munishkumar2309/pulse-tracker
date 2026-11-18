// Health Connect → steps, sleep, weight, resting HR (read-only), via @capgo/capacitor-health (MPL-2.0).
// Rule from the teardown: manual entries win; Health Connect never overwrites a 'manual' row.
import { Capacitor } from '@capacitor/core'
import { db } from '../db/schema'
import { dayKey } from '../lib/format'

export const healthSupported = () => Capacitor.getPlatform() === 'android'
const READ = ['steps', 'sleep', 'weight', 'restingHeartRate'] as const
const SYNC_DAYS = 14

export interface HealthSyncResult { ok: boolean; message: string; steps?: number; sleep?: number; weights?: number }

export async function syncHealth(askPermission = false): Promise<HealthSyncResult | null> {
  if (!healthSupported()) return null
  const { Health } = await import('@capgo/capacitor-health')
  const avail = await Health.isAvailable()
  if (!avail.available) return { ok: false, message: 'Health Connect is not available. Install "Health Connect by Android" from the Play Store (built in on Android 14+).' }
  if (askPermission) await Health.requestAuthorization({ read: [...READ] })
  const status = await Health.checkAuthorization({ read: [...READ] })
  if (!status.readAuthorized.includes('steps')) return { ok: false, message: 'Pulse needs permission to read steps from Health Connect.' }

  const start = new Date()
  start.setDate(start.getDate() - SYNC_DAYS)
  start.setHours(0, 0, 0, 0)
  const range = { startDate: start.toISOString(), endDate: new Date().toISOString() }
  let steps = 0, sleep = 0, weights = 0

  // Steps: daily sums.
  const agg = await Health.queryAggregated({ dataType: 'steps', ...range, bucket: 'day', aggregation: 'sum' })
  for (const s of agg.samples) {
    const date = dayKey(new Date(s.startDate))
    const existing = await db.steps.get(date)
    if (existing?.source === 'manual') continue
    await db.steps.put({ date, count: Math.round(s.values.sum ?? s.value), source: 'health_connect' })
    steps++
  }

  // Sleep sessions: minutes asleep = session minus "awake" stages.
  if (status.readAuthorized.includes('sleep')) {
    const { samples } = await Health.readSamples({ dataType: 'sleep', ...range, limit: 200 })
    for (const s of samples) {
      const startIso = new Date(s.startDate).toISOString()
      const dup = await db.sleep.filter((x) => x.start === startIso).first()
      if (dup) continue
      const total = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000
      const stage = (k: string) => (s.stages ?? []).filter((x) => x.stage === k).reduce((a, x) => a + x.durationMinutes, 0)
      const awake = stage('awake')
      const minutes = Math.round(total - awake)
      if (minutes < 30) continue
      const date = dayKey(new Date(s.endDate))
      if (await db.sleep.where('date').equals(date).filter((x) => x.source === 'manual').count()) continue
      await db.sleep.add({
        date, start: startIso, end: new Date(s.endDate).toISOString(), minutes, source: 'health_connect',
        stages: s.hasStageData ? { deep: stage('deep'), light: stage('light'), rem: stage('rem'), awake } : undefined,
      })
      sleep++
    }
  }

  // Weight: one reading per day (latest wins), skip days with a manual entry.
  if (status.readAuthorized.includes('weight')) {
    const { samples } = await Health.readSamples({ dataType: 'weight', ...range, limit: 100 })
    for (const s of samples) {
      const date = dayKey(new Date(s.startDate))
      const sameDay = await db.weights.where('date').equals(date).toArray()
      if (sameDay.some((w) => w.source === 'manual' || Math.abs(w.kg - s.value) < 0.05)) continue
      await db.weights.add({ date, kg: Math.round(s.value * 10) / 10, source: 'health_connect' })
      weights++
    }
  }

  // Resting HR → meta (used by the readiness score once ≥7 readings exist).
  if (status.readAuthorized.includes('restingHeartRate')) {
    const { samples } = await Health.readSamples({ dataType: 'restingHeartRate', ...range, limit: 100 })
    const byDay = new Map<string, number>()
    for (const s of samples) byDay.set(dayKey(new Date(s.startDate)), Math.round(s.value))
    if (byDay.size) await db.meta.put({ key: 'restingHr', value: [...byDay.entries()].sort().map(([date, bpm]) => ({ date, bpm })) })
  }

  await db.meta.put({ key: 'healthLastSync', value: Date.now() })
  return { ok: true, message: 'Synced with Health Connect.', steps, sleep, weights }
}
