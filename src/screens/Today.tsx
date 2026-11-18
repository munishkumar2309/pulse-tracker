// Today: readiness arc → four rings → body numbers → today's money.
import { useState } from 'react'
import { Link } from 'react-router'
import { LogSheets, type LogKind } from '../components/LogSheets'
import { ReadinessArc } from '../components/ReadinessArc'
import { Ring } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { targetsFor, useLatestWeight, useProfile, useToday } from '../db/hooks'
import { projectGoal } from '../health/calc'
import { formatINR, minutesToHM } from '../lib/format'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Today() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const t = useToday()
  const [log, setLog] = useState<LogKind>(null)
  const [explain, setExplain] = useState(false)
  if (!profile || !t) return null

  const kg = weight?.kg ?? profile.goalWeightKg
  const tg = targetsFor(profile, kg)
  const goal = projectGoal(kg, profile.goalWeightKg, profile.paceKgPerWeek)
  const toGo = Math.round((kg - profile.goalWeightKg) * 10) / 10
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="px-4 pt-5">
      <header className="mb-1">
        <p className="text-[13px] text-muted">{dateLabel}</p>
        <h1 className="text-[22px] font-semibold">{greeting()}{profile.name ? `, ${profile.name}` : ''}</h1>
      </header>

      <ReadinessArc r={t.readiness} onExplain={() => setExplain(true)} />

      <div className="grid grid-cols-4 gap-1 mt-1">
        <Ring label="Steps" value={t.steps} goal={profile.stepGoal} color="var(--ring-steps)" display={t.steps >= 10000 ? `${(t.steps / 1000).toFixed(1)}k` : t.steps.toLocaleString('en-IN')} onClick={() => setLog('steps')} />
        <Link to="/food" className="contents">
          <Ring label="kcal eaten" value={t.kcal} goal={tg.calories.kcal} color="var(--ring-food)" display={t.kcal.toLocaleString('en-IN')} />
        </Link>
        <Ring label="Water" value={t.waterMl} goal={tg.waterMl} color="var(--ring-water)" display={(t.waterMl / 1000).toFixed(1)} unit=" L" onClick={() => setLog('water')} />
        <Ring label="Sleep" value={t.sleepMin ?? 0} goal={profile.sleepGoalMin} color="var(--ring-sleep)" display={t.sleepMin ? minutesToHM(t.sleepMin) : '--'} onClick={() => setLog('sleep')} />
      </div>

      <section className="mt-7" aria-label="Body">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-body">Body</h2>
          <button type="button" onClick={() => setLog('weight')} className="text-[14px] text-body font-medium py-1">Log weight</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
          <Stat label="Weight" value={kg.toFixed(1)} unit="kg" sub={toGo > 0 ? `${toGo} kg to your goal` : 'At or below your goal'} />
          <Stat label="BMI" value={tg.bmi.toFixed(1)} sub={`${tg.bmiCat}${profile.bmiStandard === 'asian' ? ' (Asian range)' : ''}`} subTone={tg.bmiCat === 'Normal' ? 'ok' : 'warn'} />
          <Stat label="Eat today" value={tg.calories.kcal.toLocaleString('en-IN')} unit="kcal" sub={tg.calories.floored ? 'Kept at a safe minimum' : `${tg.calories.deficit} under what you burn`} />
          <Stat label="Goal date" value={goal ? goal.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} sub={goal ? `${goal.weeks} weeks at ${profile.paceKgPerWeek} kg/week` : 'Set a pace to get a date'} />
        </div>
      </section>

      <section className="mt-7" aria-label="Money today">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-money">Money</h2>
          <Link to="/money" className="text-[14px] text-money font-medium py-1">See spending</Link>
        </div>
        <div className="mt-2 border-t border-line pt-4">
          <p className="text-[13px] text-muted">Spent today</p>
          <p className="num text-[34px] font-bold leading-tight">{formatINR(t.spentPaise)}</p>
          {t.dailyBudgetPaise ? (
            <>
              <div className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round((t.spentPaise / t.dailyBudgetPaise) * 100)}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.spentPaise / t.dailyBudgetPaise) * 100)}%`, background: t.spentPaise > t.dailyBudgetPaise ? 'var(--bad)' : 'var(--money)' }} />
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                {t.spentPaise > t.dailyBudgetPaise ? `${formatINR(t.spentPaise - t.dailyBudgetPaise)} over today's share of your budget` : `${formatINR(t.dailyBudgetPaise - t.spentPaise)} left of today's share of your budget`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Set monthly budgets in Settings to see a daily allowance.</p>
          )}
        </div>
      </section>

      <LogSheets kind={log} onClose={() => setLog(null)} lastWeight={kg} />
      <Sheet open={explain} onClose={() => setExplain(false)} title="How readiness is worked out">
        <div className="text-[15px] leading-relaxed space-y-3">
          <p>Readiness is an estimate from your sleep and steps of how ready your body is for today. It isn't a medical measurement.</p>
          <ul className="space-y-2">
            <li><b>Sleep (60%)</b> compares last night with what you needed{t.readiness ? <>: {minutesToHM(t.readiness.sleepNeedMin)}, your goal plus some catch-up for short nights earlier this week. <span className="text-muted">Today {t.readiness.parts.sleep}/100.</span></> : '.'}</li>
            <li><b>Regular schedule (25%)</b> rewards going to bed and waking at similar times.{' '}
              {t.readiness?.parts.regularity != null
                ? <span className="text-muted">Today {t.readiness.parts.regularity}/100.</span>
                : <span className="text-muted">Needs 3 nights; you have {t.readiness?.regularityNights ?? 0}.</span>}</li>
            <li><b>Yesterday's effort (15%)</b> drops when yesterday's steps were far above your 2-week average.{t.readiness?.parts.load != null && <span className="text-muted"> Today {t.readiness.parts.load}/100.</span>}</li>
          </ul>
          <p className="text-muted">70 and above is Ready, 40 to 69 is Steady, below 40 is Go easy. Parts without enough data are left out and the rest re-weighted.</p>
        </div>
      </Sheet>
    </div>
  )
}

function Stat({ label, value, unit, sub, subTone }: { label: string; value: string; unit?: string; sub: string; subTone?: 'ok' | 'warn' }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="num text-[26px] font-bold leading-tight">{value}{unit && <span className="text-[13px] font-normal text-muted"> {unit}</span>}</p>
      <p className={`text-[12.5px] ${subTone === 'ok' ? 'text-ok' : subTone === 'warn' ? 'text-body' : 'text-muted'}`}>{sub}</p>
    </div>
  )
}
