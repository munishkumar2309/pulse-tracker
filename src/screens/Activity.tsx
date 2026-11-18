// Activity: today's steps + 7-day chart, GPS walk/run tracking with a live route map, past walks.
import { useLiveQuery } from 'dexie-react-hooks'
import { Footprints, MapPin, Pause, Play, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis } from 'recharts'
import { AnimatedNumber, Page, Tile } from '../components/motion'
import { RouteMap } from '../components/RouteMap'
import { Sheet } from '../components/Sheet'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../components/ui/chart'
import { useLatestWeight, useProfile } from '../db/hooks'
import { db, type Walk } from '../db/schema'
import { acceptFix, formatDuration, formatPace, kcalEstimate, paceMinPerKm, type Fix } from '../health/geo'
import { dayKey } from '../lib/format'
import { startTracking, type Tracker } from '../native/gps'
import { success, tap, warning } from '../native/haptics'

const stepsChart = { steps: { label: 'Steps', color: 'var(--steps)' } } satisfies ChartConfig

export function Activity() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const week = useLiveQuery(async () => {
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return dayKey(d) })
    const rows = await db.steps.where('date').anyOf(days).toArray()
    return days.map((date) => ({ date, day: new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' }), steps: rows.find((r) => r.date === date)?.count ?? 0 }))
  }, [])
  const walks = useLiveQuery(() => db.walks.orderBy('start').reverse().limit(30).toArray(), [])
  const [open, setOpen] = useState<Walk | null>(null)
  if (!profile || !week || !walks) return null
  const today = week[6].steps

  return (
    <Page>
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">Activity</h1>

      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><Footprints size={15} style={{ color: 'var(--steps)' }} /> Steps today</p>
            <p><AnimatedNumber value={today} className="text-[34px]" /><span className="text-[14px] text-muted-foreground"> / {profile.stepGoal.toLocaleString('en-IN')}</span></p>
          </div>
          <p className="text-[13px] text-muted-foreground text-right">7-day average<br /><span className="num-tight text-[15px] font-semibold text-foreground">{Math.round(week.reduce((a, d) => a + d.steps, 0) / 7).toLocaleString('en-IN')}</span></p>
        </div>
        <ChartContainer config={stepsChart} className="mt-3 h-[150px] w-full">
          <BarChart data={week} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} />
            <ReferenceLine y={profile.stepGoal} stroke="var(--steps)" strokeDasharray="4 4" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="steps" fill="var(--color-steps)" radius={8} animationDuration={900} />
          </BarChart>
        </ChartContainer>
      </div>

      <Tracker weightKg={weight?.kg ?? profile.goalWeightKg} />

      <section className="mt-6">
        <h2 className="mb-2 text-[17px] font-semibold">Past walks and runs</h2>
        {walks.length === 0 && <p className="text-[14px] text-muted-foreground">Start a walk above. Your route, distance and pace are saved here.</p>}
        <div className="space-y-2.5">
          {walks.map((w) => (
            <Tile key={w.id} onClick={() => setOpen(w)} label={`Walk on ${w.date}`} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary"><MapPin size={18} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{(w.distanceM / 1000).toFixed(2)} km</span>
                <span className="block text-[12.5px] text-muted-foreground">{new Date(w.start).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}, {formatDuration(w.movingS)}, {formatPace(paceMinPerKm(w.distanceM, w.movingS))} /km</span>
              </span>
              {w.kcal ? <span className="text-[13px] text-muted-foreground">{w.kcal} kcal</span> : null}
            </Tile>
          ))}
        </div>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Walk">
        {open && (
          <div>
            <RouteMap points={open.points.map(([a, b]) => [a, b])} height={280} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Distance" value={`${(open.distanceM / 1000).toFixed(2)} km`} />
              <Stat label="Time" value={formatDuration(open.movingS)} />
              <Stat label="Pace" value={`${formatPace(paceMinPerKm(open.distanceM, open.movingS))} /km`} />
            </div>
            {open.kcal ? <p className="mt-3 text-center text-[13px] text-muted-foreground">About {open.kcal} kcal burned (estimate from speed and your weight)</p> : null}
            <button type="button" onClick={async () => { await db.walks.delete(open.id!); setOpen(null) }} className="mt-5 w-full rounded-[14px] border border-border py-3 text-[15px] font-semibold text-destructive">Delete this walk</button>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[14px] bg-muted py-3"><p className="num text-[18px]">{value}</p><p className="text-[12px] text-muted-foreground">{label}</p></div>
}

type State = 'idle' | 'tracking' | 'paused'

function Tracker({ weightKg }: { weightKg: number }) {
  const [state, setState] = useState<State>('idle')
  const [points, setPoints] = useState<[number, number, number][]>([])
  const [distance, setDistance] = useState(0)
  const [moving, setMoving] = useState(0)
  const [error, setError] = useState('')
  const tracker = useRef<Tracker | null>(null)
  const last = useRef<Fix | null>(null)
  const stateRef = useRef<State>('idle')
  const startedAt = useRef<number>(0)
  stateRef.current = state

  // Clock: count moving seconds while tracking.
  useEffect(() => {
    if (state !== 'tracking') return
    const id = setInterval(() => setMoving((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  // Stop GPS if the screen is left mid-walk.
  useEffect(() => () => { tracker.current?.stop() }, [])

  async function start() {
    tap()
    setError(''); setPoints([]); setDistance(0); setMoving(0); last.current = null
    startedAt.current = Date.now()
    setState('tracking')
    tracker.current = await startTracking((f) => {
      if (stateRef.current !== 'tracking') return
      const r = acceptFix(last.current, f)
      if (!r.ok) return
      last.current = f
      setDistance((d) => d + r.meters)
      setPoints((p) => [...p, [f.lat, f.lng, f.t]])
    }, (msg) => { setError(msg); warning() })
  }

  function pause() { tap(); setState('paused') }
  function resume() { tap(); last.current = null; setState('tracking') } // no straight-line jump across the pause

  async function finish() {
    await tracker.current?.stop()
    tracker.current = null
    if (distance >= 20 && points.length > 1) {
      await db.walks.add({
        date: dayKey(new Date(startedAt.current)), start: new Date(startedAt.current).toISOString(), end: new Date().toISOString(),
        distanceM: Math.round(distance), movingS: moving, points, kcal: kcalEstimate(distance, moving, weightKg),
      })
      success()
    }
    setState('idle')
  }

  const pace = useMemo(() => formatPace(paceMinPerKm(distance, moving)), [distance, moving])

  return (
    <div className="card mt-3 p-4">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'idle' ? (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-4">
            <motion.button type="button" onClick={start} whileTap={{ scale: 0.9 }} aria-label="Start tracking a walk"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play size={26} fill="currentColor" />
            </motion.button>
            <div>
              <p className="text-[16px] font-semibold">Track a walk or run</p>
              <p className="text-[13px] text-muted-foreground">GPS maps your route and measures distance and pace. It keeps going with the screen off.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <RouteMap points={points.map(([a, b]) => [a, b])} follow height={240} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Distance" value={`${(distance / 1000).toFixed(2)} km`} />
              <Stat label="Time" value={formatDuration(moving)} />
              <Stat label="Pace /km" value={pace} />
            </div>
            {points.length === 0 && !error && <p className="mt-3 text-center text-[13px] text-muted-foreground">Finding GPS… step outside for a better signal.</p>}
            <div className="mt-4 flex gap-3">
              {state === 'tracking'
                ? <CtlBtn onClick={pause} label="Pause" icon={<Pause size={18} />} />
                : <CtlBtn onClick={resume} label="Resume" icon={<Play size={18} />} />}
              <CtlBtn onClick={finish} label="Finish" icon={<Square size={16} fill="currentColor" />} danger />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-3 text-[13.5px] text-destructive" role="alert">{error}</p>}
    </div>
  )
}

function CtlBtn({ onClick, label, icon, danger }: { onClick: () => void; label: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.95 }}
      className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3 text-[15px] font-semibold ${danger ? 'bg-destructive text-white' : 'bg-muted'}`}>
      {icon}{label}
    </motion.button>
  )
}
