import { describe, it, expect } from 'vitest'
import { checkShouldAdjust } from '../lib/autoAdjust'

// Semana base: lunes de esta semana pasada (siempre en el pasado)
const SEMANA_PASADA = '2020-01-06' // lunes

function makeSesion(dia, opts = {}) {
  return {
    dia,
    tipo: opts.tipo ?? 'Correr',
    duracion_min: opts.duracion_min ?? 45,
    completada: opts.completada ?? false,
    rpe: opts.rpe ?? null,
    rpe_usuario: opts.rpe_usuario ?? null,
    tiempo_real_min: opts.tiempo_real_min ?? null,
    ...opts,
  }
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function makePlan(sesionesParciales, semana = SEMANA_PASADA) {
  // Rellena los 7 días con descanso si no están especificados
  const porDia = {}
  sesionesParciales.forEach(s => { porDia[s.dia] = s })
  const sesiones = DIAS.map(dia => porDia[dia] ?? makeSesion(dia, { tipo: 'Descanso', completada: false }))
  return { semana, sesiones }
}

describe('checkShouldAdjust', () => {
  it('devuelve shouldAdjust:false para plan vacío/null', () => {
    expect(checkShouldAdjust(null, {})).toEqual({ shouldAdjust: false, reason: '', signal: '' })
    expect(checkShouldAdjust({}, {})).toEqual({ shouldAdjust: false, reason: '', signal: '' })
  })

  it('devuelve shouldAdjust:false cuando no hay señales', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: true, rpe: 5 }),
      makeSesion('Martes', { completada: true, rpe: 6 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(false)
  })

  it('señal sobrecarga: RPE medio >= 8 en las últimas 3 sesiones', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: true, rpe: 8 }),
      makeSesion('Martes', { completada: true, rpe: 9 }),
      makeSesion('Miércoles', { completada: true, rpe: 8 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(true)
    expect(result.signal).toBe('sobrecarga')
  })

  it('señal sobrecarga: RPE medio < 8 no dispara ajuste', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: true, rpe: 7 }),
      makeSesion('Martes', { completada: true, rpe: 7 }),
      makeSesion('Miércoles', { completada: true, rpe: 7 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(false)
  })

  it('señal sesiones_perdidas: 2+ sesiones perdidas consecutivas en días pasados', () => {
    // SEMANA_PASADA = 2020-01-06 → todos los días son pasados
    const plan = makePlan([
      makeSesion('Lunes', { completada: false }),
      makeSesion('Martes', { completada: false }),
      makeSesion('Miércoles', { completada: true, rpe: 5 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(true)
    expect(result.signal).toBe('sesiones_perdidas')
  })

  it('1 sesión perdida no dispara ajuste por sesiones_perdidas', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: false }),
      makeSesion('Martes', { completada: true, rpe: 6 }),
      makeSesion('Miércoles', { completada: true, rpe: 6 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(false)
  })

  it('días completados intactos — no se consideran como perdidos', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: true, rpe: 6 }),
      makeSesion('Martes', { completada: true, rpe: 6 }),
      makeSesion('Miércoles', { completada: true, rpe: 6 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(false)
  })

  it('señal sobrecarga por volumen Strava > 120%', () => {
    const plan = makePlan([
      makeSesion('Lunes', { completada: true, rpe: 6, duracion_min: 45, tiempo_real_min: 60 }),
      makeSesion('Martes', { completada: true, rpe: 6, duracion_min: 45, tiempo_real_min: 60 }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(true)
    expect(result.signal).toBe('sobrecarga')
  })

  it('sesiones de descanso no cuentan como perdidas', () => {
    const plan = makePlan([
      makeSesion('Lunes', { tipo: 'Descanso', completada: false }),
      makeSesion('Martes', { tipo: 'Descanso', completada: false }),
      makeSesion('Miércoles', { tipo: 'Descanso', completada: false }),
    ])
    const result = checkShouldAdjust(plan, {})
    expect(result.shouldAdjust).toBe(false)
  })
})
