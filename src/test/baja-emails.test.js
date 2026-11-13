// Baja de emails: enlace firmado, filtro en todos los envíos y pie con enlace (migración 012).
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
const UID = 'f9dca406-d648-4ba3-943d-a2b6ddef08db'

describe('lib/baja', () => {
  beforeEach(() => { process.env.INTERNAL_API_SECRET = 'secreto-de-prueba' })

  it('urlBaja firma y verificar acepta ese enlace', () => {
    const { urlBaja, verificar } = require('../../netlify/functions/lib/baja')
    const url = new URL(urlBaja(UID))
    expect(verificar(url.searchParams.get('u'), url.searchParams.get('t'))).toBe(true)
  })

  it('rechaza token manipulado, de otro usuario o userId inválido', () => {
    const { urlBaja, verificar } = require('../../netlify/functions/lib/baja')
    const t = new URL(urlBaja(UID)).searchParams.get('t')
    expect(verificar(UID, t.replace(/.$/, c => (c === 'a' ? 'b' : 'a')))).toBe(false)
    expect(verificar('00000000-0000-0000-0000-000000000000', t)).toBe(false)
    expect(verificar('no-uuid', t)).toBe(false)
    expect(verificar(UID, undefined)).toBe(false)
  })

  it('sin INTERNAL_API_SECRET no hay enlace (cae al mailto)', () => {
    delete process.env.INTERNAL_API_SECRET
    const { urlBaja } = require('../../netlify/functions/lib/baja')
    expect(urlBaja(UID)).toBeNull()
  })
})

describe('baja-emails (function)', () => {
  beforeEach(() => { process.env.INTERNAL_API_SECRET = 'secreto-de-prueba' })

  it('GET con enlace válido solo enseña el botón y no escribe nada', async () => {
    const { urlBaja } = require('../../netlify/functions/lib/baja')
    const { handler } = require('../../netlify/functions/baja-emails')
    const q = Object.fromEntries(new URL(urlBaja(UID)).searchParams)
    const r = await handler({ httpMethod: 'GET', queryStringParameters: q })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('Confirmar baja')
  })

  it('enlace inválido → 400', async () => {
    const { handler } = require('../../netlify/functions/baja-emails')
    const r = await handler({ httpMethod: 'POST', queryStringParameters: { u: UID, t: 'x' } })
    expect(r.statusCode).toBe(400)
  })
})

describe('todos los envíos respetan la baja', () => {
  const leer = f => fs.readFileSync(`netlify/functions/${f}`, 'utf8')

  it.each(['trial-dia3.js', 'trial-reminder.js', 'trial-reactivacion.js', 'session-reminder.js', 'weekly-report.js'])(
    '%s filtra emails_baja_at', f => { expect(leer(f)).toContain('emails_baja_at=is.null') })

  it('generate-plan comprueba la baja antes del email "plan listo"', () => {
    expect(leer('generate-plan.js')).toContain('select=emails_baja_at')
  })

  it('sendEmail sustituye el marcador {{BAJA_URL}} y no deja ninguno sin sustituir', () => {
    const src = leer('lib/email.js')
    expect(src).toContain("split('{{BAJA_URL}}')")
    const pies = leer('lib/emails-usuario.js') + src + leer('weekly-report.js')
    expect(pies).not.toMatch(/responde a este email y te damos de baja/)
  })
})
