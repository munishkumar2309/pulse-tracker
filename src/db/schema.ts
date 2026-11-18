// On-device database (IndexedDB via Dexie). Schema documented in docs/ARCHITECTURE.md.
// Changing an index → bump the version and add an upgrade step; never edit a released version.
import Dexie, { type EntityTable } from 'dexie'
import type { Activity, BmiStandard, Sex } from '../health/calc'
import type { FoodItem } from '../health/foodSearch'

/** 'phone' = Pulse's own tracking with the phone's sensors (src/native/phone.ts). */
export type Source = 'manual' | 'health_connect' | 'phone' | 'sms' | 'statement' | 'import'

export interface Profile {
  id: 'me'
  name?: string
  sex: Sex
  dob: string // YYYY-MM-DD
  heightCm: number
  activity: Activity
  goalWeightKg: number
  paceKgPerWeek: number // 0, 0.25, 0.5, 0.75
  stepGoal: number
  sleepGoalMin: number
  bmiStandard: BmiStandard
  waterGoalMl?: number // override; default from weight
}

export interface WeightEntry { id?: number; date: string; kg: number; source: Source }
export interface WaterEntry { id?: number; date: string; at: string; ml: number }
export interface StepsDay { date: string; count: number; source: Source }
export interface SleepEntry {
  id?: number
  date: string // day you woke up
  start: string // ISO
  end: string // ISO
  minutes: number
  stages?: { deep?: number; light?: number; rem?: number; awake?: number } // minutes
  source: Source
}

export type TxnType = 'debit' | 'credit'
export type Channel = 'upi' | 'card' | 'netbanking' | 'atm' | 'neft_imps' | 'other'

export interface Transaction {
  id: string // stable hash, used for dedupe
  date: string // YYYY-MM-DD
  at: string // ISO timestamp
  amountPaise: number
  type: TxnType
  account?: string // last 4 digits
  accountKind?: 'bank' | 'card'
  bank?: string
  merchant: string
  merchantKey: string // normalised merchant for rules
  category: string
  channel: Channel
  ref?: string
  source: Source
  raw?: string // original SMS or statement line
  excluded?: boolean // transfers, CC bill payments, etc. (kept out of spend totals)
  userSet?: boolean // category picked by the user; automatic re-categorising never touches it
}

export interface CategoryRule { merchantKey: string; category: string }
export interface Budget { category: string; monthlyPaise: number }

/** Saved foods (Open Food Facts results the user picked, custom foods). Same shape as search results. */
export type Food = FoodItem

export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner'
export interface FoodLog {
  id?: number
  date: string
  meal: Meal
  foodId: string
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Meta { key: string; value: unknown }

/** A GPS-tracked walk/run (src/native/gps.ts, Activity screen). points: [lat, lng, epochMs]. */
export interface Walk {
  id?: number
  date: string
  start: string // ISO
  end: string // ISO
  distanceM: number
  movingS: number // seconds actually moving (pauses excluded)
  points: [number, number, number][]
  kcal?: number
}

export const db = new Dexie('pulse') as Dexie & {
  walks: EntityTable<Walk, 'id'>
  profile: EntityTable<Profile, 'id'>
  weights: EntityTable<WeightEntry, 'id'>
  water: EntityTable<WaterEntry, 'id'>
  steps: EntityTable<StepsDay, 'date'>
  sleep: EntityTable<SleepEntry, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  rules: EntityTable<CategoryRule, 'merchantKey'>
  budgets: EntityTable<Budget, 'category'>
  foods: EntityTable<Food, 'id'>
  foodLogs: EntityTable<FoodLog, 'id'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  profile: 'id',
  weights: '++id, date',
  water: '++id, date',
  steps: 'date',
  sleep: '++id, date',
  transactions: 'id, date, category, merchantKey, type, [date+type]',
  rules: 'merchantKey',
  budgets: 'category',
  foods: 'id, name, barcode, source',
  foodLogs: '++id, date, [date+meal]',
  meta: 'key',
})

// v2 (2026-11-18): GPS walks. Existing tables unchanged.
db.version(2).stores({ walks: '++id, date, start' })
