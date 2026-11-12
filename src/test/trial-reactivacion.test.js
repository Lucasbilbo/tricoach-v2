// Email de reactivación tras caducar la prueba Pro (nov-2026): ventana, marca de envío,
// emails apagados, plantilla sin descuentos inventados y migración 011.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)
const F = '../../netlify/functions/'
const tr = require(F + 'trial-reactivacion.js')
const plantillas = require(F + 'lib/emails-usuario.js')
const leer = ruta => readFileSync(join(__dirname, '../../', ruta), 'utf8')

const ID1 = '11111111-1111-4111-8111-111111111111'
const ID2 = '22222222-2222-4222-8222-222222222222'
const AHORA = Date.parse('2026-11-20T09:42:00Z')

describe('consulta', () => {
  it('pide cuentas no Pro, sin email previo, con prueba acabada hace entre 3 y 4 días', () => {
    const q = decodeURIComponent(tr.consultaPerfiles(AHORA))
    expect(q).toContain('plan=neq.pro')
    expect(q).toContain('trial_reactivacion_enviada_at=is.null')
    expect(q).toContain('deleted_at=is.null')
    expect(q).toContain('trial_ends_at=gt.2026-11-16T09:42:00.000Z')
    expect(q).toContain('trial_ends_at=lt.2026-11-17T09:42:00.000Z')
  })
})

describe('procesar', () => {
  const base = () => {
    const llamadas = []
    const db = vi.fn(async (metodo, ruta, cuerpo) => {
      llamadas.push([metodo, ruta, cuerpo])
      if (metodo === 'GET') return { ok: true, data: [{ id: ID1, email: 'a@x.com', nombre: 'Ana' }, { id: ID2, email: 'b@x.com', nombre: 'Beto' }, { id: 'no-uuid', email: 'c@x.com' }] }
      return { ok: true, status: 204 }
    })
    return { db, llamadas }
  }
  it('envía a los válidos y marca solo a los enviados', async () => {
    const { db, llamadas } = base()
    const enviar = vi.fn(async () => ({ status: enviar.mock.calls.length === 1 ? 200 : 500 }))
    const r = await tr.procesar({ supa: db, enviar, ahora: AHORA, esperar: async () => {} })
    expect(r).toMatchObject({ candidatos: 2, enviados: 1, fallos: 1 })
    const patches = llamadas.filter(l => l[0] === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0][1]).toBe(`profiles?id=eq.${ID1}`)
    expect(Object.keys(patches[0][2])).toEqual(['trial_reactivacion_enviada_at'])
  })
  it('respeta el presupuesto de tiempo', async () => {
    const { db } = base()
    let t = 0
    const r = await tr.procesar({ supa: db, enviar: async () => ({ status: 200 }), ahora: AHORA, esperar: async () => {}, reloj: () => (t += 30000), presupuestoMs: 22000 })
    expect(r.pendientes).toBe(2)
    expect(r.enviados).toBe(0)
  })
  it('si no puede leer profiles devuelve error y no envía', async () => {
    const enviar = vi.fn()
    const r = await tr.procesar({ supa: async () => ({ ok: false, status: 500 }), enviar, ahora: AHORA })
    expect(r.error).toBe(true)
    expect(enviar).not.toHaveBeenCalled()
  })
})

describe('handler, plantilla y configuración', () => {
  afterEach(() => { delete process.env.EMAILS_ENABLED; delete process.env.INTERNAL_API_SECRET })

  it('sin autorización 401; con emails apagados no hace nada', async () => {
    process.env.INTERNAL_API_SECRET = 'secreto'
    expect((await tr.handler({ headers: {} })).statusCode).toBe(401)
    const r = await tr.handler({ headers: { 'x-internal-secret': 'secreto' } })
    expect(JSON.parse(r.body)).toEqual({ pausado: true })
  })
  it('netlify.toml lo programa cada día a las 09:42 UTC', () => {
    expect(leer('netlify.toml')).toMatch(/\[functions\."trial-reactivacion"\]\s+schedule = "42 9 \* \* \*"/)
  })
  it('la plantilla escapa el nombre, usa los precios reales y no cita Strava', () => {
    const h = plantillas.buildReactivacionPruebaHtml('<b>Ana</b>')
    expect(h).toContain('&lt;b&gt;Ana')
    expect(h).not.toContain('<b>Ana')
    expect(h).toContain('14,99 €')
    expect(h).toContain('119 €')
    expect(h).toContain('ahorras 61 €')
    expect(h).not.toMatch(/strava|descuento|%/i)
  })
  it('la migración 011 añade la columna y conserva la protección de la 010', () => {
    const m = leer('supabase/migrations/011_trial_reactivacion.sql')
    expect(m).toContain('ADD COLUMN IF NOT EXISTS trial_reactivacion_enviada_at timestamptz')
    for (const c of ['trial_reactivacion_enviada_at', 'trial_dia3_enviado_at', 'recordatorio_enviado_el', 'trial_ends_at']) {
      expect(m).toContain(`NEW.${c} := OLD.${c};`)
    }
    expect(m).toContain('NEW.trial_reactivacion_enviada_at := NULL;')
  })
})
