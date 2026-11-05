// @vitest-environment jsdom
// Onboarding de 3 pantallas (nov-2026): tú → objetivo → tu semana.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import Onboarding from '../components/Onboarding'

const update = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update: (...a) => update(...a) })) },
}))

afterEach(() => { cleanup(); update.mockClear(); localStorage.clear() })

function pantallaUno() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucas' } })
  fireEvent.click(screen.getByText('Running'))
  fireEvent.click(screen.getByText('Intermedio'))
  fireEvent.click(screen.getByText('Siguiente'))
}

describe('Onboarding', () => {
  it('la primera pantalla pide nombre, deportes y nivel a la vez', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    expect(screen.getByPlaceholderText('Tu nombre')).toBeDefined()
    expect(screen.getByText('Running')).toBeDefined()
    expect(screen.getByText('Triatlón')).toBeDefined()
  })

  it('no avanza sin nombre ni deporte y avisa', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Tu nombre es obligatorio')).toBeDefined()
    expect(screen.getByText('Selecciona al menos un deporte para continuar')).toBeDefined()
  })

  it('con un solo deporte exige el nivel', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucas' } })
    fireEvent.click(screen.getByText('Running'))
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Selecciona tu nivel para continuar')).toBeDefined()
  })

  it('con todo relleno pasa a la pantalla de objetivo', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    pantallaUno()
    expect(screen.getByText('¿Cuáles son tus próximas carreras?')).toBeDefined()
  })

  it('termina en la pantalla "Tu semana" y guarda perfil con defaults del coach', async () => {
    const onComplete = vi.fn()
    render(<Onboarding userId="123" onComplete={onComplete} />)
    pantallaUno()
    fireEvent.click(screen.getByText('No tengo carrera todavía'))
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Tu semana')).toBeDefined()

    // sin disponibilidad no deja terminar
    fireEvent.click(screen.getByText('¡Crear mi plan!'))
    expect(screen.getByText('Selecciona al menos un horario disponible')).toBeDefined()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Lunes mañana'))
    fireEvent.click(screen.getByText('No tengo lesiones actuales'))
    fireEvent.click(screen.getByText('¡Crear mi plan!'))

    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    const guardado = update.mock.calls[0][0]
    expect(guardado).toMatchObject({
      nombre: 'Lucas',
      deporte: 'running',
      nivel: 'intermedio',
      personalidad: 'cercano',
      nombre_coach: 'Coach',
      disponibilidad: 'Lunes mañana',
      lesiones: 'Sin lesiones actuales',
    })
    expect(localStorage.getItem('onboarding_just_completed')).toBe('Lucas')
  })
})
