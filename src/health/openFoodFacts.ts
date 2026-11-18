// Open Food Facts (ODbL): packaged foods by barcode or name. No API key.
// Only called when the user asks (search online / scan), results are cached in db.foods.
// Official docs: search is limited to ~10 requests/min per IP, so we never search-as-you-type.
import type { FoodItem } from './foodSearch'

const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,quantity'

interface OffProduct {
  code: string
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

export function fromOff(p: OffProduct): FoodItem | null {
  const n = p.nutriments ?? {}
  const num = (k: string) => (n[k] === undefined || n[k] === '' ? null : Number(n[k]))
  let kcal = num('energy-kcal_100g')
  if (kcal === null && num('energy_100g') !== null) kcal = Math.round(num('energy_100g')! / 4.184) // kJ → kcal
  const name = (p.product_name || p.product_name_en || '').trim()
  if (!name || kcal === null || !Number.isFinite(kcal)) return null
  // Crowd-sourced data: drop entries whose energy contradicts their own macros (e.g. "Parle-G, 3 kcal/100 g").
  const fromMacros = 4 * (num('proteins_100g') ?? 0) + 4 * (num('carbohydrates_100g') ?? 0) + 9 * (num('fat_100g') ?? 0)
  if (fromMacros > 20 && Math.abs(fromMacros - kcal) / fromMacros > 0.35) return null
  const serving = Number(p.serving_quantity)
  return {
    id: `off:${p.code}`, name, brand: p.brands?.split(',')[0]?.trim(), group: 'Packaged',
    kcal: Math.round(kcal), p: num('proteins_100g') ?? 0, c: num('carbohydrates_100g') ?? 0, f: num('fat_100g') ?? 0, fib: num('fiber_100g') ?? undefined,
    unit: serving > 0 ? 'serving' : undefined, unitGrams: serving > 0 ? serving : undefined,
    source: 'off', barcode: p.code,
  }
}

export async function offBarcode(code: string): Promise<FoodItem | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts didn't respond (${res.status}). Try again in a minute.`)
  const json = await res.json()
  return json.status === 1 && json.product ? fromOff({ ...json.product, code }) : null
}

export async function offSearch(query: string): Promise<FoodItem[]> {
  const url = `https://in.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=20&fields=${FIELDS}`
  const res = await fetch(url)
  if (res.status === 429) throw new Error('Too many searches. Wait a minute and try again.')
  if (!res.ok) throw new Error(`Open Food Facts didn't respond (${res.status}). Try again in a minute.`)
  const json = await res.json()
  return (json.products as OffProduct[]).map(fromOff).filter((x): x is FoodItem => !!x)
}
