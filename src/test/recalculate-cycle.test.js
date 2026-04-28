import { describe, it, expect } from 'vitest'
import { calcularFases } from '../lib/cycles'

function addWeeks(startStr, weeks) {
  const d = new Date(startStr)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]
}

const HOY = '2026-04-28'

describe('recalculate-cycle — recalcular fases al cambiar la carrera A', () => {
  it('las fases se comprimen cuando la carrera se acerca', () => {
    // 20 semanas: base + build + peak + taper
    const fasesLejanas = calcularFases(HOY, addWeeks(HOY, 20))
    // 8 semanas: build + peak + taper (sin base)
    const fasesCercanas = calcularFases(HOY, addWeeks(HOY, 8))

    expect(fasesLejanas.length).toBeGreaterThan(fasesCercanas.length)
    expect(fasesLejanas.map(f => f.nombre)).toContain('base')
    expect(fasesCercanas.map(f => f.nombre)).not.toContain('base')
  })

  it('las fases se expanden cuando la carrera se aleja', () => {
    // 6 semanas: peak + taper
    const fasesCortas = calcularFases(HOY, addWeeks(HOY, 6))
    // 20 semanas: base + build + peak + taper
    const fasesLargas = calcularFases(HOY, addWeeks(HOY, 20))

    expect(fasesLargas.length).toBeGreaterThan(fasesCortas.length)
    expect(fasesLargas.map(f => f.nombre)).toContain('base')
    expect(fasesCortas.map(f => f.nombre)).not.toContain('build')
  })

  it('semanas_totales se recalcula correctamente desde la semana actual', () => {
    const fechaFin = addWeeks(HOY, 12)
    const semanas = Math.round((new Date(fechaFin) - new Date(HOY)) / (7 * 24 * 60 * 60 * 1000))
    expect(semanas).toBe(12)

    const fases = calcularFases(HOY, fechaFin)
    const ultimaFase = fases[fases.length - 1]
    expect(ultimaFase.sem_fin).toBe(semanas)
    expect(ultimaFase.nombre).toBe('taper')
  })

  it('siempre termina con fase taper', () => {
    [6, 8, 12, 16, 20].forEach(semanas => {
      const fases = calcularFases(HOY, addWeeks(HOY, semanas))
      expect(fases[fases.length - 1].nombre).toBe('taper')
    })
  })
})
