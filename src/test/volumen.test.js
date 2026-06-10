import { describe, it, expect } from 'vitest'
import { calcularVolumenReal } from '../lib/volumen'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const cjs = require('../../netlify/functions/lib/volumen.js')

const SESIONES = [
  { dia: 'Lunes', tipo: 'Correr', duracion_min: 45, completada: true, tiempo_real_min: 50 },
  { dia: 'Martes', tipo: 'Descanso', duracion_min: 0, completada: true },
  { dia: 'Miércoles', tipo: 'Bici', duracion_min: 60, completada: true },
  { dia: 'Jueves', tipo: 'Nadar', duracion_min: 40, completada: false },
  { dia: 'Viernes', tipo: 'Correr', duracion_min: 30, completada: true, via_strava: true },
]

describe('calcularVolumenReal — criterio canónico', () => {
  it('usa tiempo_real_min si existe y duracion_min como fallback', () => {
    // 50 (Lunes real) + 60 (Miércoles plan) + 30 (Viernes via_strava sin tiempo real)
    expect(calcularVolumenReal(SESIONES)).toBe(140)
  })

  it('excluye descansos aunque estén completados', () => {
    expect(calcularVolumenReal([{ tipo: 'Descanso', duracion_min: 30, completada: true }])).toBe(0)
  })

  it('excluye sesiones no completadas', () => {
    expect(calcularVolumenReal([{ tipo: 'Correr', duracion_min: 45, completada: false }])).toBe(0)
  })

  it('tolera arrays vacíos y null', () => {
    expect(calcularVolumenReal([])).toBe(0)
    expect(calcularVolumenReal(null)).toBe(0)
  })

  it('no muta el array original', () => {
    const copia = JSON.parse(JSON.stringify(SESIONES))
    calcularVolumenReal(SESIONES)
    expect(SESIONES).toEqual(copia)
  })
})

describe('volumen — paridad ESM (src/lib) ↔ CJS (netlify/functions/lib)', () => {
  it('mismo resultado en ambos módulos para la misma matriz de sesiones', () => {
    const matriz = [
      SESIONES,
      [],
      null,
      [{ tipo: 'Descanso', duracion_min: 30, completada: true }],
      [{ tipo: 'Fuerza', duracion_min: 55, completada: true, tiempo_real_min: 0 }], // 0 es falsy → fallback
      [{ tipo: 'correr', duracion_min: 45, completada: true }], // case-insensitive en tipo
    ]
    for (const input of matriz) {
      expect(cjs.calcularVolumenReal(input)).toBe(calcularVolumenReal(input))
    }
  })
})
