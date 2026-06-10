// Espejo CommonJS de src/lib/volumen.js para Netlify Functions.
// ⚠️ Si cambias algo aquí, cambia también el canónico ESM — el test de paridad
// (src/test/volumen.test.js) falla si divergen.

function calcularVolumenReal(sesiones) {
  return (sesiones || [])
    .filter(s => s.completada && s.tipo?.toLowerCase() !== 'descanso')
    .reduce((acc, s) => acc + (s.tiempo_real_min || s.duracion_min || 0), 0);
}

module.exports = { calcularVolumenReal };
