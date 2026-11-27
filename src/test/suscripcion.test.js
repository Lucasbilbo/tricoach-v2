// Captura de email (motor B): enlaces firmados, doble confirmación y baja. Migración 015.
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
const ID = 'f9dca406-d648-4ba3-943d-a2b6ddef08db'

describe('lib/suscripcion', () => {
  beforeEach(() => { process.env.INTERNAL_API_SECRET = 'secreto-de-prueba' })

  it('el enlace firmado se verifica y cada acción tiene su firma', () => {
    const { urlAccion, verificar } = require('../../netlify/functions/lib/suscripcion')
    const q = Object.fromEntries(new URL(urlAccion('confirmar', ID)).searchParams)
    expect(verificar('confirmar', q.u, q.t)).toBe(true)
    expect(verificar('baja', q.u, q.t)).toBe(false) // el token de confirmar no vale para darse de baja
    expect(verificar('confirmar', '00000000-0000-0000-0000-000000000000', q.t)).toBe(false)
    expect(verificar('confirmar', ID, undefined)).toBe(false)
  })

  it('sin INTERNAL_API_SECRET no hay enlace', () => {
    delete process.env.INTERNAL_API_SECRET
    const { urlAccion } = require('../../netlify/functions/lib/suscripcion')
    expect(urlAccion('confirmar', ID)).toBeNull()
  })

  it('normaliza el email y el origen', () => {
    const { normalizarEmail, normalizarOrigen } = require('../../netlify/functions/lib/suscripcion')
    expect(normalizarEmail('  Ana@Correo.ES ')).toBe('ana@correo.es')
    expect(normalizarEmail('no-es-email')).toBeNull()
    expect(normalizarEmail('a@b.com, c@d.com')).toBeNull()
    expect(normalizarOrigen('plan-entrenamiento-10k')).toBe('plan-entrenamiento-10k')
    expect(normalizarOrigen('<script>')).toBe('web')
  })
})

describe('functions de suscripción', () => {
  beforeEach(() => { process.env.INTERNAL_API_SECRET = 'secreto-de-prueba' })

  it('suscribir-plan: email inválido → 400; campo trampa → 200 sin hacer nada', async () => {
    const { handler } = require('../../netlify/functions/suscribir-plan')
    const mal = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ email: 'x' }) })
    expect(mal.statusCode).toBe(400)
    const bot = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ email: 'a@b.com', website: 'spam' }) })
    expect(bot.statusCode).toBe(200)
  })

  it('suscripcion: GET solo enseña el botón; enlace inválido → 400', async () => {
    const { urlAccion } = require('../../netlify/functions/lib/suscripcion')
    const { handler } = require('../../netlify/functions/suscripcion')
    const q = Object.fromEntries(new URL(urlAccion('baja', ID)).searchParams)
    const r = await handler({ httpMethod: 'GET', queryStringParameters: q })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('Confirmar baja')
    const x = await handler({ httpMethod: 'POST', queryStringParameters: { a: 'baja', u: ID, t: 'x' } })
    expect(x.statusCode).toBe(400)
  })

  it('confirmar solo actúa sobre filas pendientes (una baja no se reactiva) y la migración activa RLS', () => {
    const src = fs.readFileSync('netlify/functions/suscripcion.js', 'utf8')
    expect(src).toContain('estado=eq.pendiente')
    const mig = fs.readFileSync('supabase/migrations/015_suscriptores_plan.sql', 'utf8')
    expect(mig).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('los formularios de las guías apuntan a la function y llevan campo trampa', () => {
    for (const f of ['plan-entrenamiento-10k.html', 'preparar-primer-triatlon.html']) {
      const h = fs.readFileSync(f, 'utf8')
      expect(h).toContain('/.netlify/functions/suscribir-plan')
      expect(h).toContain('name="website"')
    }
  })
})
