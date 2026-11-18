import { describe, expect, it } from 'vitest'
import { DISHES } from '../data/dishes'
import { FOOD_LABELS, labelInfo, labelKey } from '../data/foodLabels'
import { fromCloud, fromGuesses, needsHelp } from './foodVision'

describe('food photo labels', () => {
  it('every mapped dish exists in dishes.ts', () => {
    const names = new Set(DISHES.map((d) => d.name))
    const missing = Object.values(FOOD_LABELS).flatMap((l) => l.dishes).filter((d) => !names.has(d))
    expect(missing).toEqual([])
  })
  it('covers the 80 model labels, most with a Pulse dish', () => {
    expect(Object.keys(FOOD_LABELS)).toHaveLength(80)
    expect(Object.values(FOOD_LABELS).filter((l) => l.dishes.length).length).toBe(66)
  })
  it('normalises label spelling', () => {
    expect(labelKey('Gulab Jamun')).toBe('gulab_jamun')
    expect(labelInfo('gulab-jamun').dishes).toEqual(['Gulab jamun'])
    expect(labelInfo('mystery_dish')).toEqual({ name: 'Mystery dish', dishes: [] })
  })
})

describe('fromGuesses', () => {
  it('maps the top guesses to Pulse dishes and drops weak runners-up', () => {
    const r = fromGuesses([{ label: 'dal_makhani', score: 0.82 }, { label: 'chapati', score: 0.1 }, { label: 'naan', score: 0.03 }])
    expect(r.map((x) => [x.name, x.foods[0]?.name])).toEqual([['Dal makhani', 'Dal makhani'], ['Chapati', 'Roti / chapati']])
    expect(needsHelp(r)).toBe(false)
  })
  it('marks stand-ins as approximate and low confidence as needing help', () => {
    const r = fromGuesses([{ label: 'imarti', score: 0.35 }])
    expect(r[0]).toMatchObject({ name: 'Imarti', approx: true })
    expect(r[0].foods[0].name).toBe('Jalebi')
    expect(needsHelp(r)).toBe(true)
  })
  it('a dish with no Pulse data falls back to a name search (may be empty)', () => {
    expect(fromGuesses([{ label: 'ghevar', score: 0.9 }])[0].foods).toEqual([])
  })
})

describe('fromCloud', () => {
  it('searches Pulse foods by name and keeps the portion hint', () => {
    const r = fromCloud([{ name: 'Masala dosa', estimated_grams: 180, estimated_kcal: 390, confidence: 'high' }, { name: 'Coconut chutney', estimated_grams: 40, estimated_kcal: 70, confidence: 'medium' }])
    expect(r.map((x) => [x.foods[0]?.name, x.grams, x.aiKcal, x.confidence])).toEqual([['Masala dosa', 180, 390, 0.9], ['Coconut chutney', 40, 70, 0.6]])
  })
})
