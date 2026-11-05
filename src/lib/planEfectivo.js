// Plan efectivo de un usuario: 'pro' si paga o si está dentro de su prueba gratuita.
// Espejo CJS (con test de paridad): netlify/functions/lib/plan-efectivo.js
//
// - plan === 'pro'         → Pro de pago (Stripe). Único que puede usar Strava/Intervals.
// - trial_ends_at > ahora  → prueba: Sonnet y límite Pro, pero sin Strava.
// - cualquier otro caso    → 'free'.

export const TRIAL_DIAS = 7
const DIA_MS = 24 * 60 * 60 * 1000

function finPrueba(profile) {
  if (!profile || !profile.trial_ends_at) return null
  const fin = Date.parse(profile.trial_ends_at)
  return Number.isFinite(fin) ? fin : null
}

export function enPrueba(profile, ahora = Date.now()) {
  if (!profile || profile.plan === 'pro') return false
  const fin = finPrueba(profile)
  return fin !== null && fin > ahora
}

export function planEfectivo(profile, ahora = Date.now()) {
  return profile?.plan === 'pro' || enPrueba(profile, ahora) ? 'pro' : 'free'
}

// Días que quedan de prueba (mínimo 1 mientras dure)
export function diasPruebaRestantes(profile, ahora = Date.now()) {
  if (!enPrueba(profile, ahora)) return 0
  return Math.max(1, Math.ceil((finPrueba(profile) - ahora) / DIA_MS))
}
