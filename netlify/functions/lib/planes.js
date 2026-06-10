// Lógica de idempotencia de generate-plan — pura y testeable
// (src/test/planes-idempotencia.test.js).

/**
 * Decide qué hacer cuando se pide generar un plan para una semana.
 * @param {object|null} planExistente — plan ya guardado para (user_id, semana), o null
 * @param {boolean} forzar — true cuando el usuario pide regenerar explícitamente
 * @returns {'devolver_existente' | 'actualizar' | 'crear'}
 */
function decidirAccionPlan(planExistente, forzar) {
  if (!planExistente) return 'crear';
  return forzar ? 'actualizar' : 'devolver_existente';
}

module.exports = { decidirAccionPlan };
