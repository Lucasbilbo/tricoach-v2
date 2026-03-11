import { describe, it, expect } from 'vitest'
import { canSendMessage } from '../lib/profiles'

describe('Límites plan Free', () => {
  it('usuario Pro siempre puede enviar mensajes', async () => {
    const profile = { plan: 'pro', messages_today: 999, last_message_date: '2026-03-11' }
    const result = await canSendMessage(profile)
    expect(result).toBe(true)
  })

  it('usuario Free puede enviar si no ha llegado al límite', async () => {
    const today = new Date().toISOString().split('T')[0]
    const profile = { plan: 'free', messages_today: 5, last_message_date: today }
    const result = await canSendMessage(profile)
    expect(result).toBe(true)
  })

  it('usuario Free no puede enviar si ha llegado al límite', async () => {
    const today = new Date().toISOString().split('T')[0]
    const profile = { plan: 'free', messages_today: 10, last_message_date: today }
    const result = await canSendMessage(profile)
    expect(result).toBe(false)
  })

  it('usuario Free puede enviar si es un día nuevo', async () => {
    const profile = { plan: 'free', messages_today: 10, last_message_date: '2020-01-01' }
    const result = await canSendMessage(profile)
    expect(result).toBe(true)
  })
})