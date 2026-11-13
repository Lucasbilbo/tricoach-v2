// Qué gana Pro (nov-2026): capturas sin tope semanal, revisión semanal y plan de cada lunes.
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'
import { capturasRestantes, lunesDeHoy, olvidarCapturas, LIMITE_SEMANAL_FREE } from '../lib/captura'

const require = createRequire(import.meta.url)
const servidor = require('../../netlify/functions/lib/captura.js')
const leer = f => readFileSync(join(__dirname, '../..', f), 'utf8')

const LUNES = '2026-11-09'
const futuro = new Date(Date.now() + 3 * 86400000).toISOString()

describe('semana de capturas', () => {
  it('lunes de la semana en Madrid, también en domingo y en lunes', () => {
    expect(lunesDeHoy('2026-11-12')).toBe(LUNES) // jueves
    expect(lunesDeHoy('2026-11-15')).toBe(LUNES) // domingo
    expect(lunesDeHoy('2026-11-09')).toBe(LUNES) // lunes
    expect(lunesDeHoy('2026-11-16')).toBe('2026-11-16')
  })
})

describe('capturas restantes — servidor', () => {
  it('Pro no tiene tope semanal', () => {
    expect(servidor.capturasRestantes('pro', { capturas_semana: 50, capturas_semana_inicio: LUNES }, LUNES)).toBe(null)
  })
  it('Free: 2 por semana, y el contador de otra semana no cuenta', () => {
    expect(servidor.LIMITE_SEMANAL_FREE).toBe(2)
    expect(servidor.capturasRestantes('free', { capturas_semana: 0, capturas_semana_inicio: null }, LUNES)).toBe(2)
    expect(servidor.capturasRestantes('free', { capturas_semana: 1, capturas_semana_inicio: LUNES }, LUNES)).toBe(1)
    expect(servidor.capturasRestantes('free', { capturas_semana: 2, capturas_semana_inicio: LUNES }, LUNES)).toBe(0)
    expect(servidor.capturasRestantes('free', { capturas_semana: 7, capturas_semana_inicio: LUNES }, LUNES)).toBe(0)
    expect(servidor.capturasRestantes('free', { capturas_semana: 2, capturas_semana_inicio: '2026-11-02' }, LUNES)).toBe(2)
    expect(servidor.capturasRestantes('free', null, LUNES)).toBe(2)
  })
})

describe('capturas restantes — navegador (espejo)', () => {
  beforeEach(() => olvidarCapturas())

  it('mismo límite que el servidor', () => {
    expect(LIMITE_SEMANAL_FREE).toBe(servidor.LIMITE_SEMANAL_FREE)
  })
  it('Pro de pago y prueba Pro: sin tope', () => {
    expect(capturasRestantes({ id: 'a', plan: 'pro' }, '2026-11-12')).toBe(null)
    expect(capturasRestantes({ id: 'a', plan: 'free', trial_ends_at: futuro, capturas_semana: 2, capturas_semana_inicio: LUNES }, '2026-11-12')).toBe(null)
  })
  it('Free: según el contador de esta semana', () => {
    expect(capturasRestantes({ id: 'a', plan: 'free' }, '2026-11-12')).toBe(2)
    expect(capturasRestantes({ id: 'a', plan: 'free', capturas_semana: 2, capturas_semana_inicio: LUNES }, '2026-11-12')).toBe(0)
    expect(capturasRestantes({ id: 'a', plan: 'free', capturas_semana: 2, capturas_semana_inicio: LUNES }, '2026-11-16')).toBe(2)
  })
})

describe('analizar-captura — tope semanal', () => {
  const fn = leer('netlify/functions/analizar-captura.js')
  it('corta antes de gastar una lectura y suma solo si sale bien', () => {
    expect(fn.indexOf('limite_semanal: true')).toBeLessThan(fn.indexOf('await callClaude('))
    expect(fn.indexOf("rpc/registrar_captura")).toBeGreaterThan(fn.indexOf('await callClaude('))
  })
  it('sin la migración 008 sigue funcionando sin tope semanal', () => {
    expect(fn).toContain('conContador')
    expect(leer('supabase/migrations/008_capturas_semana.sql')).toContain('NEW.capturas_semana := OLD.capturas_semana')
  })
})

describe('revisión semanal — solo Pro', () => {
  const fn = leer('netlify/functions/weekly-report.js')
  it('se manda a Pro de pago y prueba Pro, no a Free', () => {
    expect(fn).toContain('or=(plan.eq.pro,trial_ends_at.gt.')
    expect(fn).not.toContain('buildEmailHtmlFree')
  })
  it('no registra emails de usuarios y enlaza a la app', () => {
    expect(fn).not.toContain('console.log')
    expect(fn).not.toMatch(/console\.error\([^)]*profile\.email/)
    expect(fn).not.toContain('app.getricoach.com')
  })
  it('la plantilla sigue generando la tabla de sesiones', () => {
    const { buildEmailHtml } = require('../../netlify/functions/weekly-report.js')
    const html = buildEmailHtml('Ana', [{ dia: 'Lunes', tipo: 'Correr', completada: true, rpe: 6 }, { dia: 'Martes', tipo: 'Descanso' }])
    expect(html).toContain('Completada (RPE 6)')
    expect(html).toContain('{{BAJA_URL}}')
  })
})

describe('lo que se promete de Pro es lo que hay', () => {
  it('landing: Free 2 capturas por semana; Pro todas, revisión semanal y plan de cada lunes', () => {
    const l = leer('landing.html')
    expect(l).toContain('2 capturas de entreno por semana')
    expect(l).toContain('El coach lee todos tus entrenos')
    expect(l).toContain('Revisión semanal cada domingo')
    expect(l).toContain('Plan nuevo cada lunes, automático')
    expect(l).not.toContain('Feedback automático tras cada entreno')
  })
  it('los crons que lo sostienen están activos', () => {
    const activos = leer('netlify.toml').split('\n').filter(x => !x.trim().startsWith('#')).join('\n')
    expect(activos).toContain('[functions."weekly-report"]')
    expect(activos).toContain('[functions."auto-plans"]')
  })
})
