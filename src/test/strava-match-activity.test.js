import { describe, it, expect, vi } from 'vitest'

global.fetch = vi.fn()

const TIPO_MAP = {
  'Correr': ['Run', 'TrailRun', 'VirtualRun'],
  'Bici':   ['Ride', 'VirtualRide', 'MountainBikeRide'],
  'Nadar':  ['Swim'],
  'Fuerza': ['WeightTraining', 'Workout'],
}

describe('strava-match-activity — mapeo de tipos', () => {
  it('Correr mapea a Run, TrailRun, VirtualRun', () => {
    expect(TIPO_MAP['Correr']).toEqual(['Run', 'TrailRun', 'VirtualRun'])
  })

  it('Bici mapea a Ride, VirtualRide, MountainBikeRide', () => {
    expect(TIPO_MAP['Bici']).toEqual(['Ride', 'VirtualRide', 'MountainBikeRide'])
  })

  it('Nadar mapea a Swim', () => {
    expect(TIPO_MAP['Nadar']).toEqual(['Swim'])
  })

  it('Fuerza mapea a WeightTraining, Workout', () => {
    expect(TIPO_MAP['Fuerza']).toEqual(['WeightTraining', 'Workout'])
  })
})

describe('strava-match-activity — integración HTTP', () => {
  it('devuelve found:false cuando no hay token de Strava', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ found: false }),
    })

    const res = await fetch('/.netlify/functions/strava-match-activity', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-sin-strava', sessionDate: '2026-04-28', sessionTipo: 'Correr' }),
    })
    const data = await res.json()

    expect(data.found).toBe(false)
  })

  it('devuelve los datos correctos cuando hay match', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        activityId: 12345,
        nombre: 'Rodaje matutino',
        duracion_min: 52,
        distancia_km: 10.5,
        fc_media: 148,
        descripcion: 'Rodaje matutino',
      }),
    })

    const res = await fetch('/.netlify/functions/strava-match-activity', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-con-strava', sessionDate: '2026-04-28', sessionTipo: 'Correr' }),
    })
    const data = await res.json()

    expect(data.found).toBe(true)
    expect(data.duracion_min).toBe(52)
    expect(data.distancia_km).toBe(10.5)
    expect(data.fc_media).toBe(148)
  })
})
