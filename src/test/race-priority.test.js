import { describe, it, expect } from 'vitest'

// ─── Pure logic mirrors from create-cycle.js ─────────────────────────────────

function seleccionarCarreraObjetivo(carreras, today) {
  const futuras = carreras
    .filter(c => c.fecha && c.fecha > today)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  return futuras.find(c => c.prioridad === 'A')
    || futuras.find(c => !c.prioridad)
    || futuras[0]
    || null
}

// ─── Pure logic mirrors from generate-plan.js ────────────────────────────────

function detectarCarreraProxima(carreras, hoyStr) {
  const hoy14 = new Date(hoyStr)
  hoy14.setDate(hoy14.getDate() + 14)
  const hoy14Str = hoy14.toISOString().split('T')[0]
  return carreras
    .filter(c => c.fecha && c.fecha >= hoyStr && c.fecha <= hoy14Str && (c.prioridad === 'B' || c.prioridad === 'C'))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null
}

// ─── create-cycle: selección de carrera objetivo ──────────────────────────────

describe('create-cycle — prioridad de carrera objetivo', () => {
  const TODAY = '2026-04-28'

  it('prioriza carrera A sobre B y C aunque B sea más próxima', () => {
    const carreras = [
      { nombre: 'Carrera B próxima', fecha: '2026-06-01', prioridad: 'B' },
      { nombre: 'Objetivo A lejano', fecha: '2026-09-01', prioridad: 'A' },
      { nombre: 'Entrenamiento C',   fecha: '2026-07-01', prioridad: 'C' },
    ]
    const result = seleccionarCarreraObjetivo(carreras, TODAY)
    expect(result.nombre).toBe('Objetivo A lejano')
  })

  it('usa carrera sin prioridad cuando no hay A (compatibilidad hacia atrás)', () => {
    const carreras = [
      { nombre: 'Carrera B',      fecha: '2026-09-01', prioridad: 'B' },
      { nombre: 'Sin prioridad',  fecha: '2026-07-01' },
    ]
    const result = seleccionarCarreraObjetivo(carreras, TODAY)
    expect(result.nombre).toBe('Sin prioridad')
  })

  it('devuelve null si no hay carreras futuras', () => {
    const carreras = [{ nombre: 'Pasada', fecha: '2026-01-01', prioridad: 'A' }]
    expect(seleccionarCarreraObjetivo(carreras, TODAY)).toBeNull()
  })
})

// ─── generate-plan: detección de carrera B/C próxima ─────────────────────────

describe('generate-plan — mini-taper para carrera B/C próxima', () => {
  const HOY = '2026-04-28'

  it('detecta carrera B en 3 días (dentro de 14)', () => {
    const carreras = [{ nombre: 'Media Maratón', fecha: '2026-05-01', prioridad: 'B' }]
    const result = detectarCarreraProxima(carreras, HOY)
    expect(result).not.toBeNull()
    expect(result.prioridad).toBe('B')
    expect(result.nombre).toBe('Media Maratón')
  })

  it('detecta carrera C en 7 días', () => {
    const carreras = [{ nombre: 'Cross local', fecha: '2026-05-05', prioridad: 'C' }]
    const result = detectarCarreraProxima(carreras, HOY)
    expect(result).not.toBeNull()
    expect(result.prioridad).toBe('C')
  })

  it('carrera B a más de 14 días no activa mini-taper', () => {
    const carreras = [{ nombre: 'Maratón lejos', fecha: '2026-06-15', prioridad: 'B' }]
    expect(detectarCarreraProxima(carreras, HOY)).toBeNull()
  })

  it('carrera A próxima no activa mini-taper (solo B y C lo hacen)', () => {
    const carreras = [{ nombre: 'Objetivo A', fecha: '2026-05-01', prioridad: 'A' }]
    expect(detectarCarreraProxima(carreras, HOY)).toBeNull()
  })
})
