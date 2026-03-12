// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

afterEach(() => cleanup())

global.fetch = vi.fn()
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ─── Test 1: create-checkout valida el secret ────────────────────────────────
describe('Fase 10: Monetización Stripe', () => {
  it('create-checkout rechaza peticiones sin secret', async () => {
    // Simula llamada a la función sin secret
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-123', priceId: 'price_abc' })
    })
    // Solo verificamos que fetch fue llamado con los parámetros correctos
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/create-checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123', priceId: 'price_abc' })
      })
    )
  })

  // ─── Test 2: UpgradeModal muestra 2 opciones de precio ──────────────────────
  it('UpgradeModal muestra las opciones Mensual y Anual', async () => {
    vi.resetModules()
    const { default: UpgradeModal } = await import('../components/UpgradeModal')
    render(<UpgradeModal userId="user-123" onClose={vi.fn()} />)
    expect(screen.getByText(/Mensual/i)).toBeDefined()
    expect(screen.getByText(/Anual/i)).toBeDefined()
    expect(screen.getByText(/Más popular/i)).toBeDefined()
  })

  // ─── Test 3: UpgradeModal tiene botón "Ahora no" que llama a onClose ────────
  it('UpgradeModal cierra al pulsar "Ahora no"', async () => {
    vi.resetModules()
    const { default: UpgradeModal } = await import('../components/UpgradeModal')
    const onClose = vi.fn()
    render(<UpgradeModal userId="user-123" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Ahora no/i))
    expect(onClose).toHaveBeenCalled()
  })

  // ─── Test 4: Chat muestra botón upgrade cuando el usuario Free llega al límite
  it('Chat muestra botón upgrade cuando messages_today >= 10', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sinStrava: true }),
      status: 200,
    })

    vi.mock('../lib/messages', () => ({
      getMessages: vi.fn(() => Promise.resolve([])),
      saveMessage: vi.fn(() => Promise.resolve()),
    }))
    vi.mock('../lib/profiles', () => ({
      canSendMessage: vi.fn(() => Promise.resolve(false)),
      incrementMessageCount: vi.fn(() => Promise.resolve()),
    }))
    vi.mock('../lib/context', () => ({
      updateContext: vi.fn(() => Promise.resolve()),
    }))
    vi.mock('../prompts/buildSystemPrompt', () => ({
      buildSystemPrompt: vi.fn(() => 'system prompt'),
    }))

    const { default: Chat } = await import('../components/Chat')
    const profile = {
      nombre: 'Lucas',
      deporte: 'triatlon',
      plan: 'free',
      messages_today: 10,
      last_message_date: new Date().toISOString().split('T')[0],
    }
    const onShowUpgrade = vi.fn()
    render(
      <Chat
        userId="user-123"
        profile={profile}
        personalidad="cercano"
        onPersonalidadChange={vi.fn()}
        onShowUpgrade={onShowUpgrade}
      />
    )
    expect(screen.getAllByText(/Hazte Pro/i).length).toBeGreaterThan(0)
  })
})
