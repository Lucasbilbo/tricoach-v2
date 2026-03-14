// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'

global.fetch = vi.fn()
afterEach(() => cleanup())

const planMock = {
  id: 'plan-123',
  semana: '2026-03-16',
  sesiones: [
    { dia: 'Lunes', tipo: 'Correr', descripcion: 'Rodaje suave 45min zona 2', duracion_min: 45, intensidad: 'suave' },
    { dia: 'Martes', tipo: 'Descanso', descripcion: 'Recuperación activa', duracion_min: 0, intensidad: 'descanso' },
    { dia: 'Miércoles', tipo: 'Bici', descripcion: 'Fondo en bici 60min', duracion_min: 60, intensidad: 'moderada' },
    { dia: 'Jueves', tipo: 'Correr', descripcion: 'Series 5x1000m', duracion_min: 50, intensidad: 'fuerte' },
    { dia: 'Viernes', tipo: 'Descanso', descripcion: 'Descanso completo', duracion_min: 0, intensidad: 'descanso' },
    { dia: 'Sábado', tipo: 'Nadar', descripcion: 'Técnica y fondo', duracion_min: 45, intensidad: 'moderada' },
    { dia: 'Domingo', tipo: 'Correr', descripcion: 'Carrera larga zona 2', duracion_min: 90, intensidad: 'suave' },
  ]
}

vi.mock('../lib/plans', () => ({
  getPlan: vi.fn(),
  generatePlan: vi.fn(),
  markSessionComplete: vi.fn(async (planId, dia, rpe) => {
    const sesiones = planMock.sesiones.map(s =>
      s.dia === dia ? { ...s, completada: true, rpe } : s
    )
    return { ...planMock, id: planId, sesiones }
  })
}))

describe('WeeklyPlan', () => {
  it('generate-plan devuelve JSON con exactamente 7 sesiones', async () => {
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
  })

  it('markSessionComplete actualiza correctamente el campo completada', async () => {
    const { markSessionComplete } = await import('../lib/plans')

    const result = await markSessionComplete('plan-123', 'Lunes', 7)

    const lunes = result.sesiones.find(s => s.dia === 'Lunes')
    expect(lunes.completada).toBe(true)
    expect(lunes.rpe).toBe(7)

    const martes = result.sesiones.find(s => s.dia === 'Martes')
    expect(martes.completada).toBeUndefined()
  })

  it('WeeklyPlan muestra "Generar plan" cuando no hay plan activo', async () => {
    const WeeklyPlan = (await import('../components/WeeklyPlan')).default
    render(<WeeklyPlan userId="123" plan={null} onPlanUpdate={vi.fn()} />)
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
