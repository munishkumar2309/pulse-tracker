// The phone's own sensors → steps and sleep, via our native plugin (android/.../PhoneSensorsPlugin.java).
// Steps: Google's Recording API. Play services counts steps on the phone in the background, on-device, no account.
// Sleep: Google's Sleep API (accelerometer + light sensor), delivered to SleepReceiver.java even when Pulse is closed.
// Phone sleep is an estimate; manual entries and Health Connect win (src/health/sources.ts).
import { Capacitor, registerPlugin } from '@capacitor/core'
import { db, type SleepEntry } from '../db/schema'
import { acceptPhoneSleep, pickSteps } from '../health/sources'
import { dayKey } from '../lib/format'

export interface PhoneStatus { steps: boolean; sleep: boolean; message?: string }
export interface WidgetData {
  date: string // day the numbers belong to; the widget hides stale ones
  steps: number
  stepsManual: boolean // a typed count must not be replaced by the live sensor count
  stepGoal: number
  sleepMin: number | null
  waterMl: number
  waterGoalMl: number
  spent: string // already formatted, e.g. "₹1,250"
}
interface PhoneSensorsPlugin {
  start(o: { askPermission: boolean }): Promise<PhoneStatus>
  readSteps(o: { days: number }): Promise<{ days: { start: number; count: number }[] }>
  readSleep(): Promise<{ segments: { start: number; end: number }[] }>
  setWidgetData(d: WidgetData): Promise<void>
}

export const PhoneSensors = registerPlugin<PhoneSensorsPlugin>('PhoneSensors')
export const phoneSupported = () => Capacitor.getPlatform() === 'android'

/** Recording API keeps 10 days on the phone. */
const STEP_DAYS = 10

export async function syncPhone(askPermission = false): Promise<(PhoneStatus & { stepDays: number; nights: number }) | null> {
  if (!phoneSupported()) return null
  const status = await PhoneSensors.start({ askPermission })
  let stepDays = 0, nights = 0

  if (status.steps) {
    const { days } = await PhoneSensors.readSteps({ days: STEP_DAYS })
    for (const d of days) {
      const date = dayKey(new Date(d.start))
      const row = pickSteps(await db.steps.get(date), { date, count: d.count, source: 'phone' })
      if (!row) continue
      await db.steps.put(row)
      stepDays++
    }
  }

  if (status.sleep) {
    const { segments } = await PhoneSensors.readSleep()
    for (const s of segments) {
      const entry: SleepEntry = {
        date: dayKey(new Date(s.end)),
        start: new Date(s.start).toISOString(),
        end: new Date(s.end).toISOString(),
        minutes: Math.round((s.end - s.start) / 60000),
        source: 'phone',
      }
      const nearby = await db.sleep.where('date').between(dayKey(new Date(s.start)), entry.date, true, true).toArray()
      if (!acceptPhoneSleep(entry, nearby)) continue
      await db.sleep.add(entry)
      nights++
    }
  }

  await db.meta.put({ key: 'phoneLastSync', value: { at: Date.now(), steps: status.steps, sleep: status.sleep, message: status.message } })
  return { ...status, stepDays, nights }
}
