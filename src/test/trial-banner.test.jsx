// Aviso de fin de prueba Pro y oferta de Pro durante la prueba.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'fs'
import { join } from 'path'
import TrialBanner from '../components/TrialBanner'
import { estadoPrueba, DIAS_AVISO, DIAS_TRAS_FIN } from '../lib/estadoPrueba'

const AHORA = Date.parse('2026-11-11T12:00:00Z')
const dias = n => new Date(AHORA + n * 86400000).toISOString()
const real = n => new Date(Date.now() + n * 86400000).toISOString()

describe('estadoPrueba', () => {
  it('sin prueba o Pro de pago → nada', () => {
    expect(estadoPrueba(null, AHORA)).toBe(null)
    expect(estadoPrueba({ plan: 'free', trial_ends_at: null }, AHORA)).toBe(null)
    expect(estadoPrueba({ plan: 'pro', trial_ends_at: dias(1) }, AHORA)).toBe(null)
    expect(estadoPrueba({ plan: 'free', trial_ends_at: 'x' }, AHORA)).toBe(null)
  })

  it('solo avisa en los últimos días de la prueba', () => {
    expect(estadoPrueba({ plan: 'free', trial_ends_at: dias(DIAS_AVISO + 2) }, AHORA)).toBe(null)
    expect(estadoPrueba({ plan: 'free', trial_ends_at: dias(DIAS_AVISO - 0.5) }, AHORA)).toBe('aviso')
    expect(estadoPrueba({ plan: 'free', trial_ends_at: dias(0.2) }, AHORA)).toBe('aviso')
  })

  it('prueba terminada: se avisa durante unos días y luego se deja de insistir', () => {
    expect(estadoPrueba({ plan: 'free', trial_ends_at: dias(-1) }, AHORA)).toBe('terminada')
    expect(estadoPrueba({ plan: 'free', trial_ends_at: dias(-(DIAS_TRAS_FIN + 1)) }, AHORA)).toBe(null)
  })
})

describe('TrialBanner', () => {
  beforeEach(() => localStorage.clear())

  it('últimos días: muestra los días que quedan y abre el pago', () => {
    const onShowUpgrade = vi.fn()
    render(<TrialBanner profile={{ plan: 'free', trial_ends_at: real(1.5) }} onShowUpgrade={onShowUpgrade} />)
    expect(screen.getByText(/quedan 2 días de prueba Pro/i)).toBeDefined()
    fireEvent.click(screen.getByText('Seguir en Pro'))
    expect(onShowUpgrade).toHaveBeenCalled()
  })

  it('terminada: se puede cerrar y no vuelve a salir', () => {
    const profile = { plan: 'free', trial_ends_at: real(-1) }
    const { unmount } = render(<TrialBanner profile={profile} onShowUpgrade={vi.fn()} />)
    expect(screen.getByText('Tu prueba Pro ha terminado')).toBeDefined()
    fireEvent.click(screen.getByText('Ahora no'))
    expect(screen.queryByText('Tu prueba Pro ha terminado')).toBe(null)
    unmount()
    render(<TrialBanner profile={profile} onShowUpgrade={vi.fn()} />)
    expect(screen.queryByText('Tu prueba Pro ha terminado')).toBe(null)
  })

  it('no sale para Pro de pago ni con la prueba recién empezada', () => {
    const { container } = render(<TrialBanner profile={{ plan: 'pro', trial_ends_at: real(1) }} onShowUpgrade={vi.fn()} />)
    expect(container.innerHTML).toBe('')
    const otro = render(<TrialBanner profile={{ plan: 'free', trial_ends_at: real(6.5) }} onShowUpgrade={vi.fn()} />)
    expect(otro.container.innerHTML).toBe('')
  })
})

describe('embudo de pago (regresiones)', () => {
  const leer = f => readFileSync(join(__dirname, '../..', f), 'utf8')

  it('tras pagar se vuelve a /app, no a la landing', () => {
    const fn = leer('netlify/functions/create-checkout.js')
    expect(fn).toContain('/app`')
    expect(fn).toContain('?upgrade=success')
    expect(fn).not.toContain("getricoach.com/?upgrade=success")
  })

  it('el navegador no necesita los ids de precio de Stripe', () => {
    expect(leer('src/components/UpgradeModal.jsx')).not.toContain('VITE_STRIPE_PRICE')
  })

  it('el chat ofrece Pro a quien no paga, también durante la prueba', () => {
    const chat = leer('src/components/Chat.jsx')
    expect(chat).toContain("const noPaga = profile?.plan !== 'pro'")
    expect(chat).toContain('{noPaga && onShowUpgrade && (')
  })

  it('el perfil ya no pide credenciales propias de Strava ni promete 150 mensajes', () => {
    const perfil = leer('src/components/EditProfile.jsx')
    expect(perfil).not.toContain('strava_client_secret')
    expect(perfil).not.toContain('150 mensajes')
  })
})
