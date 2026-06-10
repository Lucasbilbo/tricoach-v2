// Espejo CommonJS de src/lib/wellness.js para Netlify Functions.
// ⚠️ Si cambias algo aquí, cambia también el canónico ESM — el test de paridad
// (src/test/wellness.test.js) falla si divergen.

const UMBRALES_WELLNESS = {
  ATL_FATIGA: 50,
  TSB_FORMA_NEGATIVA: -20,
  HRV_BAJO: 40,
};

function evaluarWellness(w) {
  const atl = w?.atl ?? null;
  const tsb = w?.tsb ?? null;
  const hrv = w?.hrv ?? null;

  const fatigaAlta = atl != null && atl > UMBRALES_WELLNESS.ATL_FATIGA;
  const formaNegativa = tsb != null && tsb < UMBRALES_WELLNESS.TSB_FORMA_NEGATIVA;
  const hrvBajo = hrv != null && hrv < UMBRALES_WELLNESS.HRV_BAJO;

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
  };
}

module.exports = { UMBRALES_WELLNESS, evaluarWellness };
