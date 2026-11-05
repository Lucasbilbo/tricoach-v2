// Prueba Pro de 7 días: plan efectivo, límites y paridad ESM ↔ CJS.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join } from 'path'
import { planEfectivo, enPrueba, diasPruebaRestantes } from '../lib/planEfectivo'
import { LIMITE_DIARIO, limiteDiario } from '../lib/profiles'

const require = createRequire(import.meta.url)
const cjs = require('../../netlify/functions/lib/plan-efectivo.js')

const AHORA = Date.parse('2026-11-05T12:00:00Z')
const dias = n => new Date(AHORA + n * 86400000).toISOString()

describe('plan efectivo', () => {
  it('free sin prueba sigue siendo free', () => {
    expect(planEfectivo({ plan: 'free', trial_ends_at: null }, AHORA)).toBe('free')
    expect(planEfectivo(null, AHORA)).toBe('free')
  })
  it('dentro de la prueba cuenta como pro, caducada vuelve a free', () => {
    expect(planEfectivo({ plan: 'free', trial_ends_at: dias(3) }, AHORA)).toBe('pro')
    expect(planEfectivo({ plan: 'free', trial_ends_at: dias(-1) }, AHORA)).toBe('free')
  })
  it('pro de pago es pro y no está "en prueba"', () => {
    expect(planEfectivo({ plan: 'pro', trial_ends_at: null }, AHORA)).toBe('pro')
    expect(enPrueba({ plan: 'pro', trial_ends_at: dias(3) }, AHORA)).toBe(false)
  })
  it('días restantes', () => {
    expect(diasPruebaRestantes({ plan: 'free', trial_ends_at: dias(7) }, AHORA)).toBe(7)
    expect(diasPruebaRestantes({ plan: 'free', trial_ends_at: new Date(AHORA + 3600000).toISOString() }, AHORA)).toBe(1)
    expect(diasPruebaRestantes({ plan: 'free', trial_ends_at: dias(-1) }, AHORA)).toBe(0)
  })
  it('fecha inválida no da prueba', () => {
    expect(planEfectivo({ plan: 'free', trial_ends_at: 'basura' }, AHORA)).toBe('free')
  })
})

describe('límites diarios', () => {
  it('Free 10, Pro 20 (frontend y servidor coinciden)', () => {
    expect(LIMITE_DIARIO).toEqual({ free: 10, pro: 20 })
    const src = readFileSync(join(__dirname, '../../netlify/functions/claude.js'), 'utf8')
    expect(src).toMatch(/DAILY_LIMIT = \{ free: 10, pro: 20 \}/)
  })
  it('la prueba usa el límite Pro', () => {
    const futuro = new Date(Date.now() + 3 * 86400000).toISOString()
    expect(limiteDiario({ plan: 'free', trial_ends_at: futuro })).toBe(20)
    expect(limiteDiario({ plan: 'free', trial_ends_at: null })).toBe(10)
  })
})

describe('paridad ESM ↔ CJS', () => {
  it('mismos resultados en todos los casos', () => {
    const casos = [
      null,
      { plan: 'free' },
      { plan: 'pro' },
      { plan: 'pro', trial_ends_at: dias(2) },
      { plan: 'free', trial_ends_at: dias(2) },
      { plan: 'free', trial_ends_at: dias(-2) },
      { plan: 'free', trial_ends_at: 'x' },
    ]
    for (const c of casos) {
      expect(cjs.planEfectivo(c, AHORA)).toBe(planEfectivo(c, AHORA))
      expect(cjs.enPrueba(c, AHORA)).toBe(enPrueba(c, AHORA))
      expect(cjs.diasPruebaRestantes(c, AHORA)).toBe(diasPruebaRestantes(c, AHORA))
    }
  })
})

describe('Strava solo para Pro de pago', () => {
  it('strava-auth y generate-plan miran profile.plan === pro, no la prueba', () => {
    const fn = f => readFileSync(join(__dirname, '../../netlify/functions', f), 'utf8')
    expect(fn('strava-auth.js')).toContain("profile.plan !== 'pro'")
    expect(fn('generate-plan.js')).toContain("profile.plan === 'pro'")
    expect(fn('strava-auth.js')).not.toContain('plan-efectivo')
  })
})
