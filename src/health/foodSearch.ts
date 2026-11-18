// Food search over: curated dishes (estimates) + IFCT 2017 ingredients + saved foods (Open Food Facts, custom).
import { DISHES } from '../data/dishes'
import IFCT from '../data/ifct.json'

export interface FoodItem {
  id: string
  name: string
  aliases?: string // extra search words (Hindi/regional names)
  group: string
  kcal: number // per 100 g
  p: number
  c: number
  f: number
  fib?: number
  unit?: string // natural serving, e.g. "katori", "piece"
  unitGrams?: number
  estimate?: boolean
  source: 'dish' | 'ifct' | 'off' | 'custom'
  brand?: string
  barcode?: string
}

type IfctRow = { id: string; name: string; group: string; hi?: string; kcal: number; p: number; c: number; f: number; fib: number }

export const LOCAL_FOODS: FoodItem[] = [
  ...DISHES.map((d) => ({ ...d, source: 'dish' as const })),
  ...(IFCT as IfctRow[]).map((r) => ({ id: r.id, name: r.name, aliases: r.hi, group: r.group, kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib, source: 'ifct' as const })),
]

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Rank: name starts with query > a name word starts with a query word > alias match.
 * Every query word must match somewhere. Dishes get a small boost (people log meals, not raw ingredients).
 */
export function searchFoods(query: string, extra: FoodItem[] = [], limit = 30): FoodItem[] {
  const q = norm(query)
  if (!q) return []
  const words = q.split(' ')
  const scored: { f: FoodItem; s: number }[] = []
  for (const f of [...extra, ...LOCAL_FOODS]) {
    const name = norm(f.name)
    const hay = `${name} ${norm(f.aliases ?? '')} ${norm(f.brand ?? '')}`
    const hayWords = hay.split(' ')
    if (!words.every((w) => hayWords.some((h) => h.startsWith(w)))) continue
    const nameWords = name.split(' ')
    let s = 0
    if (name.startsWith(q)) s += 100
    s += words.filter((w) => nameWords.some((h) => h.startsWith(w))).length * 20
    if (f.source === 'dish') s += 15
    if (f.source === 'off' || f.source === 'custom') s += 10 // things the user already picked before
    if (/raw|dry|fresh/.test(name) && f.source === 'ifct') s += 2
    s -= name.length / 20 // prefer shorter, more generic names
    scored.push({ f, s })
  }
  const seen = new Set<string>()
  return scored
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f)
    .filter((f) => !seen.has(f.id) && seen.add(f.id))
    .slice(0, limit)
}

export function nutritionFor(f: Pick<FoodItem, 'kcal' | 'p' | 'c' | 'f'>, grams: number) {
  const k = grams / 100
  const r = (n: number) => Math.round(n * k * 10) / 10
  return { kcal: Math.round(f.kcal * k), protein: r(f.p), carbs: r(f.c), fat: r(f.f) }
}

/** Serving choices for the portion picker: the natural unit (if any) and grams. */
export function servingsFor(f: FoodItem): { label: string; grams: number }[] {
  const out = f.unit && f.unitGrams ? [{ label: `${f.unit} (${f.unitGrams} g)`, grams: f.unitGrams }] : []
  return [...out, { label: '100 g', grams: 100 }, { label: 'grams', grams: 1 }]
}
