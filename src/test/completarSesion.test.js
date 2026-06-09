import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock stateful de Supabase: captura el payload del update y devuelve la fila actualizada
const state = { plan: null, updatePayload: null }

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: state.plan, error: null })),
        })),
      })),
      update: vi.fn((payload) => {
        state.updatePayload = payload
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: 'plan-1', semana: state.plan?.semana, ...payload },
                error: null,
              })),
            })),
          })),
        }
      }),
    })),
  },
}))

import { completarSesion } from '../lib/plans'
import { getFechaSesion, getHoyMadrid, DIA_OFFSET_MAP } from '../lib/fechas'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'

const SEMANA = '2026-05-11' // lunes

function sesionesBase() {
  return [
    { dia: 'Lunes', tipo: 'Correr', subtipo: 'Rodaje Z2', descripcion: 'Rodaje Z2', duracion_min: 45, intensidad: 'suave', completada: false, rpe: null },
    { dia: 'Martes', tipo: 'Descanso', subtipo: 'Descanso', descripcion: 'Descanso', duracion_min: 0, intensidad: 'descanso', completada: false, rpe: null },
    { dia: 'Miércoles', tipo: 'Bici', subtipo: 'Rodaje fácil', descripcion: 'Rodaje fácil', duracion_min: 60, intensidad: 'suave', completada: false, rpe: null },
  ]
}

beforeEach(() => {
  state.plan = { semana: SEMANA, sesiones: sesionesBase(), volumen_real_min: 0 }
  state.updatePayload = null
})

describe('completarSesion — función canónica', () => {
  it('marca la sesión como completada con rpe', async () => {
    const updated = await completarSesion('plan-1', 'Lunes', { rpe: 6 })
    const lunes = updated.sesiones.find(s => s.dia === 'Lunes')
    expect(lunes.completada).toBe(true)
    expect(lunes.rpe).toBe(6)
    const miercoles = updated.sesiones.find(s => s.dia === 'Miércoles')
    expect(miercoles.completada).toBe(false)
  })

  it('recalcula volumen_real_min con duracion_min si no hay tiempo real', async () => {
    await completarSesion('plan-1', 'Lunes', { rpe: 5 })
    expect(state.updatePayload.volumen_real_min).toBe(45)
  })

  it('guarda datos reales y usa tiempo_real_min en el volumen', async () => {
    const updated = await completarSesion('plan-1', 'Lunes', {
      rpe: 7,
      tiempo_real_min: 50,
      distancia_real_km: 8.2,
      fc_media_real: 152,
      notas_usuario: 'buenas sensaciones',
    })
    const lunes = updated.sesiones.find(s => s.dia === 'Lunes')
    expect(lunes.tiempo_real_min).toBe(50)
    expect(lunes.distancia_real_km).toBe(8.2)
    expect(lunes.fc_media_real).toBe(152)
    expect(lunes.notas_usuario).toBe('buenas sensaciones')
    expect(state.updatePayload.volumen_real_min).toBe(50)
  })

  it('excluye sesiones de descanso del volumen real', async () => {
    state.plan.sesiones = sesionesBase().map(s =>
      s.dia === 'Martes' ? { ...s, duracion_min: 30 } : s
    )
    await completarSesion('plan-1', 'Martes', { rpe: 3 })
    expect(state.updatePayload.volumen_real_min).toBe(0)
  })

  it('suma el volumen de todas las sesiones completadas', async () => {
    state.plan.sesiones = sesionesBase().map(s =>
      s.dia === 'Lunes' ? { ...s, completada: true, tiempo_real_min: 40 } : s
    )
    await completarSesion('plan-1', 'Miércoles', { rpe: 6 })
    expect(state.updatePayload.volumen_real_min).toBe(100) // 40 (Lunes real) + 60 (Miércoles plan)
  })

  it('acepta via_strava como campo', async () => {
    const updated = await completarSesion('plan-1', 'Lunes', { rpe: null, via_strava: true })
    const lunes = updated.sesiones.find(s => s.dia === 'Lunes')
    expect(lunes.via_strava).toBe(true)
    expect(lunes.completada).toBe(true)
  })

  it('lanza "Plan no encontrado" si el plan no existe', async () => {
    state.plan = null
    await expect(completarSesion('plan-x', 'Lunes', { rpe: 5 })).rejects.toThrow('Plan no encontrado')
  })

  it('no muta el array de sesiones original (inmutabilidad)', async () => {
    const original = state.plan.sesiones
    const snapshot = JSON.parse(JSON.stringify(original))
    await completarSesion('plan-1', 'Lunes', { rpe: 6 })
    expect(original).toEqual(snapshot)
  })
})

describe('completarSesion — el coach se entera (vía system prompt)', () => {
  const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50 min en 10K' }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('una sesión completada manualmente aparece como ✓ completada en el prompt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T10:00:00Z')) // jueves de la semana del plan

    const updated = await completarSesion('plan-1', 'Lunes', { rpe: 6 })
    const prompt = buildSystemPrompt(profile, 'cercano', null, updated)

    expect(prompt).toContain('Lunes (2026-05-11): Correr - Rodaje Z2 ✓ completada')
    expect(prompt).not.toContain('Lunes (2026-05-11): Correr - Rodaje Z2 [pasado')
    // Sección de reconocimiento proactivo
    expect(prompt).toContain('SESIONES COMPLETADAS ESTA SEMANA')
    expect(prompt).toContain('- Lunes: Correr (Rodaje Z2)')
  })

  it('una sesión completada vía Strava aparece etiquetada (Strava) en el prompt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T10:00:00Z'))

    const updated = await completarSesion('plan-1', 'Lunes', { via_strava: true })
    const prompt = buildSystemPrompt(profile, 'cercano', null, updated)

    expect(prompt).toContain('Lunes (2026-05-11): Correr - Rodaje Z2 ✓ completada (Strava)')
  })
})

describe('fechas — Europe/Madrid, no UTC', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getFechaSesion calcula la fecha de cada día desde el lunes de la semana', () => {
    expect(getFechaSesion(SEMANA, 'Lunes')).toBe('2026-05-11')
    expect(getFechaSesion(SEMANA, 'Miércoles')).toBe('2026-05-13')
    expect(getFechaSesion(SEMANA, 'Domingo')).toBe('2026-05-17')
  })

  it('getFechaSesion no se desplaza de día por zona horaria (patrón T12:00:00)', () => {
    // Si se parseara a medianoche, cualquier offset negativo movería el día.
    for (const dia of Object.keys(DIA_OFFSET_MAP)) {
      const fecha = getFechaSesion(SEMANA, dia)
      const esperado = new Date('2026-05-11T12:00:00')
      esperado.setDate(esperado.getDate() + DIA_OFFSET_MAP[dia])
      expect(fecha).toBe(esperado.toISOString().split('T')[0])
    }
  })

  it('getHoyMadrid devuelve la fecha de Madrid, no la UTC, en la madrugada', () => {
    vi.useFakeTimers()
    // 22:30 UTC del 9 de junio = 00:30 del 10 de junio en Madrid (verano, UTC+2)
    vi.setSystemTime(new Date('2026-06-09T22:30:00Z'))

    const utcStr = new Date().toISOString().split('T')[0]
    expect(utcStr).toBe('2026-06-09')
    expect(getHoyMadrid()).toBe('2026-06-10')
  })

  it('getHoyMadrid devuelve formato YYYY-MM-DD', () => {
    expect(getHoyMadrid()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
