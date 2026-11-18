// Home-screen widgets (android/.../PulseWidget.java) can't read IndexedDB, so the app hands them
// today's numbers whenever the data changes. The widget adds the live phone step count on its own.
import { liveQuery } from 'dexie'
import { db } from '../db/schema'
import { waterTargetMl } from '../health/calc'
import { dayKey, formatINR } from '../lib/format'
import { isSpend } from '../money/insights'
import { PhoneSensors, phoneSupported, type WidgetData } from './phone'

async function snapshot(): Promise<WidgetData> {
  const date = dayKey()
  const [profile, steps, sleep, water, txns, weight] = await Promise.all([
    db.profile.get('me'),
    db.steps.get(date),
    db.sleep.where('date').equals(date).toArray(),
    db.water.where('date').equals(date).toArray(),
    db.transactions.where('date').equals(date).toArray(),
    db.weights.orderBy('date').last(),
  ])
  return {
    date,
    steps: steps?.count ?? 0,
    stepsManual: steps?.source === 'manual',
    stepGoal: profile?.stepGoal ?? 10000,
    sleepMin: sleep.length ? sleep.reduce((a, s) => a + s.minutes, 0) : null,
    waterMl: water.reduce((a, w) => a + w.ml, 0),
    waterGoalMl: profile?.waterGoalMl ?? (weight ? waterTargetMl(weight.kg) : 0),
    spent: formatINR(txns.filter(isSpend).reduce((a, t) => a + t.amountPaise, 0)),
  }
}

export function startWidgetUpdates() {
  if (!phoneSupported()) return
  liveQuery(snapshot).subscribe({
    next: (d) => { PhoneSensors.setWidgetData(d).catch(() => {}) },
    error: () => {},
  })
}
