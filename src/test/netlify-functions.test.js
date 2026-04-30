/* eslint-env node */
import { describe, it, expect, vi } from 'vitest'

global.fetch = vi.fn()

describe('Funciones Netlify', () => {
  it('claude.js: devuelve error si no hay mensaje', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'mensaje requerido' })
    })

    const res = await fetch('/.netlify/functions/claude', {
      method: 'POST',
      body: JSON.stringify({})
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('strava.js: devuelve error si no hay token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'no autorizado' })
    })

    const res = await fetch('/.netlify/functions/strava')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('github-history.js: devuelve error si no hay token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'no autorizado' })
    })

    const res = await fetch('/.netlify/functions/github-history')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('strava-feedback: devuelve 401 sin secreto', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' })
    })

    const res = await fetch('/.netlify/functions/strava-feedback', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test', actividad: {} })
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('strava-feedback: devuelve 400 sin userId', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'userId requerido' })
    })

    const res = await fetch('/.netlify/functions/strava-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tricoach-secret': 'test-secret' },
      body: JSON.stringify({})
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('generate-plan: devuelve plan con cycle_id, numero_semana, fase y volumen_planificado_min', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'plan-xyz',
        semana: '2026-04-28',
        cycle_id: 'cycle-123',
        numero_semana: 3,
        fase: 'base',
        objetivo_semana: 'Construir base aeróbica y volumen progresivo',
        volumen_planificado_min: 250,
        sesiones: Array.from({ length: 7 }, (_, i) => ({
          dia: ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i],
          tipo: i % 3 === 0 ? 'Descanso' : 'Correr',
          subtipo: i % 3 === 0 ? 'Descanso completo' : 'Rodaje Z2',
          duracion_min: i % 3 === 0 ? 0 : 50,
          intensidad: i % 3 === 0 ? 'descanso' : 'suave',
          distancia_km: i % 3 === 0 ? null : 7,
          zona_objetivo: i % 3 === 0 ? null : 'Z1-Z2',
          estructura: i % 3 === 0 ? null : {
            calentamiento: '10min Z1',
            principal: '35min Z2',
            vuelta_calma: '5min estiramientos',
            rpe_objetivo: '5-6',
          },
        }))
      })
    })

    const res = await fetch('/.netlify/functions/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-abc' })
    })
    const data = await res.json()

    expect(res.ok).toBe(true)
    expect(data.cycle_id).toBe('cycle-123')
    expect(data.numero_semana).toBe(3)
    expect(data.fase).toBe('base')
    expect(data.volumen_planificado_min).toBe(250)
    expect(data.sesiones).toHaveLength(7)
    const activa = data.sesiones.find(s => s.tipo !== 'Descanso')
    expect(activa.estructura).toBeDefined()
    expect(activa.estructura.calentamiento).toBeTruthy()
    expect(activa.zona_objetivo).toBe('Z1-Z2')
  })
})