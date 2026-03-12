// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

window.HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [
                { id: '1', semana: '2026-03-09', sesiones: [{ tipo: 'Correr', completada: true }, { tipo: 'Descanso', completada: false }] },
                { id: '2', semana: '2026-03-02', sesiones: [{ tipo: 'Bici', completada: false }] },
              ],
              error: null
            }))
          }))
        })),
      })),
    })),
  }
}))

import { calcularConsistencia, getRecentPlans } from '../lib/plans'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function makePlan() {
  return {
    id: 'plan-1',
    semana: '2026-03-09',
    sesiones: [
      { dia: 'Lunes', tipo: 'Correr', descripcion: 'Rodaje suave', duracion_min: 45, intensidad: 'suave', completada: false },
      { dia: 'Martes', tipo: 'Nadar', descripcion: 'Técnica', duracion_min: 45, intensidad: 'moderada', completada: false },
      { dia: 'Miércoles', tipo: 'Descanso', descripcion: 'Descanso', duracion_min: 0, intensidad: 'descanso', completada: false },
      { dia: 'Jueves', tipo: 'Bici', descripcion: 'Fondo suave', duracion_min: 60, intensidad: 'suave', completada: false },
      { dia: 'Viernes', tipo: 'Fuerza', descripcion: 'Circuito', duracion_min: 40, intensidad: 'moderada', completada: false },
      { dia: 'Sábado', tipo: 'Correr', descripcion: 'Series', duracion_min: 50, intensidad: 'fuerte', completada: false },
      { dia: 'Domingo', tipo: 'Descanso', descripcion: 'Descanso', duracion_min: 0, intensidad: 'descanso', completada: false },
    ]
  }
}

describe('Fase 10.5: Dashboard, Progress y SessionDetail', () => {

  // ─── Test 1: Dashboard muestra la sesión de hoy ────────────────────────────
  it('Dashboard muestra la sesión correcta para el día de hoy', async () => {
    const { default: Dashboard } = await import('../components/Dashboard')
    const plan = makePlan()
    const today = DIAS_SEMANA[new Date().getDay()]
    const sesionHoy = plan.sesiones.find(s => s.dia === today)

    render(
      <Dashboard
        userId="user-1"
        plan={plan}
        profile={{ nombre: 'Lucas', nivel: 'intermedio' }}
        onPlanUpdate={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    if (sesionHoy && sesionHoy.tipo !== 'Descanso') {
      expect(screen.getByText(/Completar sesión/i)).toBeDefined()
    } else {
      // Rest day or day not in plan
      expect(screen.getByText(/Lucas/i)).toBeDefined()
    }
  })

  // ─── Test 2: Dashboard muestra "Generar mi plan" cuando no hay plan ─────────
  it('Dashboard muestra "Generar mi plan" cuando no hay plan', async () => {
    const { default: Dashboard } = await import('../components/Dashboard')
    render(
      <Dashboard
        userId="user-1"
        plan={null}
        profile={{ nombre: 'Lucas' }}
        onPlanUpdate={vi.fn()}
        onNavigate={vi.fn()}
      />
    )
    expect(screen.getByText(/Generar mi plan/i)).toBeDefined()
  })

  // ─── Test 3: calcularConsistencia calcula el % correctamente ────────────────
  it('calcularConsistencia calcula el porcentaje correctamente', () => {
    const planes = [
      {
        sesiones: [
          { tipo: 'Correr', completada: true },
          { tipo: 'Nadar', completada: false },
          { tipo: 'Descanso', completada: false },
          { tipo: 'Bici', completada: true },
        ]
      },
      {
        sesiones: [
          { tipo: 'Correr', completada: true },
          { tipo: 'Descanso', completada: false },
        ]
      }
    ]
    // Non-rest total: 3 (Correr, Nadar, Bici) + 1 (Correr) = 4
    // Completadas: 2 + 1 = 3 → 75%
    expect(calcularConsistencia(planes)).toBe(75)
  })

  // ─── Test 4: getRecentPlans devuelve el número correcto ─────────────────────
  it('getRecentPlans devuelve el número correcto de planes', async () => {
    const planes = await getRecentPlans('user-1', 2)
    expect(planes).toHaveLength(2)
  })

  // ─── Test 5: SessionDetail calcula el desglose de tiempo correctamente ──────
  it('SessionDetail calcula el desglose de tiempo correctamente para 60 min', async () => {
    const { default: SessionDetail } = await import('../components/SessionDetail')
    const sesion = {
      dia: 'Jueves',
      tipo: 'Correr',
      descripcion: 'Rodaje suave en zona 2',
      duracion_min: 60,
      intensidad: 'suave',
      completada: false,
    }
    render(
      <SessionDetail
        sesion={sesion}
        profile={{ nivel: 'intermedio' }}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    )
    // Calentamiento y vuelta a la calma: max(5, round(60*0.1)) = 6 min cada uno
    expect(screen.getAllByText('6 min')).toHaveLength(2)
    // Principal: 60 - 6 - 6 = 48 min
    expect(screen.getByText('48 min')).toBeDefined()
  })

})
