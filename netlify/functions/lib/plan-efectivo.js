// Espejo CJS de src/lib/planEfectivo.js (test de paridad en src/test/plan-efectivo.test.js).
// Plan efectivo: 'pro' si paga o si está dentro de su prueba gratuita; si no, 'free'.
// Strava/Intervals se comprueban con profile.plan === 'pro' (solo Pro de pago), no con esto.

const TRIAL_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

function finPrueba(profile) {
  if (!profile || !profile.trial_ends_at) return null;
  const fin = Date.parse(profile.trial_ends_at);
  return Number.isFinite(fin) ? fin : null;
}

function enPrueba(profile, ahora = Date.now()) {
  if (!profile || profile.plan === 'pro') return false;
  const fin = finPrueba(profile);
  return fin !== null && fin > ahora;
}

function planEfectivo(profile, ahora = Date.now()) {
  return profile?.plan === 'pro' || enPrueba(profile, ahora) ? 'pro' : 'free';
}

function diasPruebaRestantes(profile, ahora = Date.now()) {
  if (!enPrueba(profile, ahora)) return 0;
  return Math.max(1, Math.ceil((finPrueba(profile) - ahora) / DIA_MS));
}

module.exports = { TRIAL_DIAS, enPrueba, planEfectivo, diasPruebaRestantes };
