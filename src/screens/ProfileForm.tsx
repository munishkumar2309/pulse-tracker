// First-run setup and Settings → Profile. Saves the profile and (on first run) a starting weight.
import { useState } from 'react'
import { Field, PrimaryButton } from '../components/Sheet'
import type { Activity, BmiStandard, Sex } from '../health/calc'
import { healthyWeightRange } from '../health/calc'
import { dayKey } from '../lib/format'
import { db, type Profile } from '../db/schema'

const ACTIVITY: [Activity, string][] = [
  ['sedentary', 'Mostly sitting (desk job, little exercise)'],
  ['light', 'Light (walks, exercise 1–3 days a week)'],
  ['moderate', 'Moderate (exercise 3–5 days a week)'],
  ['active', 'Active (hard exercise 6–7 days a week)'],
  ['very_active', 'Very active (physical job or training twice a day)'],
]

export function ProfileForm({ initial, initialWeight, onDone }: { initial?: Profile; initialWeight?: number; onDone?: () => void }) {
  const [p, setP] = useState<Profile>(
    initial ?? {
      id: 'me', sex: 'male', dob: '1990-01-01', heightCm: 170, activity: 'sedentary',
      goalWeightKg: 65, paceKgPerWeek: 0.5, stepGoal: 8000, sleepGoalMin: 480, bmiStandard: 'asian',
    },
  )
  const [weight, setWeight] = useState<number>(initialWeight ?? 75)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }))
  const range = healthyWeightRange(p.heightCm || 1, p.bmiStandard)
  const valid = p.heightCm >= 100 && p.heightCm <= 230 && weight >= 25 && weight <= 300 && p.goalWeightKg >= 25 && !!p.dob

  async function save() {
    await db.transaction('rw', db.profile, db.weights, async () => {
      await db.profile.put(p)
      if (!initial) await db.weights.add({ date: dayKey(), kg: weight, source: 'manual' })
    })
    onDone?.()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) save() }}>
      <Field label="Name (optional)">
        <input value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex">
          <select value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input type="date" value={p.dob} onChange={(e) => set('dob', e.target.value)} />
        </Field>
        <Field label="Height (cm)">
          <input type="number" inputMode="decimal" value={p.heightCm || ''} onChange={(e) => set('heightCm', +e.target.value)} />
        </Field>
        {!initial && (
          <Field label="Current weight (kg)">
            <input type="number" inputMode="decimal" step="0.1" value={weight || ''} onChange={(e) => setWeight(+e.target.value)} />
          </Field>
        )}
        <Field label="Goal weight (kg)" hint={`Healthy for your height: ${range.min}–${range.max} kg`}>
          <input type="number" inputMode="decimal" step="0.1" value={p.goalWeightKg || ''} onChange={(e) => set('goalWeightKg', +e.target.value)} />
        </Field>
        <Field label="Weight loss pace">
          <select value={p.paceKgPerWeek} onChange={(e) => set('paceKgPerWeek', +e.target.value)}>
            <option value={0}>Maintain</option>
            <option value={0.25}>0.25 kg a week</option>
            <option value={0.5}>0.5 kg a week</option>
            <option value={0.75}>0.75 kg a week</option>
          </select>
        </Field>
      </div>
      <Field label="How active are you?">
        <select value={p.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
          {ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daily step goal">
          <input type="number" inputMode="numeric" step="500" value={p.stepGoal || ''} onChange={(e) => set('stepGoal', +e.target.value)} />
        </Field>
        <Field label="Sleep goal (hours)">
          <input type="number" inputMode="decimal" step="0.5" value={p.sleepGoalMin / 60 || ''} onChange={(e) => set('sleepGoalMin', Math.round(+e.target.value * 60))} />
        </Field>
      </div>
      <Field label="BMI ranges" hint="Asian ranges flag health risk at a lower BMI and are recommended for Indians.">
        <select value={p.bmiStandard} onChange={(e) => set('bmiStandard', e.target.value as BmiStandard)}>
          <option value="asian">Asian (normal 18.5–22.9)</option>
          <option value="who">WHO international (normal 18.5–24.9)</option>
        </select>
      </Field>
      <PrimaryButton type="submit" tone="body" disabled={!valid} className="mt-2">{initial ? 'Save profile' : 'Start tracking'}</PrimaryButton>
    </form>
  )
}
