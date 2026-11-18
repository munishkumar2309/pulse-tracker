// Food photo recognition: turn model output into food choices from Pulse's own data. Pure functions.
// Calories always come from Pulse's dishes/IFCT data (estimates), never from the model, except the
// cloud model's own estimate, used only when nothing in Pulse matches (and labelled as such).
import { DISHES } from '../data/dishes'
import { labelInfo } from '../data/foodLabels'
import { searchFoods, type FoodItem } from './foodSearch'

export interface Guess { label: string; score: number } // on-phone classifier output (score 0–1)

/** What the cloud model returns for each item it sees on the plate. */
export interface CloudItem { name: string; estimated_grams: number; estimated_kcal: number; confidence: 'high' | 'medium' | 'low' }

export interface Recognised {
  name: string // what the model thinks it is
  confidence: number // 0–1
  foods: FoodItem[] // Pulse foods to choose from, best first (may be empty)
  approx: boolean // foods are the closest Pulse has, not the same dish
  grams?: number // suggested portion (cloud only)
  aiKcal?: number // cloud model's own kcal estimate for that portion
}

/** Below this the top guess is shown as "not sure" and the cloud option is offered. */
export const CONFIDENT = 0.5
const MIN_SCORE = 0.08

const dishByName = new Map(DISHES.map((d) => [d.name, d]))
const asFood = (name: string): FoodItem | undefined => {
  const d = dishByName.get(name)
  return d && { ...d, source: 'dish' }
}

/** On-phone guesses → up to 3 distinct dishes with Pulse foods. */
export function fromGuesses(guesses: Guess[]): Recognised[] {
  const out: Recognised[] = []
  for (const g of [...guesses].sort((a, b) => b.score - a.score)) {
    if (out.length >= 3 || (out.length > 0 && g.score < MIN_SCORE)) break
    const info = labelInfo(g.label)
    if (out.some((r) => r.name === info.name)) continue
    const foods = info.dishes.map(asFood).filter((f): f is FoodItem => !!f)
    out.push({ name: info.name, confidence: g.score, foods: foods.length ? foods : searchFoods(info.name, [], 3), approx: !!info.approx })
  }
  return out
}

const CONF = { high: 0.9, medium: 0.6, low: 0.3 } as const

/** Cloud items (several per plate) → Pulse foods by name search; keeps the model's portion and kcal as a hint. */
export function fromCloud(items: CloudItem[], saved: FoodItem[] = []): Recognised[] {
  return items.map((it) => ({
    name: it.name,
    confidence: CONF[it.confidence] ?? 0.3,
    foods: searchFoods(it.name, saved, 3),
    approx: false,
    grams: it.estimated_grams > 0 ? Math.round(it.estimated_grams) : undefined,
    aiKcal: it.estimated_kcal > 0 ? Math.round(it.estimated_kcal) : undefined,
  }))
}

export const needsHelp = (r: Recognised[]) => !r.length || r[0].confidence < CONFIDENT
