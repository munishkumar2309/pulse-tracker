import { describe, expect, it } from 'vitest'
import {
  ageFromDob, bmi, bmiCategory, bmr, calorieTarget, healthyWeightRange,
  projectGoal, proteinTargetG, tdee, waterTargetMl,
} from './calc'

describe('bmi', () => {
  it('computes kg/m² to 1 dp', () => {
    expect(bmi(80, 175)).toBe(26.1) // 80 / 1.75² = 26.12
  })
  it('uses Asian cut-offs by default', () => {
    expect(bmiCategory(22.9)).toBe('Normal')
    expect(bmiCategory(23)).toBe('Overweight')
    expect(bmiCategory(25)).toBe('Obese')
    expect(bmiCategory(18.4)).toBe('Underweight')
  })
  it('supports WHO cut-offs', () => {
    expect(bmiCategory(24.9, 'who')).toBe('Normal')
    expect(bmiCategory(27, 'who')).toBe('Overweight')
    expect(bmiCategory(30, 'who')).toBe('Obese')
  })
})

describe('healthyWeightRange', () => {
  it('175 cm, Asian → 56.7–70.1 kg', () => {
    expect(healthyWeightRange(175)).toEqual({ min: 56.7, max: 70.1 })
  })
  it('175 cm, WHO → 56.7–76.3 kg', () => {
    expect(healthyWeightRange(175, 'who')).toEqual({ min: 56.7, max: 76.3 })
  })
})

describe('energy', () => {
  it('Mifflin-St Jeor male 80kg 175cm 30y = 1749', () => {
    // 800 + 1093.75 - 150 + 5 = 1748.75
    expect(bmr(80, 175, 30, 'male')).toBe(1749)
  })
  it('Mifflin-St Jeor female 65kg 160cm 35y = 1314', () => {
    // 650 + 1000 - 175 - 161 = 1314
    expect(bmr(65, 160, 35, 'female')).toBe(1314)
  })
  it('tdee applies activity factor', () => {
    expect(tdee(1749, 'sedentary')).toBe(2099) // 2098.8
    expect(tdee(1749, 'moderate')).toBe(2711) // 2710.95
  })
  it('0.5 kg/week → 550 kcal deficit', () => {
    expect(calorieTarget(2099, 0.5, 'male')).toEqual({ kcal: 1549, deficit: 550, floored: false })
  })
  it('never goes below the safe floor', () => {
    expect(calorieTarget(1600, 0.5, 'female')).toEqual({ kcal: 1200, deficit: 400, floored: true })
  })
})

describe('targets', () => {
  it('water 35 ml/kg rounded to 100', () => {
    expect(waterTargetMl(80)).toBe(2800)
    expect(waterTargetMl(67)).toBe(2300) // 2345 → 2300
  })
  it('protein 1.2 g/kg', () => {
    expect(proteinTargetG(80)).toBe(96)
  })
})

describe('projectGoal', () => {
  it('10 kg at 0.5/week = 20 weeks', () => {
    const r = projectGoal(80, 70, 0.5, new Date(2026, 0, 1))
    expect(r?.weeks).toBe(20)
    expect(r?.date.toDateString()).toBe(new Date(2026, 4, 21).toDateString())
  })
  it('null when already at goal or pace is 0', () => {
    expect(projectGoal(70, 70, 0.5)).toBeNull()
    expect(projectGoal(80, 70, 0)).toBeNull()
  })
})

describe('ageFromDob', () => {
  it('counts birthdays correctly', () => {
    expect(ageFromDob('1990-06-15', new Date(2026, 5, 14))).toBe(35)
    expect(ageFromDob('1990-06-15', new Date(2026, 5, 15))).toBe(36)
  })
})
