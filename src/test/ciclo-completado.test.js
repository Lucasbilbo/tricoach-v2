import { describe, it, expect } from 'vitest'
import { esCicloCompletado } from '../lib/cycles'

describe('esCicloCompletado', () => {
  it('true cuando sem actual >= semanas_totales y sin fecha_carrera', () => {
    const cycle = { semanas_totales: 16, fecha_carrera: null }
    expect(esCicloCompletado(cycle, 16)).toBe(true)
    expect(esCicloCompletado(cycle, 17)).toBe(true)
  })

  it('false cuando hay fecha_carrera aunque esté en sem final', () => {
    const cycle = { semanas_totales: 16, fecha_carrera: '2026-09-01' }
    expect(esCicloCompletado(cycle, 16)).toBe(false)
    expect(esCicloCompletado(cycle, 20)).toBe(false)
  })

  it('false cuando sem actual < semanas_totales', () => {
    const cycle = { semanas_totales: 16, fecha_carrera: null }
    expect(esCicloCompletado(cycle, 15)).toBe(false)
    expect(esCicloCompletado(cycle, 1)).toBe(false)
  })
})
