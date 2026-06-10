import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { buildPlanListoHtml } = require('../../netlify/functions/lib/email.js')

const SESIONES = [
  { dia: 'Lunes', tipo: 'Correr', duracion_min: 60 },
  { dia: 'Martes', tipo: 'Descanso', duracion_min: 0 },
  { dia: 'Miércoles', tipo: 'Bici', duracion_min: 90 },
  { dia: 'Jueves', tipo: 'Nadar', duracion_min: 45 },
]

describe('email plan listo — buildPlanListoHtml', () => {
  it('incluye el número de sesiones activas (descansos excluidos) y el volumen', () => {
    const html = buildPlanListoHtml('Lucas', SESIONES, 195)
    expect(html).toContain('3 sesiones')
    expect(html).toContain('3h 15min')
    expect(html).toContain('Lucas')
  })

  it('enlaza a la app y está en español', () => {
    const html = buildPlanListoHtml('Lucas', SESIONES, 195)
    expect(html).toContain('https://app.getricoach.com')
    expect(html).toContain('Ver mi plan')
    expect(html).toContain('lang="es"')
  })

  it('tolera nombre vacío y volumen menor de una hora', () => {
    const html = buildPlanListoHtml(null, [{ dia: 'Lunes', tipo: 'Correr', duracion_min: 45 }], 45)
    expect(html).toContain('atleta')
    expect(html).toContain('1 sesiones')
    expect(html).toContain('45min')
    expect(html).not.toContain('0h')
  })
})
