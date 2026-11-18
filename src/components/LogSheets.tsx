// Quick-log sheets opened from Today: weight, water, sleep, steps.
import { useState } from 'react'
import { db } from '../db/schema'
import { dayKey, minutesToHM } from '../lib/format'
import { Field, PrimaryButton, Sheet } from './Sheet'

export type LogKind = 'weight' | 'water' | 'sleep' | 'steps' | null

export function LogSheets({ kind, onClose, lastWeight }: { kind: LogKind; onClose: () => void; lastWeight?: number }) {
  return (
    <>
      <Sheet open={kind === 'weight'} onClose={onClose} title="Log weight"><WeightForm onDone={onClose} last={lastWeight} /></Sheet>
      <Sheet open={kind === 'water'} onClose={onClose} title="Add water"><WaterForm onDone={onClose} /></Sheet>
      <Sheet open={kind === 'sleep'} onClose={onClose} title="Log last night's sleep"><SleepForm onDone={onClose} /></Sheet>
      <Sheet open={kind === 'steps'} onClose={onClose} title="Today's steps"><StepsForm onDone={onClose} /></Sheet>
    </>
  )
}

function WeightForm({ onDone, last }: { onDone: () => void; last?: number }) {
  const [kg, setKg] = useState(last ?? 70)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await db.weights.add({ date: dayKey(), kg, source: 'manual' }); onDone() }}>
      <Field label="Weight (kg)" hint="Weigh at the same time each day, ideally after waking.">
        <input type="number" inputMode="decimal" step="0.1" value={kg || ''} onChange={(e) => setKg(+e.target.value)} autoFocus />
      </Field>
      <PrimaryButton tone="body" disabled={!(kg > 20 && kg < 300)}>Save weight</PrimaryButton>
    </form>
  )
}

function WaterForm({ onDone }: { onDone: () => void }) {
  const add = async (ml: number) => {
    await db.water.add({ date: dayKey(), at: new Date().toISOString(), ml })
    onDone()
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {[[150, 'Small glass'], [250, 'Glass'], [500, 'Bottle']].map(([ml, label]) => (
        <button key={ml} type="button" onClick={() => add(ml as number)} className="rounded-[14px] bg-muted py-4 flex flex-col items-center gap-1">
          <span className="num-tight text-[20px] font-semibold text-water">{ml}<span className="text-[12px] font-normal"> ml</span></span>
          <span className="text-[12px] text-muted-foreground">{label}</span>
        </button>
      ))}
    </div>
  )
}

function SleepForm({ onDone }: { onDone: () => void }) {
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')
  const toDate = (hm: string, dayOffset: number) => {
    const [h, m] = hm.split(':').map(Number)
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return d
  }
  const end = toDate(wake, 0)
  let start = toDate(bed, 0)
  if (start >= end) start = toDate(bed, -1) // went to bed yesterday
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await db.sleep.add({ date: dayKey(), start: start.toISOString(), end: end.toISOString(), minutes, source: 'manual' })
      onDone()
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Went to bed"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
        <Field label="Woke up"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
      </div>
      <p className="mb-4 text-[14px] text-muted-foreground">That's <span className="num-tight text-foreground font-semibold">{minutesToHM(minutes)}</span> in bed.</p>
      <PrimaryButton tone="body" disabled={minutes < 30 || minutes > 16 * 60}>Save sleep</PrimaryButton>
    </form>
  )
}

function StepsForm({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await db.steps.put({ date: dayKey(), count: n, source: 'manual' }); onDone() }}>
      <Field label="Steps so far today" hint="On Android, steps fill in automatically from Health Connect once the app is installed.">
        <input type="number" inputMode="numeric" value={n || ''} onChange={(e) => setN(+e.target.value)} autoFocus />
      </Field>
      <PrimaryButton tone="body" disabled={n < 0}>Save steps</PrimaryButton>
    </form>
  )
}
