import { describe, it, expect } from 'vitest'
import { UMBRALES_WELLNESS, evaluarWellness } from '../lib/wellness'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const cjs = require('../../netlify/functions/lib/wellness.js')

describe('wellness — umbrales y evaluación', () => {
  it('ATL en el umbral (50) no alerta; por encima (51) sí', () => {
    expect(evaluarWellness({ atl: 50 }).fatigaAlta).toBe(false)
    expect(evaluarWellness({ atl: 51 }).fatigaAlta).toBe(true)
    expect(evaluarWellness({ atl: 51 }).hayAlerta).toBe(true)
  })

  it('TSB en el umbral (-20) no alerta; por debajo (-21) sí', () => {
    expect(evaluarWellness({ tsb: -20 }).formaNegativa).toBe(false)
    expect(evaluarWellness({ tsb: -21 }).formaNegativa).toBe(true)
  })

  it('HRV en el umbral (40) no alerta; por debajo (39) sí', () => {
    expect(evaluarWellness({ hrv: 40 }).hrvBajo).toBe(false)
    expect(evaluarWellness({ hrv: 39 }).hrvBajo).toBe(true)
  })

  it('campos null/ausentes no generan alertas (null-safe)', () => {
    const sinDatos = evaluarWellness({ atl: null, tsb: null, hrv: null })
    expect(sinDatos.hayAlerta).toBe(false)
    expect(evaluarWellness({}).hayAlerta).toBe(false)
    expect(evaluarWellness(null).hayAlerta).toBe(false)
  })

  it('valores se redondean (ATL/TSB) y HRV se conserva', () => {
    const r = evaluarWellness({ atl: 56.7, tsb: -25.4, hrv: 38 })
    expect(r.valores.atl).toBe(57)
    expect(r.valores.tsb).toBe(-25)
    expect(r.valores.hrv).toBe(38)
    expect(r.fatigaAlta).toBe(true)
    expect(r.formaNegativa).toBe(true)
    expect(r.hrvBajo).toBe(true)
  })
})

describe('wellness — paridad ESM (src/lib) ↔ CJS (netlify/functions/lib)', () => {
  it('los UMBRALES son idénticos en ambos módulos', () => {
    expect(cjs.UMBRALES_WELLNESS).toEqual(UMBRALES_WELLNESS)
  })

  it('evaluarWellness devuelve lo mismo en ambos módulos para la misma matriz de inputs', () => {
    const matriz = [
      null,
      {},
      { atl: 50 }, { atl: 51 }, { atl: 49.6 },
      { tsb: -20 }, { tsb: -21 }, { tsb: 0 },
      { hrv: 40 }, { hrv: 39 }, { hrv: 80 },
      { atl: 56.7, tsb: -25.4, hrv: 38 },
      { atl: null, tsb: null, hrv: null },
      { atl: 70, tsb: 5, hrv: 60 },
    ]
    for (const input of matriz) {
      expect(cjs.evaluarWellness(input)).toEqual(evaluarWellness(input))
    }
  })
})
