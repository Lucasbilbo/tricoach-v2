// Fuente única de los umbrales de wellness (Intervals.icu) y su interpretación.
// Espejo CommonJS para Netlify Functions: netlify/functions/lib/wellness.js
// ⚠️ Si cambias algo aquí, cambia también el espejo — el test de paridad
// (src/test/wellness.test.js) falla si divergen.

export const UMBRALES_WELLNESS = {
  ATL_FATIGA: 50,          // ATL por encima → fatiga alta
  TSB_FORMA_NEGATIVA: -20, // TSB por debajo → deuda de recuperación
  HRV_BAJO: 40,            // HRV (ms) por debajo → priorizar recuperación
}

/**
 * Evalúa un registro de wellness de Intervals.icu contra los umbrales.
 * Null-safe: cada flag solo se activa si el campo existe.
 * Devuelve la lógica, no el copy — cada consumidor redacta su propio texto.
 *
 * @param {object|null} w — { atl, tsb, hrv, ... }
 * @returns {{ fatigaAlta: boolean, formaNegativa: boolean, hrvBajo: boolean,
 *             hayAlerta: boolean, valores: { atl: number|null, tsb: number|null, hrv: number|null } }}
 */
export function evaluarWellness(w) {
  const atl = w?.atl ?? null
  const tsb = w?.tsb ?? null
  const hrv = w?.hrv ?? null

  const fatigaAlta = atl != null && atl > UMBRALES_WELLNESS.ATL_FATIGA
  const formaNegativa = tsb != null && tsb < UMBRALES_WELLNESS.TSB_FORMA_NEGATIVA
  const hrvBajo = hrv != null && hrv < UMBRALES_WELLNESS.HRV_BAJO

  return {
    fatigaAlta,
    formaNegativa,
    hrvBajo,
    hayAlerta: fatigaAlta || formaNegativa || hrvBajo,
    valores: {
      atl: atl != null ? Math.round(atl) : null,
      tsb: tsb != null ? Math.round(tsb) : null,
      hrv,
    },
  }
}
