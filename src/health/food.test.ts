import { describe, expect, it } from 'vitest'
import { DISHES } from '../data/dishes'
import { LOCAL_FOODS, nutritionFor, searchFoods, servingsFor } from './foodSearch'
import { fromOff } from './openFoodFacts'

describe('local food data', () => {
  it('has IFCT ingredients and dishes', () => {
    expect(LOCAL_FOODS.filter((f) => f.source === 'ifct').length).toBe(542)
    expect(DISHES.length).toBeGreaterThan(90)
  })
  it('dish values convert to per-100 g', () => {
    const roti = DISHES.find((d) => d.name === 'Roti / chapati')!
    expect(roti).toMatchObject({ unit: 'piece', unitGrams: 40, kcal: 275 }) // 110 kcal per 40 g
    expect(nutritionFor(roti, 80).kcal).toBe(220) // 2 rotis
  })
  it('every dish has sane energy (macros roughly add up)', () => {
    // Alcohol (7 kcal/g) isn't in protein/carbs/fat, so drinks with alcohol are exempt.
    for (const d of DISHES.filter((x) => !/beer|wine|whisky|rum/i.test(x.name))) {
      const fromMacros = d.p * 4 + d.c * 4 + d.f * 9
      expect(Math.abs(fromMacros - d.kcal) / d.kcal, d.name).toBeLessThan(0.2)
    }
  })
})

describe('searchFoods', () => {
  it('dishes rank first for everyday words', () => {
    expect(searchFoods('roti')[0].name).toBe('Roti / chapati')
    expect(searchFoods('dal')[0].source).toBe('dish')
    expect(searchFoods('masala dosa')[0].name).toBe('Masala dosa')
  })
  it('finds by Hindi / regional alias', () => {
    expect(searchFoods('chawal').some((f) => f.name === 'Steamed rice')).toBe(true)
    expect(searchFoods('golgappa')[0].name).toBe('Pani puri')
    expect(searchFoods('kela').some((f) => /banana/i.test(f.name))).toBe(true)
  })
  it('all query words must match', () => {
    expect(searchFoods('chicken biryani').map((f) => f.name)).toContain('Chicken biryani')
    expect(searchFoods('chicken biryani').map((f) => f.name)).not.toContain('Veg biryani')
  })
  it('empty query → nothing', () => {
    expect(searchFoods('  ')).toEqual([])
  })
})

describe('servings', () => {
  it('natural unit first, then 100 g and grams', () => {
    expect(servingsFor(DISHES.find((d) => d.name === 'Idli')! as never).map((s) => s.grams)).toEqual([40, 100, 1])
  })
})

describe('Open Food Facts mapping', () => {
  it('maps kcal, macros and serving', () => {
    expect(fromOff({ code: '8901058000290', product_name: 'Parle-G', brands: 'Parle, Parle Products', serving_quantity: 18.8,
      nutriments: { 'energy-kcal_100g': 454, proteins_100g: 6.9, carbohydrates_100g: 77.4, fat_100g: 13 } }))
      .toMatchObject({ id: 'off:8901058000290', name: 'Parle-G', brand: 'Parle', kcal: 454, p: 6.9, unit: 'serving', unitGrams: 18.8 })
  })
  it('drops entries whose kcal contradicts their macros', () => {
    expect(fromOff({ code: '3', product_name: 'Bad', nutriments: { 'energy-kcal_100g': 3, proteins_100g: 7, carbohydrates_100g: 77, fat_100g: 13 } })).toBeNull()
    expect(fromOff({ code: '4', product_name: 'Water', nutriments: { 'energy-kcal_100g': 0 } })?.kcal).toBe(0)
  })
  it('falls back to kJ, rejects products without energy', () => {
    expect(fromOff({ code: '1', product_name: 'X', nutriments: { energy_100g: 1674 } })?.kcal).toBe(400)
    expect(fromOff({ code: '2', product_name: 'Y', nutriments: {} })).toBeNull()
  })
})
