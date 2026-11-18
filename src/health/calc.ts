// Pure health formulas. Every formula's source is listed in docs/HEALTH.md.

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type BmiStandard = 'asian' | 'who'
export type BmiCategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese'

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** Upper bound of each band (exclusive): [underweight, normal, overweight]. */
const BMI_BANDS: Record<BmiStandard, [number, number, number]> = {
  asian: [18.5, 23, 25], // WHO expert consultation 2004 / Indian consensus 2009
  who: [18.5, 25, 30],
}

/** Energy in 1 kg of body fat, the usual planning figure. */
export const KCAL_PER_KG = 7700

const round = (n: number, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return round(weightKg / (m * m), 1)
}

export function bmiCategory(value: number, standard: BmiStandard = 'asian'): BmiCategory {
  const [under, normal, over] = BMI_BANDS[standard]
  if (value < under) return 'Underweight'
  if (value < normal) return 'Normal'
  if (value < over) return 'Overweight'
  return 'Obese'
}

/** Healthy weight range (kg) for a height: BMI 18.5 to just under the normal upper bound. */
export function healthyWeightRange(heightCm: number, standard: BmiStandard = 'asian') {
  const m2 = (heightCm / 100) ** 2
  const upperBmi = standard === 'asian' ? 22.9 : 24.9
  return { min: round(18.5 * m2, 1), max: round(upperBmi * m2, 1) }
}

/** Basal metabolic rate, Mifflin-St Jeor (kcal/day). */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161))
}

export function tdee(bmrKcal: number, activity: Activity): number {
  return round(bmrKcal * ACTIVITY_FACTOR[activity])
}

/** Minimum daily intake we will suggest without medical supervision. */
export const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 }

/**
 * Daily calorie target for losing `paceKgPerWeek` (0 = maintain).
 * Never goes below MIN_KCAL; `floored` tells the UI to say so.
 */
export function calorieTarget(tdeeKcal: number, paceKgPerWeek: number, sex: Sex) {
  const deficit = round((paceKgPerWeek * KCAL_PER_KG) / 7)
  const raw = tdeeKcal - deficit
  const kcal = Math.max(raw, MIN_KCAL[sex])
  return { kcal, deficit: tdeeKcal - kcal, floored: raw < MIN_KCAL[sex] }
}

/** Daily water target ≈ 35 ml per kg body weight, rounded to 100 ml. */
export function waterTargetMl(weightKg: number): number {
  return Math.round((weightKg * 35) / 100) * 100
}

/** Protein target for weight loss: 1.2 g per kg body weight (ICMR RDA is 0.83 g/kg; higher helps preserve muscle in a deficit). */
export function proteinTargetG(weightKg: number): number {
  return round(weightKg * 1.2)
}

/** Weeks and calendar date to reach goal weight at a steady pace. Null if pace is 0 or already there. */
export function projectGoal(currentKg: number, goalKg: number, paceKgPerWeek: number, from = new Date()) {
  const toLose = currentKg - goalKg
  if (toLose <= 0 || paceKgPerWeek <= 0) return null
  const weeks = Math.ceil(toLose / paceKgPerWeek)
  const date = new Date(from)
  date.setDate(date.getDate() + weeks * 7)
  return { weeks, date }
}

export function ageFromDob(dobIso: string, today = new Date()): number {
  const dob = new Date(dobIso)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}
