import { describe, it, expect } from 'vitest'
import { calcularFases, getFaseActual, esSemanaDescarga, getNumeroSemana, esCicloCompletado } from '../lib/cycles'

// Helper: build a fechaFin string N weeks from a given start
function addWeeks(startStr, weeks) {
  const d = new Date(startStr)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]
}

const START = '2025-01-06' // arbitrary monday

describe('calcularFases', () => {
  it('5 semanas (≤6) → peak + taper', () => {
    const fases = calcularFases(START, addWeeks(START, 5))
    expect(fases).toHaveLength(2)
    expect(fases[0].nombre).toBe('peak')
    expect(fases[0].sem_inicio).toBe(1)
    expect(fases[0].sem_fin).toBe(3)   // 5 - 2
    expect(fases[1].nombre).toBe('taper')
    expect(fases[1].sem_inicio).toBe(4)
    expect(fases[1].sem_fin).toBe(5)
    // Every phase has objetivo
    fases.forEach(f => expect(f.objetivo).toBeTruthy())
  })

  it('8 semanas (6-10) → build + peak + taper', () => {
    const fases = calcularFases(START, addWeeks(START, 8))
    expect(fases).toHaveLength(3)
    expect(fases.map(f => f.nombre)).toEqual(['build', 'peak', 'taper'])
    // buildSem = 6; build 1-4, peak 5-6, taper 7-8
    expect(fases[0]).toMatchObject({ sem_inicio: 1, sem_fin: 4 })
    expect(fases[1]).toMatchObject({ sem_inicio: 5, sem_fin: 6 })
    expect(fases[2]).toMatchObject({ sem_inicio: 7, sem_fin: 8 })
  })

  it('12 semanas (10-16) → base + build + peak + taper', () => {
    const fases = calcularFases(START, addWeeks(START, 12))
    expect(fases).toHaveLength(4)
    expect(fases.map(f => f.nombre)).toEqual(['base', 'build', 'peak', 'taper'])
    // taper=2, peak=3, build=round(7*0.55)=4, base=3
    expect(fases[0]).toMatchObject({ sem_inicio: 1, sem_fin: 3 })   // base
    expect(fases[1]).toMatchObject({ sem_inicio: 4, sem_fin: 7 })   // build
    expect(fases[2]).toMatchObject({ sem_inicio: 8, sem_fin: 10 })  // peak
    expect(fases[3]).toMatchObject({ sem_inicio: 11, sem_fin: 12 }) // taper
  })

  it('18 semanas (>16) → base + build + peak + taper', () => {
    const fases = calcularFases(START, addWeeks(START, 18))
    expect(fases).toHaveLength(4)
    expect(fases.map(f => f.nombre)).toEqual(['base', 'build', 'peak', 'taper'])
    // taper=2, peak=4, build=round(12*0.4)=5, base=7
    expect(fases[0]).toMatchObject({ sem_inicio: 1, sem_fin: 7 })
    expect(fases[1]).toMatchObject({ sem_inicio: 8, sem_fin: 12 })
    expect(fases[2]).toMatchObject({ sem_inicio: 13, sem_fin: 16 })
    expect(fases[3]).toMatchObject({ sem_inicio: 17, sem_fin: 18 })
  })

  it('24 semanas (>16) → base + build + peak + taper', () => {
    const fases = calcularFases(START, addWeeks(START, 24))
    expect(fases).toHaveLength(4)
    expect(fases.map(f => f.nombre)).toEqual(['base', 'build', 'peak', 'taper'])
    // taper=2, peak=4, build=round(18*0.4)=7, base=11
    expect(fases[0]).toMatchObject({ sem_inicio: 1,  sem_fin: 11 })
    expect(fases[1]).toMatchObject({ sem_inicio: 12, sem_fin: 18 })
    expect(fases[2]).toMatchObject({ sem_inicio: 19, sem_fin: 22 })
    expect(fases[3]).toMatchObject({ sem_inicio: 23, sem_fin: 24 })
  })

  it('todas las fases tienen objetivo', () => {
    const fases = calcularFases(START, addWeeks(START, 20))
    fases.forEach(f => expect(f.objetivo).toBeTruthy())
  })
})

describe('getFaseActual', () => {
  const fases = calcularFases(START, addWeeks(START, 12))
  // base 1-3, build 4-7, peak 8-10, taper 11-12

  it('semana 1 → base', () => expect(getFaseActual(fases, 1).nombre).toBe('base'))
  it('semana 3 → base', () => expect(getFaseActual(fases, 3).nombre).toBe('base'))
  it('semana 4 → build', () => expect(getFaseActual(fases, 4).nombre).toBe('build'))
  it('semana 7 → build', () => expect(getFaseActual(fases, 7).nombre).toBe('build'))
  it('semana 8 → peak', () => expect(getFaseActual(fases, 8).nombre).toBe('peak'))
  it('semana 11 → taper', () => expect(getFaseActual(fases, 11).nombre).toBe('taper'))
  it('semana fuera de rango → fallback primera fase', () => {
    expect(getFaseActual(fases, 99).nombre).toBe('base')
  })
})

describe('esSemanaDescarga', () => {
  const faseBase  = { nombre: 'base' }
  const faseBuild = { nombre: 'build' }
  const faseTaper = { nombre: 'taper' }

  it('semana 4 en base → true', () => expect(esSemanaDescarga(4, faseBase)).toBe(true))
  it('semana 8 en build → true', () => expect(esSemanaDescarga(8, faseBuild)).toBe(true))
  it('semana 12 en base → true', () => expect(esSemanaDescarga(12, faseBase)).toBe(true))
  it('semana 3 en base → false', () => expect(esSemanaDescarga(3, faseBase)).toBe(false))
  it('semana 5 en build → false', () => expect(esSemanaDescarga(5, faseBuild)).toBe(false))
  it('semana 4 en taper → false (taper nunca es descarga)', () => {
    expect(esSemanaDescarga(4, faseTaper)).toBe(false)
  })
  it('semana 8 en taper → false', () => expect(esSemanaDescarga(8, faseTaper)).toBe(false))
})

describe('getNumeroSemana', () => {
  it('misma semana → 1', () => {
    expect(getNumeroSemana('2025-01-06', '2025-01-06')).toBe(1)
  })
  it('una semana después → 2', () => {
    expect(getNumeroSemana('2025-01-06', '2025-01-13')).toBe(2)
  })
  it('cuatro semanas después → 5', () => {
    expect(getNumeroSemana('2025-01-06', '2025-02-03')).toBe(5)
  })
  it('doce semanas después → 13', () => {
    expect(getNumeroSemana('2025-01-06', '2025-03-31')).toBe(13)
  })
})

// ── Regresión BUG 3: calcularFases con < 3 semanas debe lanzar error ──
describe('calcularFases — guard mínimo', () => {
  it('2 semanas lanza error', () => {
    expect(() => calcularFases(START, addWeeks(START, 2))).toThrow()
  })
  it('1 semana lanza error', () => {
    expect(() => calcularFases(START, addWeeks(START, 1))).toThrow()
  })
  it('3 semanas no lanza error', () => {
    expect(() => calcularFases(START, addWeeks(START, 3))).not.toThrow()
  })
})

// ── Regresión BUG 7: esCicloCompletado con gracia para ciclos con carrera ──
describe('esCicloCompletado — gracia 4 semanas para ciclos con carrera', () => {
  it('ciclo con carrera_nombre no completa en la semana final', () => {
    const cycle = { semanas_totales: 16, carrera_nombre: 'Madrid Marathon' }
    expect(esCicloCompletado(cycle, 16)).toBe(false)
  })
  it('ciclo con carrera_nombre no completa justo tras el final (sem 20)', () => {
    const cycle = { semanas_totales: 16, carrera_nombre: 'Madrid Marathon' }
    expect(esCicloCompletado(cycle, 20)).toBe(false)
  })
  it('ciclo con carrera_nombre completa tras 4 semanas de gracia (sem 21)', () => {
    const cycle = { semanas_totales: 16, carrera_nombre: 'Madrid Marathon' }
    expect(esCicloCompletado(cycle, 21)).toBe(true)
  })
})
