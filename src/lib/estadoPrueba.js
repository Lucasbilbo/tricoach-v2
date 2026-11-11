// Estado de la prueba Pro para los avisos de la app (ver components/TrialBanner.jsx).
import { diasPruebaRestantes } from './planEfectivo'

export const DIAS_AVISO = 3
export const DIAS_TRAS_FIN = 14
const DIA_MS = 24 * 60 * 60 * 1000

// 'aviso' | 'terminada' | null
export function estadoPrueba(profile, ahora = Date.now()) {
  if (!profile || profile.plan === 'pro' || !profile.trial_ends_at) return null
  const fin = Date.parse(profile.trial_ends_at)
  if (!Number.isFinite(fin)) return null
  if (fin > ahora) return diasPruebaRestantes(profile, ahora) <= DIAS_AVISO ? 'aviso' : null
  return ahora - fin <= DIAS_TRAS_FIN * DIA_MS ? 'terminada' : null
}
