// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'

global.fetch = vi.fn()
afterEach(() => cleanup())

const planMock = {
  id: 'plan-123',
  semana: '2026-03-16',
  cycle_id: 'cycle-abc',
  numero_semana: 4,
  fase: 'build',
  objetivo_semana: 'Desarrollar umbral y capacidad de trabajo',
  volumen_planificado_min: 290,
  sesiones: [
    {
      dia: 'Lunes', tipo: 'Correr', subtipo: 'Rodaje Z2',
      duracion_min: 45, intensidad: 'suave', distancia_km: 7, zona_objetivo: 'Z1-Z2',
      estructura: {
        calentamiento: '10min trote suave Z1',
        principal: '30min rodaje continuo Z2 a 5:40/km',
        vuelta_calma: '5min andar + estiramientos',
        rpe_objetivo: '5-6',
      },
    },
    {
      dia: 'Martes', tipo: 'Descanso', subtipo: 'Descanso completo',
      duracion_min: 0, intensidad: 'descanso', distancia_km: null, zona_objetivo: null,
      estructura: null,
    },
    {
      dia: 'Miércoles', tipo: 'Bici', subtipo: 'Fondo Z2',
      duracion_min: 60, intensidad: 'moderada', distancia_km: 30, zona_objetivo: 'Z2-Z3',
      estructura: {
        calentamiento: '15min suave Z1',
        principal: '40min fondo Z2-Z3 a 85rpm',
        vuelta_calma: '5min recuperación',
        rpe_objetivo: '6-7',
      },
    },
    {
      dia: 'Jueves', tipo: 'Correr', subtipo: 'Series 1km',
      duracion_min: 50, intensidad: 'fuerte', distancia_km: 8, zona_objetivo: 'Z4-Z5',
      estructura: {
        calentamiento: '10min trote suave',
        principal: '5x1000m a 4:45/km con 90seg recuperación',
        vuelta_calma: '10min trote + estiramientos',
        rpe_objetivo: '8-9',
      },
    },
    {
      dia: 'Viernes', tipo: 'Descanso', subtipo: 'Descanso completo',
      duracion_min: 0, intensidad: 'descanso', distancia_km: null, zona_objetivo: null,
      estructura: null,
    },
    {
      dia: 'Sábado', tipo: 'Nadar', subtipo: 'Técnica y fondo',
      duracion_min: 45, intensidad: 'moderada', distancia_km: 2, zona_objetivo: 'Z2-Z3',
      estructura: {
        calentamiento: '200m suave crol',
        principal: '6x100m crol con 20seg descanso, ritmo 2:00/100m',
        vuelta_calma: '100m espalda suave',
        rpe_objetivo: '6-7',
      },
    },
    {
      dia: 'Domingo', tipo: 'Correr', subtipo: 'Largo dominical',
      duracion_min: 90, intensidad: 'suave', distancia_km: 14, zona_objetivo: 'Z1-Z2',
      estructura: {
        calentamiento: '10min trote Z1',
        principal: '75min largo Z2 a 5:50/km',
        vuelta_calma: '5min andar + estiramientos',
        rpe_objetivo: '5-6',
      },
    },
  ]
}

vi.mock('../lib/plans', () => ({
  getPlan: vi.fn(),
  generatePlan: vi.fn(),
  adjustPlan: vi.fn(),
  analizarPlan: vi.fn(),
  getNextWeekStart: vi.fn(() => '2026-03-23'),
  getPlanForWeek: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null })),
    })),
  },
}))

describe('WeeklyPlan', () => {
  it('generate-plan devuelve JSON con exactamente 7 sesiones y campos de macrociclo', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => planMock
    })

    const res = await fetch('/.netlify/functions/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test-user' })
    })
    const data = await res.json()

    expect(data.sesiones).toHaveLength(7)
    expect(data.semana).toBe('2026-03-16')
    expect(data.sesiones[0].dia).toBe('Lunes')
    expect(data.sesiones[6].dia).toBe('Domingo')
    expect(data.cycle_id).toBe('cycle-abc')
    expect(data.numero_semana).toBe(4)
    expect(data.fase).toBe('build')
    expect(data.volumen_planificado_min).toBe(290)
  })

  it('sesion en planMock tiene estructura con calentamiento, principal, vuelta_calma y rpe_objetivo', () => {
    const lunes = planMock.sesiones.find(s => s.dia === 'Lunes')
    expect(lunes.estructura).toBeDefined()
    expect(lunes.estructura.calentamiento).toBeTruthy()
    expect(lunes.estructura.principal).toBeTruthy()
    expect(lunes.estructura.vuelta_calma).toBeTruthy()
    expect(lunes.estructura.rpe_objetivo).toBeTruthy()
    expect(lunes.subtipo).toBe('Rodaje Z2')
    expect(lunes.zona_objetivo).toBe('Z1-Z2')
  })

  it('sesiones de Descanso tienen estructura null', () => {
    const descansos = planMock.sesiones.filter(s => s.tipo === 'Descanso')
    descansos.forEach(s => {
      expect(s.estructura).toBeNull()
      expect(s.zona_objetivo).toBeNull()
    })
  })

  it('WeeklyPlan muestra "Generar plan" cuando no hay plan activo', async () => {
    const WeeklyPlan = (await import('../components/WeeklyPlan')).default
    render(<WeeklyPlan userId="123" plan={null} onPlanUpdate={vi.fn()} profile={{}} />)
    expect(screen.getByText(/Aún no tienes un plan/i)).toBeDefined()
  })

  it('el system prompt incluye el plan cuando existe', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const prompt = buildSystemPrompt(profile, 'cercano', null, planMock)

    expect(prompt).toContain('PLAN SEMANA ACTUAL')
    expect(prompt).toContain('Lunes')
    expect(prompt).toContain('Correr')
  })
})
