// Trends: weight (with goal + healthy band), sleep, steps, weekly spend over 7 / 30 / 90 days.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { targetsFor, useProfile } from '../db/hooks'
import { db } from '../db/schema'
import { dayKey, formatINR, formatINRShort, minutesToHM } from '../lib/format'
import { isSpend } from '../money/insights'

const RANGES = [7, 30, 90] as const
const shortDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const axis = { stroke: 'var(--muted-foreground)', fontSize: 11, tickLine: false, axisLine: false } as const
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }, labelStyle: { color: 'var(--muted-foreground)' } }

export function Trends() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const profile = useProfile()
  const from = (() => { const d = new Date(); d.setDate(d.getDate() - days + 1); return dayKey(d) })()
  const data = useLiveQuery(async () => {
    const [w, s, st, tx] = await Promise.all([
      db.weights.where('date').aboveOrEqual(from).sortBy('date'),
      db.sleep.where('date').aboveOrEqual(from).sortBy('date'),
      db.steps.where('date').aboveOrEqual(from).sortBy('date'),
      db.transactions.where('date').aboveOrEqual(from).toArray(),
    ])
    // One weight per day (last entry wins).
    const weights = [...new Map(w.map((x) => [x.date, x.kg])).entries()].map(([date, kg]) => ({ date, kg }))
    const sleepByDay = new Map<string, number>()
    for (const x of s) sleepByDay.set(x.date, (sleepByDay.get(x.date) ?? 0) + x.minutes)
    // Spend grouped by week (Mon start) for 30/90, by day for 7.
    const spend = new Map<string, number>()
    for (const t of tx.filter(isSpend)) {
      let k = t.date
      if (days > 7) { const d = new Date(t.date + 'T00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); k = dayKey(d) }
      spend.set(k, (spend.get(k) ?? 0) + t.amountPaise)
    }
    return {
      weights,
      sleepPhone: s.some((x) => x.source === 'phone'),
      sleep: [...sleepByDay.entries()].map(([date, min]) => ({ date, hours: +(min / 60).toFixed(2) })),
      steps: st.map((x) => ({ date: x.date, steps: x.count })),
      spend: [...spend.entries()].sort().map(([date, paise]) => ({ date, rupees: Math.round(paise / 100) })),
    }
  }, [from, days])

  if (!data || !profile) return null
  const lastKg = data.weights.at(-1)?.kg
  const healthy = lastKg ? targetsFor(profile, lastKg).healthy : null
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

  return (
    <div className="px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold">Trends</h1>
        <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={days === r} onClick={() => setDays(r)}
              className={`rounded-full px-3 py-1 text-[13px] ${days === r ? 'bg-foreground text-background font-semibold' : 'text-muted-foreground'}`}>{r} days</button>
          ))}
        </div>
      </header>

      <Chart title="Weight" color="var(--body)" summary={lastKg ? `${lastKg} kg now, goal ${profile.goalWeightKg} kg` : undefined} empty={data.weights.length < 2 ? 'Log your weight on two or more days to see a trend.' : null}>
        <LineChart data={data.weights} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          {healthy && <ReferenceArea y1={healthy.min} y2={healthy.max} fill="var(--ok)" fillOpacity={0.08} />}
          <ReferenceLine y={profile.goalWeightKg} stroke="var(--body)" strokeDasharray="4 4" label={{ value: 'Goal', fill: 'var(--body)', fontSize: 11, position: 'insideTopRight' }} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={24} />
          <YAxis domain={[(d: number) => Math.floor(d - 1), (d: number) => Math.ceil(d + 1)]} allowDecimals={false} {...axis} width={44} />
          <Tooltip {...tip} labelFormatter={(d) => shortDate(String(d))} formatter={(v) => [`${v} kg`, 'Weight']} />
          <Line type="monotone" dataKey="kg" stroke="var(--body)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--body)' }} />
        </LineChart>
      </Chart>

      <Chart title="Sleep" color="var(--ring-sleep)" summary={data.sleep.length ? `Average ${minutesToHM(avg(data.sleep.map((s) => s.hours)) * 60)}${data.sleepPhone ? ", some nights estimated by phone sensors" : ""}` : undefined} empty={data.sleep.length ? null : 'Log your sleep to see a trend.'}>
        <BarChart data={data.sleep} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceLine y={profile.sleepGoalMin / 60} stroke="var(--ring-sleep)" strokeDasharray="4 4" />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={24} />
          <YAxis {...axis} width={44} />
          <Tooltip {...tip} cursor={{ fill: 'var(--surface-2)' }} labelFormatter={(d) => shortDate(String(d))} formatter={(v) => [minutesToHM(Number(v) * 60), 'Sleep']} />
          <Bar dataKey="hours" fill="var(--ring-sleep)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Chart>

      <Chart title="Steps" color="var(--ring-steps)" summary={data.steps.length ? `Average ${Math.round(avg(data.steps.map((s) => s.steps))).toLocaleString('en-IN')} a day` : undefined} empty={data.steps.length ? null : 'Steps appear here once logged or synced.'}>
        <BarChart data={data.steps} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceLine y={profile.stepGoal} stroke="var(--ring-steps)" strokeDasharray="4 4" />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={24} />
          <YAxis {...axis} width={44} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
          <Tooltip {...tip} cursor={{ fill: 'var(--surface-2)' }} labelFormatter={(d) => shortDate(String(d))} formatter={(v) => [Number(v).toLocaleString('en-IN'), 'Steps']} />
          <Bar dataKey="steps" fill="var(--ring-steps)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Chart>

      <Chart title={days > 7 ? 'Spending by week' : 'Spending by day'} color="var(--money)" summary={data.spend.length ? `${formatINR(data.spend.reduce((a, s) => a + s.rupees, 0) * 100)} in ${days} days` : undefined} empty={data.spend.length ? null : 'No spending recorded in this period.'}>
        <BarChart data={data.spend} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} tickFormatter={(v) => formatINRShort(v * 100)} />
          <Tooltip {...tip} cursor={{ fill: 'var(--surface-2)' }} labelFormatter={(d) => (days > 7 ? `Week of ${shortDate(String(d))}` : shortDate(String(d)))} formatter={(v) => [formatINR(Number(v) * 100), 'Spent']} />
          <Bar dataKey="rupees" fill="var(--money)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Chart>
    </div>
  )
}

function Chart({ title, color, summary, empty, children }: { title: string; color: string; summary?: string; empty: string | null; children: React.ReactElement }) {
  return (
    <section className="mt-7" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color }}>{title}</h2>
        {summary && <p className="text-[13px] text-muted-foreground text-right">{summary}</p>}
      </div>
      <div className="mt-2 h-[180px] border-t border-border pt-2">
        {empty ? <p className="pt-10 text-center text-[14px] text-muted-foreground">{empty}</p> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
      </div>
    </section>
  )
}
