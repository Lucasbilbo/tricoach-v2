/* eslint-env node */
import { describe, it, expect, vi } from 'vitest'

global.fetch = vi.fn()

describe('Funciones Netlify', () => {
  it('claude.js: devuelve error si no hay mensaje', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'mensaje requerido' })
    })

    const res = await fetch('/.netlify/functions/claude', {
      method: 'POST',
      body: JSON.stringify({})
    })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('strava.js: devuelve error si no hay token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'no autorizado' })
    })

    const res = await fetch('/.netlify/functions/strava')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('github-history.js: devuelve error si no hay token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'no autorizado' })
    })

    const res = await fetch('/.netlify/functions/github-history')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})