// Emails a usuarios (nov-2026): fin de prueba, recuperación, bienvenida Pro, portal y crons.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)
const F = '../../netlify/functions/'
const plantillas = require(F + 'lib/emails-usuario.js')
const { consultaAvisos, diasRestantes } = require(F + 'trial-reminder.js')
const { seleccionarDestinatarios } = require(F + 'recuperacion-altas.js')
const { filtroPlan } = require(F + 'auto-plans.js')
const leer = f => readFileSync(join(__dirname, '../..', f), 'utf8')

const AHORA = Date.parse('2026-11-12T08:23:00Z')

describe('plantillas', () => {
  it('todas enlazan a la app y escapan el nombre', () => {
    for (const html of [plantillas.buildBienvenidaProHtml('<b>Ana</b>'), plantillas.buildFinPruebaHtml('<b>Ana</b>', 2), plantillas.buildRecuperacionHtml('<b>Ana</b>')]) {
      expect(html).toContain('https://getricoach.com/app')
      expect(html).not.toContain('netlify.app')
      expect(html).not.toContain('<b>Ana</b>')
      expect(html).toContain('&lt;b&gt;Ana')
    }
  })

  it('fin de prueba: singular y plural, y precios reales', () => {
    expect(plantillas.buildFinPruebaHtml('Ana', 1)).toContain('Te queda 1 día de prueba Pro')
    const html = plantillas.buildFinPruebaHtml('Ana', 2)
    expect(html).toContain('Te quedan 2 días de prueba Pro')
    expect(html).toContain('14,99')
    expect(html).toContain('119')
  })

  it('los emails no solicitados explican cómo darse de baja', () => {
    expect(plantillas.buildFinPruebaHtml('Ana', 2)).toContain('{{BAJA_URL}}')
    expect(plantillas.buildRecuperacionHtml('Ana')).toContain('{{BAJA_URL}}')
  })
})

describe('trial-reminder', () => {
  it('solo cuentas en prueba que caducan en menos de 48 h y sin aviso previo', () => {
    const q = decodeURIComponent(consultaAvisos(AHORA))
    expect(q).toContain('plan=neq.pro')
    expect(q).toContain('trial_aviso_enviado_at=is.null')
    expect(q).toContain('deleted_at=is.null')
    expect(q).toContain('trial_ends_at=gt.2026-11-12T08:23:00.000Z')
    expect(q).toContain('trial_ends_at=lt.2026-11-14T08:23:00.000Z')
  })

  it('días restantes: redondeo hacia arriba, mínimo 1', () => {
    expect(diasRestantes('2026-11-14T08:00:00Z', AHORA)).toBe(2)
    expect(diasRestantes('2026-11-12T20:00:00Z', AHORA)).toBe(1)
  })
})

describe('recuperacion-altas', () => {
  const base = { email: 'a@b.c', deporte: 'running', plan: 'free', deleted_at: null, recuperacion_enviada_at: null, created_at: '2026-10-20T10:00:00Z' }
  const perfiles = [
    { ...base, id: 'ok' },
    { ...base, id: 'con-plan' },
    { ...base, id: 'dashboard' },
    { ...base, id: 'pro', plan: 'pro' },
    { ...base, id: 'sin-onboarding', deporte: null },
    { ...base, id: 'ya-enviado', recuperacion_enviada_at: '2026-11-13T09:30:00Z' },
    { ...base, id: 'alta-nueva', created_at: '2026-11-09T10:00:00Z' },
    { ...base, id: 'borrada', deleted_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'sin-email', email: null },
  ]

  it('solo altas antiguas con onboarding, sin plan, no Pro, no borradas y fuera del Coach Dashboard', () => {
    const ids = seleccionarDestinatarios(perfiles, ['con-plan'], ['dashboard']).map(p => p.id)
    expect(ids).toEqual(['ok'])
  })

  it('no se puede repetir: marca por cuenta, corte de alta, caducidad y lectura completa', () => {
    const fn = leer('netlify/functions/recuperacion-altas.js')
    expect(fn).toContain('recuperacion_enviada_at')
    expect(fn).toContain('Date.now() > CADUCA')
    expect(fn).toContain('guardScheduled(event)')
    expect(fn).toContain('no se envía nada')
  })
})

describe('auto-plans', () => {
  it('genera plan para Pro de pago y cuentas en prueba', () => {
    expect(decodeURIComponent(filtroPlan(AHORA))).toBe('or=(plan.eq.pro,trial_ends_at.gt.2026-11-12T08:23:00.000Z)')
  })
})

describe('crons y portal', () => {
  it('netlify.toml: activos auto-plans, trial-reminder, recuperación y revisión semanal; el recordatorio del jueves sigue pausado', () => {
    const activos = leer('netlify.toml').split('\n').filter(l => !l.trim().startsWith('#')).join('\n')
    expect(activos).toContain('[functions."auto-plans"]')
    expect(activos).toContain('[functions."trial-reminder"]')
    expect(activos).toContain('schedule = "30 9,10 13 11 *"')
    expect(activos).toContain('[functions."weekly-report"]')
    expect(activos).not.toContain('thursday-reminder')
  })

  it('las functions programadas nuevas están protegidas y respetan EMAILS_ENABLED', () => {
    for (const f of ['trial-reminder.js', 'recuperacion-altas.js']) {
      const fn = leer('netlify/functions/' + f)
      expect(fn).toContain('guardScheduled(event)')
      expect(fn).toContain('emailsEnabled()')
    }
  })

  it('el portal saca el usuario del token y el cliente de la base de datos', () => {
    const fn = leer('netlify/functions/create-portal.js')
    expect(fn).toContain('authenticate(event')
    expect(fn).toContain('auth.userId')
    expect(fn).not.toContain('parsed.customer')
    expect(leer('src/components/EditProfile.jsx')).toContain('create-portal')
  })
})
