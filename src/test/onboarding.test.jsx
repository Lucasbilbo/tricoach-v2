// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Onboarding from '../components/Onboarding'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  },
}))

afterEach(() => cleanup())

describe('Onboarding', () => {
  it('muestra el primer paso con campo de nombre', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    expect(screen.getByText('¿Cómo te llamas?')).toBeDefined()
    expect(screen.getByPlaceholderText('Tu nombre')).toBeDefined()
  })

  it('avanza al paso 2 al pulsar Siguiente con nombre relleno', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucas' } })
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('¿Qué deporte practicas?')).toBeDefined()
  })

  it('avanza al paso 3 al pulsar Siguiente con deporte seleccionado', () => {
    render(<Onboarding userId="123" onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucas' } })
    fireEvent.click(screen.getByText('Siguiente'))
    fireEvent.click(screen.getByText('Running'))
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('¿Cuál es tu nivel?')).toBeDefined()
  })
})