// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Login from '../components/Login'

afterEach(() => cleanup())

describe('Autenticación', () => {
  it('muestra el botón de login con Google', () => {
    render(<Login />)
    expect(screen.getByText('Iniciar sesión con Google')).toBeDefined()
  })

  it('muestra el título de la app', () => {
    render(<Login />)
    expect(screen.getByText('TriCoach AI')).toBeDefined()
  })
})