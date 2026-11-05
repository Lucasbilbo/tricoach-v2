import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import crypto from 'crypto'

const require = createRequire(import.meta.url)
const { calcularSinRespuesta } = require('../../netlify/functions/lib/salud')
const { elegirSucesor } = require('../../netlify/functions/lib/claude')
const { verificarFirma, decidirAccion, quedaSuscripcionViva } = require('../../netlify/functions/lib/stripe-eventos')

const AHORA = Date.parse('2026-11-06T12:00:00Z')
const min = (n) => new Date(AHORA - n * 60000).toISOString()

describe('calcularSinRespuesta (errores reales de usuarios)', () => {
  it('sin mensajes no hay alerta', () => {
    expect(calcularSinRespuesta([], AHORA)).toMatchObject({ total: 0, sinRespuesta: 0, alerta: false })
  })

  it('mensajes respondidos no cuentan como fallo', () => {
    const msgs = [
      { user_id: 'a', role: 'user', created_at: min(60) },
      { user_id: 'a', role: 'assistant', created_at: min(59) },
    ]
    expect(calcularSinRespuesta(msgs, AHORA)).toMatchObject({ total: 1, sinRespuesta: 0, alerta: false })
  })

  it('alerta cuando varios usuarios no reciben respuesta', () => {
    const msgs = ['a', 'b', 'c', 'd'].map(u => ({ user_id: u, role: 'user', created_at: min(120) }))
    const r = calcularSinRespuesta(msgs, AHORA)
    expect(r).toMatchObject({ total: 4, sinRespuesta: 4, alerta: true })
  })

  it('ignora mensajes recientes (aún pueden estar en curso)', () => {
    const msgs = ['a', 'b', 'c'].map(u => ({ user_id: u, role: 'user', created_at: min(2) }))
    expect(calcularSinRespuesta(msgs, AHORA)).toMatchObject({ total: 0, alerta: false })
  })

  it('no alerta por pocos fallos aislados dentro de mucha actividad sana', () => {
    const msgs = []
    for (let i = 0; i < 20; i++) {
      msgs.push({ user_id: `u${i}`, role: 'user', created_at: min(100) })
      msgs.push({ user_id: `u${i}`, role: 'assistant', created_at: min(99) })
    }
    msgs.push({ user_id: 'x', role: 'user', created_at: min(100) })
    expect(calcularSinRespuesta(msgs, AHORA).alerta).toBe(false)
  })

  it('quien llega a 10 mensajes se excluye (puede ser el límite diario, no un fallo)', () => {
    const msgs = Array.from({ length: 12 }, (_, i) => ({ user_id: 'a', role: 'user', created_at: min(200 - i) }))
    expect(calcularSinRespuesta(msgs, AHORA)).toMatchObject({ total: 0, alerta: false })
  })
})

describe('elegirSucesor (modelo retirado)', () => {
  const modelos = [
    { id: 'claude-haiku-5-5', created_at: '2026-06-01T00:00:00Z' },
    { id: 'claude-haiku-5-6', created_at: '2027-02-01T00:00:00Z' },
    { id: 'claude-sonnet-5-5', created_at: '2026-06-01T00:00:00Z' },
    { id: 'claude-opus-5-5', created_at: '2026-09-01T00:00:00Z' },
  ]
  it('elige el más reciente de la misma familia', () => {
    expect(elegirSucesor(modelos, 'claude-haiku-4-5')).toBe('claude-haiku-5-6')
  })
  it('no devuelve el propio modelo retirado ni otra familia', () => {
    expect(elegirSucesor(modelos, 'claude-sonnet-5-5')).toBeNull()
    expect(elegirSucesor(modelos, 'gpt-4')).toBeNull()
  })
})

describe('webhook de Stripe', () => {
  const secret = 'whsec_test'
  const firmar = (body, t) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

  it('acepta firma válida y reciente', () => {
    const t = 1_800_000_000
    expect(verificarFirma('{}', firmar('{}', t), secret, t + 10)).toBe(true)
  })
  it('rechaza firma manipulada, antigua o de longitud distinta (sin lanzar)', () => {
    const t = 1_800_000_000
    expect(verificarFirma('{"a":1}', firmar('{}', t), secret, t)).toBe(false)
    expect(verificarFirma('{}', firmar('{}', t), secret, t + 3600)).toBe(false)
    expect(verificarFirma('{}', `t=${t},v1=abc`, secret, t)).toBe(false)
    expect(verificarFirma('{}', null, secret, t)).toBe(false)
  })

  it('decide la acción de cada evento', () => {
    const ev = (type, object) => ({ type, data: { object } })
    expect(decidirAccion(ev('checkout.session.completed', { customer: 'cus_1', metadata: { userId: 'u' } })).accion).toBe('activar')
    expect(decidirAccion(ev('customer.subscription.deleted', { customer: 'cus_1' })).accion).toBe('revisar_baja')
    expect(decidirAccion(ev('customer.subscription.updated', { customer: 'cus_1', status: 'unpaid' })).accion).toBe('revisar_baja')
    expect(decidirAccion(ev('customer.subscription.updated', { customer: 'cus_1', status: 'active' })).accion).toBe('reactivar')
    expect(decidirAccion(ev('customer.subscription.updated', { customer: 'cus_1', status: 'past_due' })).accion).toBe('ignorar')
    const fallo = decidirAccion(ev('invoice.payment_failed', { customer: 'cus_1', amount_due: 999, attempt_count: 2, customer_email: 'a@b.c' }))
    expect(fallo).toMatchObject({ accion: 'avisar_pago', importe: 9.99, intento: 2 })
    expect(decidirAccion(ev('otra.cosa', {})).accion).toBe('ignorar')
  })

  it('solo se baja a Free si no queda ninguna suscripción viva', () => {
    expect(quedaSuscripcionViva([{ status: 'canceled' }, { status: 'active' }])).toBe(true)
    expect(quedaSuscripcionViva([{ status: 'past_due' }])).toBe(true)
    expect(quedaSuscripcionViva([{ status: 'canceled' }, { status: 'unpaid' }])).toBe(false)
    expect(quedaSuscripcionViva([])).toBe(false)
  })
})
