// Email del día 3 de la prueba Pro (nov-2026): ventana de selección, un solo dato del usuario,
// marca de envío, emails apagados y migración 010. La lógica pura no toca red.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)
const F = '../../netlify/functions/'
const td = require(F + 'trial-dia3.js')
const plantillas = require(F + 'lib/emails-usuario.js')
const leer = ruta => readFileSync(join(__dirname, '../../', ruta), 'utf8')

const ID1 = '11111111-1111-4111-8111-111111111111'
const ID2 = '22222222-2222-4222-8222-222222222222'
const AHORA = Date.parse('2026-11-14T09:12:00Z')

describe('selección y consulta', () => {
  it('pide cuentas no Pro, sin avisar, con prueba que acaba entre 3 y 4 días', () => {
    const q = decodeURIComponent(td.consultaPerfiles(AHORA))
    expect(q).toContain('plan=neq.pro')
    expect(q).toContain('trial_dia3_enviado_at=is.null')
    expect(q).toContain('deleted_at=is.null')
    expect(q).toContain('trial_ends_at=gt.2026-11-17T09:12:00.000Z')
    expect(q).toContain('trial_ends_at=lt.2026-11-18T09:12:00.000Z')
  })
  it('la consulta de planes descarta ids que no son UUID', () => {
    const q = td.consultaPlanes([ID1, "x') or (1=1"], '2026-11-09')
    expect(q).toContain(ID1)
    expect(q).not.toContain('1=1')
    expect(q).toContain('semana=eq.2026-11-09')
  })
  it('cuenta sesiones marcadas sin contar descansos', () => {
    expect(td.contarMarcadas([{ completada: true, tipo: 'Correr' }, { completada: 'true', tipo: 'Bici' }, { completada: true, tipo: 'Descanso' }, { completada: false, tipo: 'Nadar' }])).toBe(2)
    expect(td.contarMarcadas(null)).toBe(0)
  })
})

describe('procesar', () => {
  const base = () => {
    const llamadas = []
    const db = vi.fn(async (metodo, ruta, cuerpo) => {
      llamadas.push([metodo, ruta, cuerpo])
      if (metodo === 'GET' && ruta.startsWith('profiles?')) return { ok: true, data: [{ id: ID1, email: 'a@x.com', nombre: 'Ana' }, { id: ID2, email: 'b@x.com', nombre: 'Beto' }] }
      if (metodo === 'GET' && ruta.startsWith('plans?')) return { ok: true, data: [{ user_id: ID1, sesiones: [{ completada: true, tipo: 'Correr' }] }] }
      return { ok: true, status: 204 }
    })
    return { db, llamadas }
  }

  it('envía, personaliza con el plan de cada uno y marca solo los enviados', async () => {
    const { db, llamadas } = base()
    const html = []
    const enviar = vi.fn(async (_a, _asunto, h) => { html.push(h); return { status: enviar.mock.calls.length === 1 ? 200 : 500 } })
    const r = await td.procesar({ supa: db, enviar, ahora: AHORA, lunes: '2026-11-09', esperar: async () => {} })
    expect(r).toMatchObject({ candidatos: 2, enviados: 1, fallos: 1 })
    expect(html[0]).toContain('1 sesión marcada')
    expect(html[1]).toContain('Generar mi plan')
    const patches = llamadas.filter(l => l[0] === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0][1]).toBe(`profiles?id=eq.${ID1}`)
    expect(Object.keys(patches[0][2])).toEqual(['trial_dia3_enviado_at'])
  })
  it('respeta el presupuesto de tiempo y deja el resto pendiente', async () => {
    const { db } = base()
    let t = 0
    const r = await td.procesar({ supa: db, enviar: async () => ({ status: 200 }), ahora: AHORA, lunes: '2026-11-09', esperar: async () => {}, reloj: () => (t += 30000), presupuestoMs: 22000 })
    expect(r.pendientes).toBe(2)
    expect(r.enviados).toBe(0)
  })
  it('si no puede leer profiles devuelve error y no envía', async () => {
    const enviar = vi.fn()
    const r = await td.procesar({ supa: async () => ({ ok: false, status: 500 }), enviar, ahora: AHORA, lunes: '2026-11-09' })
    expect(r.error).toBe(true)
    expect(enviar).not.toHaveBeenCalled()
  })
})

describe('handler, plantilla y configuración', () => {
  afterEach(() => { delete process.env.EMAILS_ENABLED; delete process.env.INTERNAL_API_SECRET })

  it('sin autorización 401; con emails apagados no hace nada', async () => {
    process.env.INTERNAL_API_SECRET = 'secreto'
    expect((await td.handler({ headers: {} })).statusCode).toBe(401)
    const r = await td.handler({ headers: { 'x-internal-secret': 'secreto' } })
    expect(JSON.parse(r.body)).toEqual({ pausado: true })
  })
  it('netlify.toml lo programa cada día a las 09:12 UTC', () => {
    expect(leer('netlify.toml')).toMatch(/\[functions\."trial-dia3"\]\s+schedule = "12 9 \* \* \*"/)
  })
  it('la plantilla escapa el nombre, no cita Strava y tres variantes difieren', () => {
    const a = plantillas.buildDia3PruebaHtml('<b>Ana</b>', { tienePlan: true, sesionesMarcadas: 2 })
    expect(a).toContain('&lt;b&gt;Ana')
    expect(a).not.toContain('<b>Ana')
    expect(a).toContain('2 sesiones marcadas')
    expect(a).not.toMatch(/strava/i)
    expect(plantillas.buildDia3PruebaHtml('A', { tienePlan: false })).toContain('Generar mi plan')
    expect(plantillas.buildDia3PruebaHtml('A', { tienePlan: true, sesionesMarcadas: 0 })).toContain('ya está listo')
  })
  it('la migración 010 añade la columna y protege la marca como la 009', () => {
    const m = leer('supabase/migrations/010_trial_dia3.sql')
    expect(m).toContain('ADD COLUMN IF NOT EXISTS trial_dia3_enviado_at timestamptz')
    expect(m).toContain('NEW.trial_dia3_enviado_at := NULL;')
    expect(m).toContain('NEW.trial_dia3_enviado_at := OLD.trial_dia3_enviado_at;')
    const prev = leer('supabase/migrations/009_recordatorio_sesion.sql')
    for (const campo of ['recordatorio_enviado_el', 'capturas_semana', 'trial_aviso_enviado_at', 'trial_ends_at']) expect(m).toContain(`NEW.${campo} := OLD.${campo};`)
    expect(prev).toContain('profiles_proteger_campos')
  })
})
