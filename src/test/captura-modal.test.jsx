// El modal de completar sesión rellena los campos con lo leído de la captura.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../lib/captura', () => ({ analizarCaptura: vi.fn() }))
vi.mock('../lib/plans', () => ({ completarSesion: vi.fn(async () => ({ id: 'p1' })) }))
vi.mock('../lib/analytics', () => ({ track: vi.fn() }))

import ModalCompletarSesion from '../components/ModalCompletarSesion'
import { analizarCaptura } from '../lib/captura'
import { completarSesion } from '../lib/plans'

const sesion = { dia: 'Martes', tipo: 'Correr', subtipo: 'Rodaje Z2', duracion_min: 45, distancia_km: 8, estructura: { rpe_objetivo: '5-6' } }
const profile = { id: '11111111-1111-4111-8111-111111111111', plan: 'free' }
const archivo = new File(['x'], 'captura.png', { type: 'image/png' })

function abrir() {
  return render(<ModalCompletarSesion sesion={sesion} planId="p1" profile={profile} onClose={vi.fn()} onComplete={vi.fn()} />)
}

describe('ModalCompletarSesion — captura', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rellena duración, distancia y pulso, enseña el comentario y guarda lo revisado', async () => {
    analizarCaptura.mockResolvedValue({ duracion_min: 52, distancia_km: 9.4, fc_media: 147, ritmo: '5:32 /km', deporte: 'Correr', comentario: 'Has alargado un poco el rodaje, bien controlado.' })
    abrir()
    fireEvent.change(screen.getByTestId('input-captura'), { target: { files: [archivo] } })

    await waitFor(() => expect(screen.getByText('Has alargado un poco el rodaje, bien controlado.')).toBeDefined())
    expect(analizarCaptura).toHaveBeenCalledWith(profile.id, archivo, sesion)
    expect(screen.getByDisplayValue('52')).toBeDefined()
    expect(screen.getByDisplayValue('9.4')).toBeDefined()
    expect(screen.getByDisplayValue('147')).toBeDefined() // el campo de pulso aparece aunque el perfil no tenga FC máxima
    expect(screen.getByText(/Revísalos antes de guardar/)).toBeDefined()

    fireEvent.click(screen.getByText(/^Guardar/))
    await waitFor(() => expect(completarSesion).toHaveBeenCalled())
    const campos = completarSesion.mock.calls[0][2]
    expect(campos.tiempo_real_min).toBe(52)
    expect(campos.distancia_real_km).toBe(9.4)
    expect(campos.fc_media_real).toBe(147)
  })

  it('si no se puede leer, enseña el motivo y no toca los campos', async () => {
    analizarCaptura.mockRejectedValue(new Error('No he encontrado datos de un entreno en la imagen.'))
    abrir()
    fireEvent.change(screen.getByTestId('input-captura'), { target: { files: [archivo] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No he encontrado datos'))
    expect(screen.getByDisplayValue('45')).toBeDefined()
    expect(screen.getByDisplayValue('8')).toBeDefined()
  })
})
