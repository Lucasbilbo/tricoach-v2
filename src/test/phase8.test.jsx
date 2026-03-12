// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } } })),
    },
  },
}))

global.fetch = vi.fn()
afterEach(() => cleanup())

import { analizarPlan, adjustPlan } from '../lib/plans'
import WeeklyPlan from '../components/WeeklyPlan'

const PLAN_MOCK = {
  id: 'plan-123',
  semana: '2026-03-09',
  sesiones: [
    { dia: 'Lunes', tipo: 'Correr', descripcion: 'Rodaje suave', duracion_min: 45, intensidad: 'suave', completada: true, rpe: 7 },
    { dia: 'Martes', tipo: 'Descanso', descripcion: 'Descanso', duracion_min: 0, intensidad: 'descanso', completada: false },
    { dia: 'Miércoles', tipo: 'Nadar', descripcion: 'Técnica', duracion_min: 45, intensidad: 'moderada', completada: true, rpe: 5 },
    { dia: 'Jueves', tipo: 'Correr', descripcion: 'Series', duracion_min: 50, intensidad: 'fuerte', completada: false },
    { dia: 'Viernes', tipo: 'Bici', descripcion: 'Fondo', duracion_min: 60, intensidad: 'moderada', completada: false },
    { dia: 'Sábado', tipo: 'Brick', descripcion: 'Bici+run', duracion_min: 90, intensidad: 'moderada', completada: true, rpe: 8 },
    { dia: 'Domingo', tipo: 'Descanso', descripcion: 'Descanso', duracion_min: 0, intensidad: 'descanso', completada: false },
  ]
}

function getLastWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff - 7)
  return monday.toISOString().split('T')[0]
}

describe('Fase 8: Adaptabilidad del plan', () => {
  it('analizarPlan calcula correctamente sesiones completadas, RPE media y saltadas', () => {
    const analisis = analizarPlan(PLAN_MOCK)

    // completadas: Lunes, Miércoles, Sábado → 3
    expect(analisis.sesionesCompletadas).toBe(3)
    expect(analisis.sesionesTotales).toBe(7)

    // RPE: (7 + 5 + 8) / 3 = 6.666... → 6.7
    expect(analisis.rpeMedia).toBe(6.7)

    // saltadas (no completadas y tipo !== descanso): Jueves(Correr), Viernes(Bici) → 2
    // Martes(Descanso) y Domingo(Descanso) no cuentan como saltadas
    expect(analisis.sesionesSaltadas).toHaveLength(2)
    expect(analisis.sesionesSaltadas[0].dia).toBe('Jueves')
    expect(analisis.sesionesSaltadas[1].dia).toBe('Viernes')
  })

  it('analizarPlan devuelve null si no hay plan', () => {
    expect(analizarPlan(null)).toBeNull()
    expect(analizarPlan(undefined)).toBeNull()
    expect(analizarPlan({})).toBeNull()
  })

  it('adjustPlan llama a la función correcta con los parámetros correctos', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...PLAN_MOCK })
    })

    await adjustPlan('user-123', 'plan-123', 'lesion', 'rodilla derecha')

    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/adjust-plan',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
          planId: 'plan-123',
          motivo: 'lesion',
          descripcion: 'rodilla derecha'
        })
      })
    )
  })

  it('banner de semana nueva aparece cuando el plan es de la semana pasada', () => {
    const oldPlan = { ...PLAN_MOCK, semana: getLastWeekStart() }
    render(<WeeklyPlan userId="123" plan={oldPlan} onPlanUpdate={vi.fn()} />)
    expect(screen.getByText(/Nueva semana/i)).toBeDefined()
  })
})
