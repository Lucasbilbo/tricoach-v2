// Recordatorio el día de la sesión (nov-2026): selección de destinatarios, día en Madrid,
// una vez al día, baja, marcas y plantilla. La lógica pura no toca red.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'
import { recordatoriosActivados, cambioRecordatorios } from '../lib/profiles'

const require = createRequire(import.meta.url)
const F = '../../netlify/functions/'
const sr = require(F + 'session-reminder.js')
const plantillas = require(F + 'lib/emails-usuario.js')
const { getHoyMadrid, getMondayOfCurrentWeek } = require(F + 'lib/fechas.js')
const leer = f => readFileSync(join(__dirname, '../..', f), 'utf8')

const HOY = '2026-11-12'   // jueves
const LUNES = '2026-11-09'
const ctx = { hoy: HOY, lunes: LUNES }

const sesiones = (extra = {}) => [
  { dia: 'Lunes', tipo: 'Correr', subtipo: 'Rodaje Z2', duracion_min: 45, completada: true },
  { dia: 'Jueves', tipo: 'Bici', subtipo: 'Series', duracion_min: 70, completada: false, ...extra },
  { dia: 'Viernes', tipo: 'Descanso', intensidad: 'descanso', completada: false },
]
const perfil = (id, extra = {}) => ({ id, email: `${id}@x.test`, nombre: id, recordatorios_email: true, recordatorio_enviado_el: null, deleted_at: null, ...extra })
const plan = (user_id, ses = sesiones(), semana = LUNES) => ({ user_id, semana, sesiones: ses })

describe('día de la semana en Madrid', () => {
  afterEach(() => vi.useRealTimers())

  it('diaSemanaDe devuelve el nombre del día de una fecha ISO', () => {
    expect(sr.diaSemanaDe('2026-11-09')).toBe('Lunes')
    expect(sr.diaSemanaDe('2026-11-11')).toBe('Miércoles')
    expect(sr.diaSemanaDe('2026-11-12')).toBe('Jueves')
    expect(sr.diaSemanaDe('2026-11-15')).toBe('Domingo')
  })

  it('el cron de las 18:30 UTC cae en el mismo día en Madrid (invierno y verano)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T18:30:00Z'))
    expect(getHoyMadrid()).toBe('2026-11-12')
    expect(sr.diaSemanaDe(getHoyMadrid())).toBe('Jueves')
    vi.setSystemTime(new Date('2026-07-16T18:30:00Z'))
    expect(getHoyMadrid()).toBe('2026-07-16')
    expect(sr.diaSemanaDe(getHoyMadrid())).toBe('Jueves')
  })

  it('pasada la medianoche de Madrid ya es el día siguiente (y su lunes)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T23:30:00Z')) // domingo UTC, lunes 00:30 en Madrid
    expect(getHoyMadrid()).toBe('2026-11-16')
    expect(sr.diaSemanaDe(getHoyMadrid())).toBe('Lunes')
    expect(getMondayOfCurrentWeek()).toBe('2026-11-16')
  })
})

describe('sesionPendienteDeHoy', () => {
  it('devuelve la sesión de hoy si no es descanso ni está completada', () => {
    expect(sr.sesionPendienteDeHoy(sesiones(), 'Jueves').tipo).toBe('Bici')
  })
  it('descarta descansos, completadas (boolean, número o texto) y días sin sesión', () => {
    expect(sr.sesionPendienteDeHoy(sesiones(), 'Viernes')).toBeNull()
    expect(sr.sesionPendienteDeHoy(sesiones(), 'Lunes')).toBeNull()
    for (const c of [true, 1, 'true']) expect(sr.sesionPendienteDeHoy(sesiones({ completada: c }), 'Jueves')).toBeNull()
    expect(sr.sesionPendienteDeHoy(sesiones(), 'Sábado')).toBeNull()
    expect(sr.sesionPendienteDeHoy(null, 'Jueves')).toBeNull()
  })
  it('tolera tildes y mayúsculas en el día y el tipo', () => {
    const s = [{ dia: 'miercoles', tipo: 'Nadar', completada: false }, { dia: 'Sábado', tipo: 'DESCANSO' }]
    expect(sr.sesionPendienteDeHoy(s, 'Miércoles').tipo).toBe('Nadar')
    expect(sr.sesionPendienteDeHoy(s, 'Sábado')).toBeNull()
  })
})

describe('seleccionarDestinatarios', () => {
  it('Free y Pro por igual: solo cuenta que haya plan esta semana con sesión pendiente hoy', () => {
    const perfiles = [perfil('free', { plan: 'free' }), perfil('pro', { plan: 'pro' })]
    const r = sr.seleccionarDestinatarios(perfiles, [plan('free'), plan('pro')], ctx)
    expect(r.map(x => x.perfil.id)).toEqual(['free', 'pro'])
    expect(r[0].sesion.tipo).toBe('Bici')
  })
  it('excluye borradas, sin email, de baja y con plan de otra semana o sin plan', () => {
    const perfiles = [
      perfil('borrada', { deleted_at: '2026-11-01T00:00:00Z' }),
      perfil('sinemail', { email: null }),
      perfil('baja', { recordatorios_email: false }),
      perfil('otrasemana'),
      perfil('sinplan'),
      perfil('ok'),
    ]
    const planes = [plan('borrada'), plan('sinemail'), plan('baja'), plan('otrasemana', sesiones(), '2026-11-02'), plan('ok')]
    expect(sr.seleccionarDestinatarios(perfiles, planes, ctx).map(x => x.perfil.id)).toEqual(['ok'])
  })
  it('no hay sesión pendiente hoy (descanso o completada): no se envía', () => {
    const perfiles = [perfil('descansa'), perfil('hecha')]
    const planes = [plan('descansa', [{ dia: 'Jueves', tipo: 'Descanso' }]), plan('hecha', sesiones({ completada: true }))]
    expect(sr.seleccionarDestinatarios(perfiles, planes, ctx)).toEqual([])
  })
  it('un email por cuenta y día: si ya se envió hoy no se repite; ayer no cuenta', () => {
    expect(sr.seleccionarDestinatarios([perfil('a', { recordatorio_enviado_el: HOY })], [plan('a')], ctx)).toEqual([])
    expect(sr.seleccionarDestinatarios([perfil('a', { recordatorio_enviado_el: '2026-11-11' })], [plan('a')], ctx)).toHaveLength(1)
  })
  it('perfiles o planes duplicados no duplican el envío; recordatorios_email ausente cuenta como activado', () => {
    const p = perfil('a'); delete p.recordatorios_email
    expect(sr.seleccionarDestinatarios([p, p], [plan('a'), plan('a')], ctx)).toHaveLength(1)
  })
})

describe('procesar (envío, marcas, ritmo y presupuesto)', () => {
  const montar = ({ perfiles, planes, estados = {}, reloj }) => {
    const parches = []
    const enviados = []
    const supa = vi.fn(async (metodo, ruta, cuerpo) => {
      if (metodo === 'PATCH') { parches.push({ ruta, cuerpo }); return { ok: true, status: 204, data: null } }
      if (ruta.startsWith('profiles?')) return { ok: true, status: 200, data: perfiles }
      return { ok: true, status: 200, data: planes }
    })
    const enviar = vi.fn(async (para, asunto) => { enviados.push({ para, asunto }); return { status: estados[para] ?? 200 } })
    const esperar = vi.fn(async () => {})
    return { parches, enviados, supa, enviar, esperar, args: { supa, enviar, esperar, reloj, hoy: HOY, lunes: LUNES } }
  }

  it('marca recordatorio_enviado_el solo si el envío sale bien', async () => {
    const m = montar({ perfiles: [perfil('a'), perfil('b')], planes: [plan('a'), plan('b')], estados: { 'b@x.test': 500 } })
    const r = await sr.procesar(m.args)
    expect(r).toMatchObject({ destinatarios: 2, enviados: 1, fallos: 1, pendientes: 0 })
    expect(m.parches).toEqual([{ ruta: 'profiles?id=eq.a', cuerpo: { recordatorio_enviado_el: HOY } }])
  })

  it('respeta el límite de Resend: pausa entre envíos', async () => {
    const m = montar({ perfiles: [perfil('a'), perfil('b'), perfil('c')], planes: [plan('a'), plan('b'), plan('c')] })
    await sr.procesar(m.args)
    expect(m.esperar).toHaveBeenCalledTimes(3)
    expect(m.esperar.mock.calls.every(([ms]) => ms >= 500)).toBe(true)
  })

  it('para al agotar el presupuesto y deja el resto como pendientes sin marcar', async () => {
    let t = 0
    const m = montar({ perfiles: [perfil('a'), perfil('b'), perfil('c')], planes: [plan('a'), plan('b'), plan('c')], reloj: () => (t += 15000) })
    const r = await sr.procesar({ ...m.args, presupuestoMs: 22000 })
    expect(r.enviados + r.pendientes).toBe(3)
    expect(r.pendientes).toBeGreaterThan(0)
    expect(m.parches).toHaveLength(r.enviados)
  })

  it('si no puede leer perfiles o planes no envía nada', async () => {
    const supa = vi.fn(async () => ({ ok: false, status: 500, data: null }))
    const enviar = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sr.procesar({ supa, enviar, hoy: HOY, lunes: LUNES })
    expect(r.error).toBe(true)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('la consulta de perfiles excluye borradas, bajas y los ya enviados hoy', () => {
    const q = sr.consultaPerfiles(HOY)
    expect(q).toContain('deleted_at=is.null')
    expect(q).toContain('recordatorios_email=eq.true')
    expect(q).toContain(`recordatorio_enviado_el.lt.${HOY}`)
  })
})

describe('handler y configuración', () => {
  afterEach(() => { delete process.env.EMAILS_ENABLED; delete process.env.INTERNAL_API_SECRET })

  it('sin autorización responde 401; con emails apagados no hace nada (ni lee la base)', async () => {
    process.env.INTERNAL_API_SECRET = 'secreto'
    expect((await sr.handler({ headers: {} })).statusCode).toBe(401)
    const r = await sr.handler({ headers: { 'x-internal-secret': 'secreto' } })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.body)).toEqual({ pausado: true })
  })

  it('netlify.toml programa session-reminder cada día a las 18:30 UTC', () => {
    expect(leer('netlify.toml')).toMatch(/\[functions\."session-reminder"\]\s+schedule = "30 18 \* \* \*"/)
  })

  it('usa guardScheduled y emailsEnabled', () => {
    const src = leer('netlify/functions/session-reminder.js')
    expect(src).toContain('guardScheduled(event)')
    expect(src).toContain('emailsEnabled()')
  })
})

describe('plantilla del recordatorio', () => {
  const ses = { tipo: 'Correr', subtipo: 'Rodaje Z2', duracion_min: 45 }

  it('nombre escapado, sesión de hoy, botón a la app y pie con baja', () => {
    const html = plantillas.buildRecordatorioSesionHtml('<b>Ana</b>', { ...ses, subtipo: '<i>Z2</i>' })
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('&lt;b&gt;Ana')
    expect(html).not.toContain('<i>Z2</i>')
    expect(html).toContain('Correr, &lt;i&gt;Z2&lt;/i&gt; (45 min)')
    expect(html).toContain('href="https://getricoach.com/app"')
    expect(html).toContain('te damos de baja')
    expect(html).toContain('Recordatorios por email')
    expect(html).not.toContain('netlify.app')
  })
  it('asunto sin emojis, con tipo, subtipo y duración; sin repetir tipo y subtipo iguales', () => {
    const asunto = plantillas.asuntoRecordatorioSesion(ses)
    expect(asunto).toBe('Hoy te toca: Correr, Rodaje Z2 (45 min)')
    expect(asunto).toMatch(/^[\x20-\x7EÁÉÍÓÚáéíóúñÑ¿¡·,()-]+$/)
    expect(plantillas.asuntoRecordatorioSesion({ tipo: 'Fuerza', subtipo: 'fuerza' })).toBe('Hoy te toca: Fuerza')
    expect(plantillas.asuntoRecordatorioSesion({})).toBe('Hoy te toca: Entrenamiento')
  })
  it('no menciona Strava', () => {
    expect(plantillas.buildRecordatorioSesionHtml('Ana', ses).toLowerCase()).not.toContain('strava')
  })
})

describe('baja desde el perfil (migración 009)', () => {
  it('por defecto está activado, también sin la columna', () => {
    expect(recordatoriosActivados({})).toBe(true)
    expect(recordatoriosActivados({ recordatorios_email: true })).toBe(true)
    expect(recordatoriosActivados({ recordatorios_email: false })).toBe(false)
  })
  it('solo se envía la columna si el usuario la cambia', () => {
    expect(cambioRecordatorios({}, true)).toEqual({})
    expect(cambioRecordatorios({ recordatorios_email: true }, true)).toEqual({})
    expect(cambioRecordatorios({ recordatorios_email: true }, false)).toEqual({ recordatorios_email: false })
    expect(cambioRecordatorios({ recordatorios_email: false }, true)).toEqual({ recordatorios_email: true })
  })
  it('la migración 009 protege recordatorio_enviado_el pero NO recordatorios_email', () => {
    const sql = leer('supabase/migrations/009_recordatorio_sesion.sql')
    expect(sql).toContain('recordatorio_enviado_el date')
    expect(sql).toContain('recordatorios_email boolean NOT NULL DEFAULT true')
    expect(sql).toContain('NEW.recordatorio_enviado_el := NULL')
    expect(sql).toContain('NEW.recordatorio_enviado_el := OLD.recordatorio_enviado_el')
    expect(sql).not.toMatch(/NEW\.recordatorios_email/)
    // el trigger conserva todos los campos protegidos de la 008
    for (const campo of ['plan', 'stripe_customer_id', 'trial_ends_at', 'trial_aviso_enviado_at', 'recuperacion_enviada_at', 'capturas_semana', 'capturas_semana_inicio']) {
      expect(sql).toContain(`NEW.${campo} := OLD.${campo}`)
    }
  })
})
