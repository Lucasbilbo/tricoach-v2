import { describe, it, expect, vi } from 'vitest'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'

global.fetch = vi.fn()

describe('strava-activities', () => {
  it('la función devuelve actividades formateadas correctamente cuando hay token válido', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        resumen: 'Última semana: 3 salidas, 32km totales, ritmo medio 5:10/km',
        actividades: [
          { tipo: 'Run', distancia_km: 10, duracion_min: 52, fecha: '2026-03-10', ritmo_min_km: '5:12' },
          { tipo: 'Run', distancia_km: 12, duracion_min: 62, fecha: '2026-03-08', ritmo_min_km: '5:10' },
          { tipo: 'Ride', distancia_km: 10, duracion_min: 30, fecha: '2026-03-06', ritmo_min_km: null }
        ]
      })
    })

    const res = await fetch('/.netlify/functions/strava-activities', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test-user' })
    })
    const data = await res.json()

    expect(res.ok).toBe(true)
    expect(data.resumen).toContain('salidas')
    expect(data.actividades).toHaveLength(3)
    expect(data.actividades[0].tipo).toBe('Run')
    expect(data.actividades[0].distancia_km).toBe(10)
  })

  it('la función devuelve { sinStrava: true } cuando no hay token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sinStrava: true })
    })

    const res = await fetch('/.netlify/functions/strava-activities', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test-user-no-strava' })
    })
    const data = await res.json()

    expect(data.sinStrava).toBe(true)
  })

  it('el system prompt incluye el resumen de actividades cuando stravaData existe', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const actividades = {
      resumen: 'Última semana: 3 salidas, 32km totales, ritmo medio 5:10/km',
      actividades: []
    }
    const prompt = buildSystemPrompt(profile, 'cercano', actividades)

    expect(prompt).toContain('ACTIVIDADES RECIENTES DE STRAVA')
    expect(prompt).toContain('Última semana: 3 salidas')
  })

  it('el system prompt incluye el mensaje de "sin Strava" cuando stravaData es null', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const prompt = buildSystemPrompt(profile, 'cercano', null)

    expect(prompt).toContain('no tiene Strava conectado')
  })
})
