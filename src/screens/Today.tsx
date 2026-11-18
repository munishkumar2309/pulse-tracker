// Today (Fitbit-style): header → hero steps ring with mini stats → readiness → 2-column tile grid.
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, BarChart3, Droplet, Footprints, IndianRupee, Moon, Plus, Scale, Target, Utensils } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LogSheets, type LogKind } from '../components/LogSheets'
import { AnimatedNumber, IconDot, Page, Tile } from '../components/motion'
import { BAND } from '../components/ReadinessArc'
import { Ring } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { targetsFor, useLatestWeight, useProfile, useToday } from '../db/hooks'
import { db } from '../db/schema'
import { projectGoal } from '../health/calc'
import { dayKey, formatINR, minutesToHM } from '../lib/format'
import { success, tap } from '../native/haptics'

export function Today() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const t = useToday()
  const nav = useNavigate()
  const lastWalk = useLiveQuery(() => db.walks.orderBy('start').last(), [])
  const [log, setLog] = useState<LogKind>(null)
  const [explain, setExplain] = useState(false)
  if (!profile || !t) return null

  const kg = weight?.kg ?? profile.goalWeightKg
  const tg = targetsFor(profile, kg)
  const goal = projectGoal(kg, profile.goalWeightKg, profile.paceKgPerWeek)
  const toGo = Math.round((kg - profile.goalWeightKg) * 10) / 10
  const band = t.readiness ? BAND[t.readiness.band] : null
  const kcalLeft = tg.calories.kcal - t.kcal
  const addWater = async (ml: number) => {
    await db.water.add({ date: dayKey(), at: new Date().toISOString(), ml })
    if (t.waterMl < tg.waterMl && t.waterMl + ml >= tg.waterMl) success()
    else tap()
  }

  return (
    <Page>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-[28px] font-bold tracking-tight">Today</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/trends" aria-label="Trends" className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)]"><BarChart3 size={19} /></Link>
          <Link to="/settings" aria-label="Profile and settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[16px] font-semibold text-primary-foreground">
            {(profile.name?.trim()[0] ?? 'P').toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Hero: steps */}
      <Tile onClick={() => setLog('steps')} label="Steps today" className="flex items-center gap-5 !p-5">
        <Ring value={t.steps} goal={profile.stepGoal} color="var(--steps)" size={150} stroke={14} label={`${t.steps} of ${profile.stepGoal} steps`}>
          <div className="flex flex-col items-center">
            <Footprints size={18} style={{ color: 'var(--steps)' }} />
            <AnimatedNumber value={t.steps} className="text-[28px] leading-tight" />
            <span className="text-[12px] text-muted-foreground">of {profile.stepGoal.toLocaleString('en-IN')}</span>
          </div>
        </Ring>
        <div className="min-w-0 flex-1 space-y-3">
          <MiniStat icon={<Utensils size={15} />} color="var(--food)" label="Eaten" value={`${t.kcal.toLocaleString('en-IN')} kcal`} pct={t.kcal / tg.calories.kcal} />
          <MiniStat icon={<Droplet size={15} />} color="var(--water)" label="Water" value={`${(t.waterMl / 1000).toFixed(1)} / ${(tg.waterMl / 1000).toFixed(1)} L`} pct={t.waterMl / tg.waterMl} />
          <MiniStat icon={<Moon size={15} />} color="var(--sleep)" label="Sleep" value={t.sleepMin ? minutesToHM(t.sleepMin) : 'Not logged'} pct={(t.sleepMin ?? 0) / profile.sleepGoalMin} />
        </div>
      </Tile>

      {/* Readiness */}
      <Tile onClick={() => setExplain(true)} label="Readiness" className="mt-3 flex items-center gap-4">
        <Ring value={t.readiness?.score ?? 0} goal={100} color={band?.color ?? 'var(--muted-foreground)'} size={64} stroke={7}>
          <span className="num text-[20px]" style={{ color: band?.color }}>{t.readiness ? <AnimatedNumber value={t.readiness.score} /> : '--'}</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Readiness (estimate)</p>
          <p className="text-[16px] font-semibold">{band ? band.text : 'Log last night’s sleep'}</p>
          <p className="text-[12.5px] text-muted-foreground">From your sleep, bedtime and yesterday’s steps</p>
        </div>
      </Tile>

      <motion.div className="mt-3 grid grid-cols-2 gap-3" initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <GridItem>
          <Tile onClick={() => setLog('sleep')} label="Sleep" className="h-full">
            <TileHead icon={<Moon size={16} />} color="var(--sleep)" title="Sleep" />
            <p className="mt-3 num text-[24px]">{t.sleepMin ? minutesToHM(t.sleepMin) : '--'}</p>
            <p className="text-[12.5px] text-muted-foreground">{t.sleepFromPhone ? 'From phone sensors (estimate)' : `Goal ${minutesToHM(profile.sleepGoalMin)}`}</p>
          </Tile>
        </GridItem>
        <GridItem>
          <div className="card h-full p-4">
            <TileHead icon={<Droplet size={16} />} color="var(--water)" title="Water" />
            <p className="mt-3"><AnimatedNumber value={t.waterMl / 1000} format={(n) => n.toFixed(1)} className="text-[24px]" /><span className="text-[13px] text-muted-foreground"> L</span></p>
            <div className="mt-2 flex gap-1.5">
              <QuickBtn onClick={() => addWater(250)}>250 ml</QuickBtn>
              <QuickBtn onClick={() => setLog('water')} aria="More water options"><Plus size={14} /></QuickBtn>
            </div>
          </div>
        </GridItem>
        <GridItem>
          <Tile onClick={() => nav('/food')} label="Food" className="h-full">
            <TileHead icon={<Utensils size={16} />} color="var(--food)" title="Food" />
            <p className="mt-3 num text-[24px]">{Math.abs(kcalLeft).toLocaleString('en-IN')}</p>
            <p className="text-[12.5px] text-muted-foreground">{kcalLeft >= 0 ? 'kcal left today' : 'kcal over target'}</p>
          </Tile>
        </GridItem>
        <GridItem>
          <Tile onClick={() => setLog('weight')} label="Weight" className="h-full">
            <TileHead icon={<Scale size={16} />} color="var(--weight)" title="Weight" />
            <p className="mt-3"><span className="num text-[24px]">{kg.toFixed(1)}</span><span className="text-[13px] text-muted-foreground"> kg</span></p>
            <p className="text-[12.5px] text-muted-foreground">{toGo > 0 ? `${toGo} kg to goal` : 'At your goal'}</p>
          </Tile>
        </GridItem>
        <GridItem>
          <Tile onClick={() => nav('/trends')} label="BMI" className="h-full">
            <TileHead icon={<Target size={16} />} color={tg.bmiCat === 'Normal' ? 'var(--ok)' : 'var(--warn)'} title="BMI" />
            <p className="mt-3 num text-[24px]">{tg.bmi.toFixed(1)}</p>
            <p className="text-[12.5px]" style={{ color: tg.bmiCat === 'Normal' ? 'var(--ok)' : 'var(--warn)' }}>{tg.bmiCat}{profile.bmiStandard === 'asian' ? ' (Asian range)' : ''}</p>
          </Tile>
        </GridItem>
        <GridItem>
          <Tile onClick={() => nav('/money')} label="Spent today" className="h-full">
            <TileHead icon={<IndianRupee size={16} />} color="var(--primary)" title="Spent today" />
            <p className="mt-3 num text-[24px]">{formatINR(t.spentPaise)}</p>
            {t.dailyBudgetPaise ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (t.spentPaise / t.dailyBudgetPaise) * 100)}%` }}
                  transition={{ duration: 0.8 }} style={{ background: t.spentPaise > t.dailyBudgetPaise ? 'var(--bad)' : 'var(--primary)' }} />
              </div>
            ) : <p className="text-[12.5px] text-muted-foreground">Set budgets in Settings</p>}
          </Tile>
        </GridItem>
        <GridItem>
          <Tile onClick={() => nav('/activity')} label="Activity" className="h-full">
            <TileHead icon={<Activity size={16} />} color="var(--steps)" title="Last walk" />
            <p className="mt-3 num text-[24px]">{lastWalk ? (lastWalk.distanceM / 1000).toFixed(2) : '--'}<span className="text-[13px] font-normal text-muted-foreground"> km</span></p>
            <p className="text-[12.5px] text-muted-foreground">{lastWalk ? new Date(lastWalk.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Track one with GPS'}</p>
          </Tile>
        </GridItem>
        <GridItem>
          <Tile onClick={() => setLog('weight')} label="Goal date" className="h-full">
            <TileHead icon={<Target size={16} />} color="var(--primary)" title="Goal date" />
            <p className="mt-3 num text-[24px]">{goal ? goal.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</p>
            <p className="text-[12.5px] text-muted-foreground">{goal ? `${goal.weeks} weeks at ${profile.paceKgPerWeek} kg/wk` : 'Set a pace'}</p>
          </Tile>
        </GridItem>
      </motion.div>

      <LogSheets kind={log} onClose={() => setLog(null)} lastWeight={kg} />
      <Sheet open={explain} onClose={() => setExplain(false)} title="How readiness is worked out">
        <div className="text-[15px] leading-relaxed space-y-3">
          <p>Readiness is an estimate from your sleep and steps of how ready your body is for today. It isn't a medical measurement.</p>
          <ul className="space-y-2">
            <li><b>Sleep (60%)</b> compares last night with what you needed{t.readiness ? <>: {minutesToHM(t.readiness.sleepNeedMin)}, your goal plus some catch-up for short nights. <span className="text-muted-foreground">Today {t.readiness.parts.sleep}/100.</span></> : '.'}</li>
            <li><b>Regular schedule (25%)</b> rewards going to bed and waking at similar times.{' '}
              {t.readiness?.parts.regularity != null ? <span className="text-muted-foreground">Today {t.readiness.parts.regularity}/100.</span> : <span className="text-muted-foreground">Needs 3 nights; you have {t.readiness?.regularityNights ?? 0}.</span>}</li>
            <li><b>Yesterday's effort (15%)</b> drops when yesterday's steps were far above your 2-week average.{t.readiness?.parts.load != null && <span className="text-muted-foreground"> Today {t.readiness.parts.load}/100.</span>}</li>
          </ul>
          <p className="text-muted-foreground">70 and above is Ready, 40 to 69 is Steady, below 40 is Go easy.</p>
        </div>
      </Sheet>
    </Page>
  )
}

const GridItem = ({ children }: { children: React.ReactNode }) => (
  <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>{children}</motion.div>
)

function TileHead({ icon, color, title }: { icon: React.ReactNode; color: string; title: string }) {
  return <div className="flex items-center gap-2"><IconDot color={color}>{icon}</IconDot><span className="text-[14px] font-medium">{title}</span></div>
}

function MiniStat({ icon, color, label, value, pct }: { icon: React.ReactNode; color: string; label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="flex items-center gap-1.5 text-muted-foreground" style={{ color }}>{icon}<span className="text-muted-foreground">{label}</span></span>
        <span className="num-tight font-semibold truncate">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, pct) * 100)}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
    </div>
  )
}

function QuickBtn({ children, onClick, aria }: { children: React.ReactNode; onClick: () => void; aria?: string }) {
  return (
    <motion.button type="button" aria-label={aria} whileTap={{ scale: 0.9 }} onClick={onClick}
      className="flex h-8 items-center justify-center rounded-full px-3 text-[12.5px] font-semibold" style={{ background: 'color-mix(in srgb, var(--water) 15%, transparent)', color: 'var(--water)' }}>
      {children}
    </motion.button>
  )
}
