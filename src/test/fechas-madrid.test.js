import { describe, it, expect, vi, afterEach } from 'vitest'
import { getHoyMadrid as getHoyMadridESM } from '../lib/fechas'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { getMondayOfCurrentWeek, getHoyMadrid } = require('../../netlify/functions/lib/fechas.js')

// El cron de auto-plans corre lunes 03:00 UTC. Madrid = UTC+2 en verano, UTC+1 en
// invierno: estas pruebas fijan el reloj en los casos reales del cron y en los
// bordes de la "ventana de peligro" del informe (domingo noche UTC).
describe('getMondayOfCurrentWeek — lunes en Europe/Madrid', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cron de verano: lunes 03:00 UTC (05:00 Madrid) → ese mismo lunes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T03:00:00Z')) // lunes 8 jun
    expect(getMondayOfCurrentWeek()).toBe('2026-06-08')
  })

  it('cron de invierno: lunes 03:00 UTC (04:00 Madrid) → ese mismo lunes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-12T03:00:00Z')) // lunes 12 ene
    expect(getMondayOfCurrentWeek()).toBe('2026-01-12')
  })

  it('borde verano: domingo 23:30 UTC ya es lunes 01:30 en Madrid → lunes siguiente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T23:30:00Z')) // domingo UTC, lunes en Madrid
    expect(getMondayOfCurrentWeek()).toBe('2026-06-08')
  })

  it('borde invierno: domingo 22:30 UTC aún es domingo 23:30 en Madrid → lunes anterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-11T22:30:00Z')) // domingo en ambas zonas
    expect(getMondayOfCurrentWeek()).toBe('2026-01-05')
  })

  it('mitad de semana: jueves → lunes de esa semana', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T10:00:00Z')) // jueves 11 jun
    expect(getMondayOfCurrentWeek()).toBe('2026-06-08')
  })
})

describe('getHoyMadrid — paridad CJS (functions/lib) ↔ ESM (src/lib)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ambos devuelven la fecha Madrid, no la UTC, en la madrugada', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T22:30:00Z')) // 00:30 del día 10 en Madrid
    expect(getHoyMadrid()).toBe('2026-06-10')
    expect(getHoyMadridESM()).toBe('2026-06-10')
    expect(getHoyMadrid()).toBe(getHoyMadridESM())
  })
})
