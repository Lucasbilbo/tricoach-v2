// Regla común: los emails automáticos solo van a cuentas con actividad reciente (16-nov-2026).
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)
const F = '../../netlify/functions/'
const act = require(F + 'lib/actividad.js')
const dia3 = require(F + 'trial-dia3.js')
const react = require(F + 'trial-reactivacion.js')
const leer = f => readFileSync(join(__dirname, '../..', f), 'utf8')

const AHORA = Date.parse('2026-11-17T09:12:00Z')
const LUNES = '2026-11-16'
const id = n => `00000000-0000-4000-8000-00000000000${n}`
const VIEJA = '2026-06-01T10:00:00Z'
const perfil = (n, created_at = VIEJA) => ({ id: id(n), email: `u${n}@x.test`, nombre: `U${n}`, created_at })

// db de mentira: mensajes y planes por ruta
const dbCon = ({ mensajes = [], planes = [], falla = null } = {}) => vi.fn(async (metodo, ruta) => {
  if (falla && ruta.startsWith(falla)) return { ok: false, status: 500, data: null }
  if (ruta.startsWith('messages?')) return { ok: true, status: 200, data: mensajes }
  if (ruta.startsWith('plans?')) return { ok: true, status: 200, data: planes }
  return { ok: true, status: 204, data: null }
})

describe('cuentasActivas', () => {
  it('alta reciente es activa sin consultar nada más', async () => {
    const db = dbCon()
    const r = await act.cuentasActivas(db, [perfil(1, '2026-11-10T08:00:00Z')], { ahora: AHORA, lunes: LUNES })
    expect([...r.ids]).toEqual([id(1)])
    expect(db).not.toHaveBeenCalled()
  })

  it('cuenta antigua: activa solo si ha escrito al coach o tiene una sesión hecha; tener plan no basta', async () => {
    const db = dbCon({
      mensajes: [{ user_id: id(2) }],
      planes: [
        { user_id: id(3), sesiones: [{ tipo: 'Correr', completada: true }] },
        { user_id: id(4), sesiones: [{ tipo: 'Correr', completada: false }, { tipo: 'Descanso', completada: true }] },
      ],
    })
    const r = await act.cuentasActivas(db, [perfil(2), perfil(3), perfil(4), perfil(5)], { ahora: AHORA, lunes: LUNES })
    expect(r.ok).toBe(true)
    expect([...r.ids].sort()).toEqual([id(2), id(3)])
  })

  it('mira mensajes de usuario de 14 días y planes de esta semana y la anterior', () => {
    const m = decodeURIComponent(act.consultaMensajes([id(1)], AHORA))
    expect(m).toContain('role=eq.user')
    expect(m).toContain('created_at=gt.2026-11-03T09:12:00.000Z')
    expect(act.consultaPlanes([id(1)], LUNES)).toContain('semana=in.(2026-11-16,2026-11-09)')
  })

  it('si falla una lectura devuelve ok=false y ninguna cuenta', async () => {
    for (const falla of ['messages?', 'plans?']) {
      const r = await act.cuentasActivas(dbCon({ falla }), [perfil(1)], { ahora: AHORA, lunes: LUNES })
      expect(r.ok).toBe(false)
      expect(r.ids.size).toBe(0)
    }
  })

  it('ignora ids que no son UUID y trocea listas largas', async () => {
    const db = dbCon()
    const muchos = Array.from({ length: 120 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, created_at: VIEJA }))
    await act.cuentasActivas(db, [...muchos, { id: "x') or 1=1", created_at: VIEJA }], { ahora: AHORA, lunes: LUNES })
    expect(db).toHaveBeenCalledTimes(6) // 3 trozos × (mensajes + planes)
    expect(db.mock.calls.every(([, ruta]) => !ruta.includes('1=1'))).toBe(true)
  })
})

describe('secuencia de prueba: no se escribe a quien no ha vuelto', () => {
  const perfiles = [perfil(1), perfil(2, '2026-11-13T09:00:00Z')] // 1 = dormida con prueba concedida; 2 = alta nueva
  const db = (extra = {}) => vi.fn(async (metodo, ruta) => {
    if (metodo === 'PATCH') return { ok: true, status: 204, data: null }
    if (ruta.startsWith('profiles?')) return { ok: true, status: 200, data: perfiles }
    if (extra.falla && ruta.startsWith(extra.falla)) return { ok: false, status: 500, data: null }
    return { ok: true, status: 200, data: [] }
  })

  it('día 3: solo recibe la cuenta con actividad', async () => {
    const enviar = vi.fn(async () => ({ status: 200 }))
    const r = await dia3.procesar({ supa: db(), enviar, ahora: AHORA, lunes: LUNES, esperar: async () => {} })
    expect(r).toMatchObject({ candidatos: 1, sin_actividad: 1, enviados: 1 })
    expect(enviar.mock.calls[0][0]).toBe('u2@x.test')
  })

  it('reactivación: solo recibe la cuenta con actividad', async () => {
    const enviar = vi.fn(async () => ({ status: 200 }))
    const r = await react.procesar({ supa: db(), enviar, ahora: AHORA, esperar: async () => {} })
    expect(r).toMatchObject({ candidatos: 1, sin_actividad: 1, enviados: 1 })
    expect(enviar.mock.calls[0][0]).toBe('u2@x.test')
  })

  it('si no se puede leer la actividad, ninguno de los dos envía', async () => {
    for (const fn of [dia3, react]) {
      const enviar = vi.fn()
      const r = await fn.procesar({ supa: db({ falla: 'messages?' }), enviar, ahora: AHORA, lunes: LUNES, esperar: async () => {} })
      expect(r.error).toBe(true)
      expect(enviar).not.toHaveBeenCalled()
    }
  })

  it('los tres emails de prueba piden created_at y pasan por cuentasActivas antes de enviar', () => {
    for (const f of ['trial-dia3.js', 'trial-reminder.js', 'trial-reactivacion.js']) {
      const fn = leer('netlify/functions/' + f)
      expect(fn, f).toContain("require('./lib/actividad')")
      expect(fn, f).toMatch(/select=id,email,nombre[^`]*created_at/)
      expect(fn.indexOf('cuentasActivas('), f).toBeLessThan(fn.search(/await (enviar|sendEmail)\(/))
    }
  })
})
