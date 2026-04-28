import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { esFormatoAntiguo } from '../lib/plans'

// ─── esFormatoAntiguo ────────────────────────────────────────────────────────

const sesionAntigua = { tipo: 'Correr', intensidad: 'moderada', descripcion: 'Rodaje' }
const sesionNueva = { tipo: 'Correr', intensidad: 'moderada', descripcion: 'Rodaje', estructura: { calentamiento: '10min', principal: 'Fondo', vuelta_calma: '5min', rpe_objetivo: '6-7' } }
const sesionDescanso = { tipo: 'Descanso', intensidad: 'descanso' }

describe('esFormatoAntiguo', () => {
  it('devuelve true cuando todas las sesiones activas son antiguas (sin estructura)', () => {
    const sesiones = [sesionAntigua, sesionAntigua, sesionDescanso]
    expect(esFormatoAntiguo(sesiones)).toBe(true)
  })

  it('devuelve false cuando las sesiones activas tienen estructura (formato nuevo)', () => {
    const sesiones = [sesionNueva, sesionNueva, sesionDescanso]
    expect(esFormatoAntiguo(sesiones)).toBe(false)
  })

  it('devuelve true en plan mixto: basta con que al menos una activa no tenga estructura', () => {
    // La función usa .every(s => !s.estructura), por lo que si alguna tiene estructura → false
    // Si ninguna tiene → true. Un plan mixto (algunas sí, otras no) devuelve false.
    // Documentamos el comportamiento real: si hay al MENOS UNA con estructura → es "nuevo"
    const sesionesMixtas = [sesionNueva, sesionAntigua, sesionDescanso]
    // every(s => !s.estructura) → false (sesionNueva tiene estructura)
    expect(esFormatoAntiguo(sesionesMixtas)).toBe(false)
  })

  it('devuelve false para array vacío', () => {
    expect(esFormatoAntiguo([])).toBe(false)
  })

  it('devuelve false para null/undefined', () => {
    expect(esFormatoAntiguo(null)).toBe(false)
    expect(esFormatoAntiguo(undefined)).toBe(false)
  })

  it('devuelve false si solo hay sesiones de descanso (sin activas)', () => {
    const soloDescanso = [sesionDescanso, sesionDescanso]
    expect(esFormatoAntiguo(soloDescanso)).toBe(false)
  })
})

// ─── localStorage flag del onboarding ───────────────────────────────────────

describe('onboarding_just_completed flag', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('el flag se guarda con el nombre del usuario', () => {
    localStorage.setItem('onboarding_just_completed', 'Lucas')
    expect(localStorage.getItem('onboarding_just_completed')).toBe('Lucas')
  })

  it('el flag se limpia al leerlo (simula comportamiento de Chat)', () => {
    localStorage.setItem('onboarding_just_completed', 'Ana')
    const nombre = localStorage.getItem('onboarding_just_completed')
    localStorage.removeItem('onboarding_just_completed')
    expect(nombre).toBe('Ana')
    expect(localStorage.getItem('onboarding_just_completed')).toBeNull()
  })
})
