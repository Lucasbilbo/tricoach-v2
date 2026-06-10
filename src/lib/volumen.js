// Fuente única del criterio de volumen real de un plan.
// Espejo CommonJS para Netlify Functions: netlify/functions/lib/volumen.js
// ⚠️ Si cambias algo aquí, cambia también el espejo — el test de paridad
// (src/test/volumen.test.js) falla si divergen.

/**
 * Volumen real de la semana en minutos: suma de las sesiones completadas
 * no-descanso, usando tiempo_real_min si existe y duracion_min como fallback.
 * Función pura — no muta el array.
 */
export function calcularVolumenReal(sesiones) {
  return (sesiones || [])
    .filter(s => s.completada && s.tipo?.toLowerCase() !== 'descanso')
    .reduce((acc, s) => acc + (s.tiempo_real_min || s.duracion_min || 0), 0)
}
