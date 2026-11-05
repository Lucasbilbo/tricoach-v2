/* eslint-env node */
// Tests de la reactivación de noviembre 2026: modelos de Claude, autenticación de las
// functions y fechas de carrera. Cada bloque protege contra un fallo que dejó el
// producto roto sin que ningún test lo detectara.
import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { fechaCarreraISO } from '../lib/fechas'

const require = createRequire(import.meta.url)
const claudeLib = require('../../netlify/functions/lib/claude.js')
const authLib = require('../../netlify/functions/lib/auth.js')

const FUNCTIONS_DIR = join(__dirname, '../../netlify/functions')

afterEach(() => {
  delete process.env.CLAUDE_MODEL_FREE
  delete process.env.CLAUDE_MODEL_PRO
  delete process.env.INTERNAL_API_SECRET
  delete process.env.CRONS_ENABLED
})

describe('lib/claude — modelos', () => {
  it('Free usa el modelo barato y Pro el de más calidad por defecto', () => {
    expect(claudeLib.modelFor('free')).toBe('claude-haiku-5-5')
    expect(claudeLib.modelFor(undefined)).toBe('claude-haiku-5-5')
    expect(claudeLib.modelFor('pro')).toBe('claude-sonnet-5-5')
  })

  it('los modelos se pueden cambiar por variable de entorno', () => {
    process.env.CLAUDE_MODEL_FREE = 'modelo-a'
    process.env.CLAUDE_MODEL_PRO = 'modelo-b'
    expect(claudeLib.modelFor('free')).toBe('modelo-a')
    expect(claudeLib.modelFor('pro')).toBe('modelo-b')
    expect(claudeLib.cheapModel()).toBe('modelo-a')
  })

  it('ninguna function tiene un modelo de Claude escrito a mano (solo lib/claude.js)', () => {
    const files = readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.js'))
    const conModelo = files.filter(f => /['"]claude-(sonnet|opus|haiku|3|instant)[^'"]*['"]/.test(readFileSync(join(FUNCTIONS_DIR, f), 'utf8')))
    expect(conModelo).toEqual([])
  })

  it('la petición no usa parámetros que rechazan los modelos 5.5', () => {
    const body = claudeLib.buildBody({ model: 'm', system: 's', messages: [{ role: 'user', content: 'hola' }], maxTokens: 100 })
    expect(body).not.toHaveProperty('temperature')
    expect(body).not.toHaveProperty('top_p')
    expect(body).not.toHaveProperty('top_k')
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.messages.at(-1).role).toBe('user')
  })

  it('extractText lee los bloques de texto aunque la respuesta empiece por thinking', () => {
    const data = { content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: 'Hola' }, { type: 'tool_use', name: 'actualizar_perfil', input: {} }, { type: 'text', text: 'atleta' }] }
    expect(claudeLib.extractText(data)).toBe('Hola\natleta')
    expect(claudeLib.extractText({ content: [{ type: 'tool_use' }] })).toBe('')
    expect(claudeLib.extractText(null)).toBe('')
  })
})

describe('lib/auth — autenticación de functions', () => {
  it('sin token devuelve 401', async () => {
    const r = await authLib.authenticate({ headers: {} })
    expect(r.ok).toBe(false)
    expect(r.response.statusCode).toBe(401)
  })

  it('el secreto antiguo del navegador ya no sirve', async () => {
    const r = await authLib.authenticate({ headers: { 'x-tricoach-secret': 'lo-que-sea' } })
    expect(r.ok).toBe(false)
  })

  it('el camino interno solo vale si la function lo permite y con un userId válido', async () => {
    process.env.INTERNAL_API_SECRET = 'interno'
    const userId = '11111111-2222-3333-4444-555555555555'
    const event = { headers: { 'x-internal-secret': 'interno' } }
    expect((await authLib.authenticate(event, { bodyUserId: userId })).ok).toBe(false)
    const ok = await authLib.authenticate(event, { allowInternal: true, bodyUserId: userId })
    expect(ok).toMatchObject({ ok: true, userId, internal: true })
    const mal = await authLib.authenticate(event, { allowInternal: true, bodyUserId: 'no-uuid' })
    expect(mal.ok).toBe(false)
  })

  it('CORS solo devuelve orígenes permitidos', () => {
    expect(authLib.corsHeaders({ headers: { origin: 'https://getricoach.com' } })['Access-Control-Allow-Origin']).toBe('https://getricoach.com')
    expect(authLib.corsHeaders({ headers: { origin: 'https://deploy-preview-12--tricoach-v2.netlify.app' } })['Access-Control-Allow-Origin']).toBe('https://deploy-preview-12--tricoach-v2.netlify.app')
    expect(authLib.corsHeaders({ headers: { origin: 'https://evil.com' } })['Access-Control-Allow-Origin']).toBe('https://getricoach.com')
  })

  it('las functions programadas no se pueden disparar desde fuera', () => {
    process.env.INTERNAL_API_SECRET = 'interno'
    expect(authLib.guardScheduled({ headers: {}, body: '' })).toMatchObject({ statusCode: 401 })
    expect(authLib.guardScheduled({ headers: {}, body: JSON.stringify({ next_run: 'x' }) })).toMatchObject({ statusCode: 401 })
    process.env.CRONS_ENABLED = 'true'
    expect(authLib.guardScheduled({ headers: {}, body: JSON.stringify({ next_run: 'x' }) })).toBeNull()
    expect(authLib.guardScheduled({ headers: { 'x-internal-secret': 'interno' } })).toBeNull()
  })

  it('ninguna function acepta ya x-tricoach-secret', () => {
    const files = readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.js'))
    const conSecreto = files.filter(f => readFileSync(join(FUNCTIONS_DIR, f), 'utf8').includes('x-tricoach-secret'))
    expect(conSecreto).toEqual([])
  })
})

describe('fechas de carrera del onboarding', () => {
  it('se guardan en ISO, que es lo que leen ciclo, plan y prompt', () => {
    expect(fechaCarreraISO('7', 'Marzo', '2027')).toBe('2027-03-07')
    expect(fechaCarreraISO(31, 'Diciembre', 2026)).toBe('2026-12-31')
    expect(fechaCarreraISO('1', 'enero', '2027')).toBe('2027-01-01')
  })

  it('rechaza fechas imposibles o incompletas', () => {
    expect(fechaCarreraISO('31', 'Febrero', '2027')).toBeNull()
    expect(fechaCarreraISO('', 'Marzo', '2027')).toBeNull()
    expect(fechaCarreraISO('5', 'Marzzo', '2027')).toBeNull()
  })
})

describe('fechas de sesiones en planes que no empiezan en lunes', async () => {
  const { getFechaSesion } = await import('../lib/fechas')
  it('plan de lunes: igual que antes', () => {
    expect(getFechaSesion('2026-11-02', 'Lunes')).toBe('2026-11-02')
    expect(getFechaSesion('2026-11-02', 'Jueves')).toBe('2026-11-05')
    expect(getFechaSesion('2026-11-02', 'Domingo')).toBe('2026-11-08')
  })
  it('primer plan que empieza un jueves (Jueves..Miércoles)', () => {
    expect(getFechaSesion('2026-11-05', 'Jueves')).toBe('2026-11-05')
    expect(getFechaSesion('2026-11-05', 'Domingo')).toBe('2026-11-08')
    expect(getFechaSesion('2026-11-05', 'Lunes')).toBe('2026-11-09')
    expect(getFechaSesion('2026-11-05', 'Miércoles')).toBe('2026-11-11')
    expect(getFechaSesion('2026-11-05', 'Sabado')).toBe('2026-11-07')
  })
})

describe('prompt del coach con sesiones estructuradas', async () => {
  const { buildSystemPrompt } = await import('../prompts/buildSystemPrompt')
  it('no escribe "undefined" cuando la sesión no trae descripcion', () => {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    const plan = { semana: hoy, sesiones: [{ dia: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(hoy + 'T12:00:00').getDay()], tipo: 'Nadar', subtipo: 'Técnica', duracion_min: 45, estructura: { calentamiento: '200m', principal: '8x100', vuelta_calma: '100m', rpe_objetivo: '4-5' } }] }
    const prompt = buildSystemPrompt({ nombre: 'Test', deporte: 'triatlon', nivel: 'intermedio' }, 'cercano', null, plan)
    expect(prompt).not.toContain('undefined')
    expect(prompt).toContain('Técnica, 45 min')
    expect(prompt).toContain('Principal: 8x100')
    expect(prompt).toContain('[HOY - pendiente]')
  })
})
