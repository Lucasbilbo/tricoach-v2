import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { filtrarElegibles, construirBodyGeneracion } = require('../../netlify/functions/auto-plans.js')

describe('auto-plans — selección de elegibles', () => {
  const profiles = [
    { id: 'u1', email: 'a@a.com', nombre: 'Ana' },
    { id: 'u2', email: 'b@b.com', nombre: 'Beto' },
    { id: 'u3', email: 'c@c.com', nombre: 'Cris' },
  ]

  it('solo incluye perfiles Pro con ciclo activo (intersección)', () => {
    // profiles ya viene filtrado por plan=pro y deleted_at=is.null en la query REST;
    // aquí se cruza con los user_id de training_cycles activos
    const elegibles = filtrarElegibles(profiles, ['u1', 'u3'])
    expect(elegibles.map(p => p.id)).toEqual(['u1', 'u3'])
  })

  it('sin ciclos activos no hay elegibles', () => {
    expect(filtrarElegibles(profiles, [])).toEqual([])
    expect(filtrarElegibles(profiles, null)).toEqual([])
  })

  it('tolera listas vacías o nulas de perfiles', () => {
    expect(filtrarElegibles([], ['u1'])).toEqual([])
    expect(filtrarElegibles(null, ['u1'])).toEqual([])
  })
})

describe('auto-plans — body de generación (camino interno)', () => {
  it('NUNCA incluye forzar — la idempotencia de Fase 0 hace que un plan existente se salte sin coste', () => {
    const conNota = construirBodyGeneracion('u1', '2026-06-08', 'viajo el jueves')
    const sinNota = construirBodyGeneracion('u1', '2026-06-08', null)
    expect('forzar' in conNota).toBe(false)
    expect('forzar' in sinNota).toBe(false)
  })

  it('fechaInicio explícito siempre presente (nunca se deja inferir a generate-plan)', () => {
    const body = construirBodyGeneracion('u1', '2026-06-08', null)
    expect(body.fechaInicio).toBe('2026-06-08')
    expect(body.userId).toBe('u1')
    expect(body.notificar).toBe(true)
  })

  it('con nota: viaja como contexto_semana y pide limpieza tras usarla', () => {
    const body = construirBodyGeneracion('u1', '2026-06-08', '  viajo el jueves  ')
    expect(body.contexto_semana).toBe('viajo el jueves')
    expect(body.limpiar_contexto).toBe(true)
  })

  it('sin nota (o solo espacios): ni contexto_semana ni limpiar_contexto', () => {
    for (const nota of [null, undefined, '', '   ']) {
      const body = construirBodyGeneracion('u1', '2026-06-08', nota)
      expect('contexto_semana' in body).toBe(false)
      expect('limpiar_contexto' in body).toBe(false)
    }
  })
})
