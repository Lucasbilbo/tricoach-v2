import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'

const require = createRequire(import.meta.url)
const { esEventoTriCoach, externalIdSesion, PREFIJO_EXTERNAL_ID } = require('../../netlify/functions/lib/intervals-sync.js')

describe('intervals-sync — qué eventos son de TriCoach', () => {
  it('reconoce los eventos con external_id de TriCoach', () => {
    expect(esEventoTriCoach({ external_id: 'tricoach-abc-viernes', name: 'lo que sea', category: 'WORKOUT' })).toBe(true)
  })

  it('reconoce el formato de nombre antiguo (sin external_id)', () => {
    expect(esEventoTriCoach({ category: 'WORKOUT', name: 'Fuerza general y core — 50min' })).toBe(true)
    expect(esEventoTriCoach({ category: 'WORKOUT', name: 'Correr — TriCoach' })).toBe(true)
  })

  it('NO toca las sesiones del Coach Dashboard (nombres con " · ")', () => {
    expect(esEventoTriCoach({ category: 'WORKOUT', name: 'Natación · 4×300 m Z3' })).toBe(false)
    expect(esEventoTriCoach({ category: 'WORKOUT', name: "Ciclismo · 90′ Z1" })).toBe(false)
  })

  it('NO toca eventos que no son entrenos ni los de otro external_id', () => {
    expect(esEventoTriCoach({ category: 'NOTE', name: 'Fuerza — 50min' })).toBe(false)
    expect(esEventoTriCoach({ category: 'WORKOUT', external_id: 'otra-app-1', name: 'Rodaje' })).toBe(false)
    expect(esEventoTriCoach(null)).toBe(false)
    expect(esEventoTriCoach(undefined)).toBe(false)
  })

  it('external_id estable por plan y día', () => {
    expect(externalIdSesion('p1', 'Viernes')).toBe(`${PREFIJO_EXTERNAL_ID}p1-viernes`)
    expect(externalIdSesion('p1', 'Viernes')).toBe(externalIdSesion('p1', 'Viernes'))
  })
})

describe('intervals-sync — está conectado en los dos caminos de envío', () => {
  const gp = readFileSync('netlify/functions/generate-plan.js', 'utf8')
  const iv = readFileSync('netlify/functions/intervals.js', 'utf8')
  const dash = readFileSync('src/components/Dashboard.jsx', 'utf8')

  it('generate-plan limpia lo anterior y marca cada evento con external_id', () => {
    expect(gp).toContain('borrarEventosTriCoach(')
    expect(gp).toContain('external_id: externalIdSesion(')
  })

  it('el botón manual reemplaza en vez de duplicar', () => {
    expect(iv).toContain('borrarEventosTriCoach(')
    expect(dash).toContain("external_id: `tricoach-")
  })
})
