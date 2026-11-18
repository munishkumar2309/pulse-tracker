// Live-query hooks shared by screens. Components re-render when the DB changes.
import { useLiveQuery } from 'dexie-react-hooks'
import { ageFromDob, bmi, bmiCategory, bmr, calorieTarget, healthyWeightRange, proteinTargetG, tdee, waterTargetMl } from '../health/calc'
import { readiness } from '../health/recovery'
import { dayKey } from '../lib/format'
import { isSpend } from '../money/insights'
import { db, type Profile } from './schema'

/** undefined = still loading, null = no profile yet (first run). */
export const useProfile = () => useLiveQuery(async (): Promise<Profile | null> => (await db.profile.get('me')) ?? null, [])

export function useLatestWeight() {
  return useLiveQuery(() => db.weights.orderBy('date').last(), [])
}

/** Targets derived from profile + latest weight. */
export function targetsFor(p: Profile, weightKg: number) {
  const age = ageFromDob(p.dob)
  const b = bmr(weightKg, p.heightCm, age, p.sex)
  const t = tdee(b, p.activity)
  const cal = calorieTarget(t, p.paceKgPerWeek, p.sex)
  const bmiVal = bmi(weightKg, p.heightCm)
  return {
    age, bmr: b, tdee: t, calories: cal,
    protein: proteinTargetG(weightKg),
    waterMl: p.waterGoalMl ?? waterTargetMl(weightKg),
    bmi: bmiVal, bmiCat: bmiCategory(bmiVal, p.bmiStandard),
    healthy: healthyWeightRange(p.heightCm, p.bmiStandard),
  }
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

/** Everything the Today screen shows, in one live query. */
export function useToday() {
  return useLiveQuery(async () => {
    const today = dayKey()
    const [steps, water, food, sleepToday, recentSleep, stepsHist, txns, budgets] = await Promise.all([
      db.steps.get(today),
      db.water.where('date').equals(today).toArray(),
      db.foodLogs.where('date').equals(today).toArray(),
      db.sleep.where('date').equals(today).toArray(),
      db.sleep.where('date').between(daysAgo(7), today, true, true).toArray(),
      db.steps.where('date').between(daysAgo(15), daysAgo(1), true, true).toArray(),
      db.transactions.where('date').equals(today).toArray(),
      db.budgets.toArray(),
    ])
    const sleepMin = sleepToday.length ? sleepToday.reduce((a, s) => a + s.minutes, 0) : null
    const nightMin = (date: string) => recentSleep.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0)
    const prevNights = [1, 2, 3].map((n) => daysAgo(n)).filter((d) => recentSleep.some((s) => s.date === d)).map(nightMin)
    // Main sleep per night (longest entry) for regularity; naps would skew bed/wake times.
    const mainSleeps = [...new Map(recentSleep.sort((a, b) => a.minutes - b.minutes).map((s) => [s.date, s])).values()]
    const yesterday = stepsHist.find((s) => s.date === daysAgo(1))?.count ?? null
    const hist = stepsHist.filter((s) => s.date !== daysAgo(1))
    const avg14 = hist.length ? hist.reduce((a, s) => a + s.count, 0) / hist.length : null
    const profile = await db.profile.get('me')
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthlyBudget = budgets.reduce((a, b) => a + b.monthlyPaise, 0)
    return {
      today,
      steps: steps?.count ?? 0,
      waterMl: water.reduce((a, w) => a + w.ml, 0),
      kcal: Math.round(food.reduce((a, f) => a + f.kcal, 0)),
      protein: Math.round(food.reduce((a, f) => a + f.protein, 0)),
      sleepMin,
      spentPaise: txns.filter(isSpend).reduce((a, t) => a + t.amountPaise, 0),
      dailyBudgetPaise: monthlyBudget ? Math.round(monthlyBudget / daysInMonth) : null,
      readiness: readiness({
        lastSleepMin: sleepMin,
        sleepGoalMin: profile?.sleepGoalMin ?? 480,
        prevNightsMin: prevNights,
        recentBedtimes: mainSleeps.map((s) => s.start),
        recentWaketimes: mainSleeps.map((s) => s.end),
        yesterdaySteps: yesterday,
        avgSteps14d: avg14,
      }),
    }
  }, [])
}
