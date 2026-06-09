// Helpers de fechas de sesiones — fuente única del patrón DIA_OFFSET_MAP.
// plan.semana es siempre el lunes de la semana en ISO date (ej: "2026-06-08").
// T12:00:00 evita que el desfase UTC/local desplace el día (madrugada, DST).

export const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }

/**
 * Fecha real (YYYY-MM-DD) de una sesión a partir del lunes de la semana y el día.
 * @param {string} semana — lunes de la semana en ISO date
 * @param {string} dia — nombre del día ('Lunes'...'Domingo')
 */
export function getFechaSesion(semana, dia) {
  const base = new Date(semana + 'T12:00:00')
  base.setDate(base.getDate() + (DIA_OFFSET_MAP[dia] ?? 0))
  return base.toISOString().split('T')[0]
}

/**
 * Fecha de hoy (YYYY-MM-DD) en Europe/Madrid — nunca usar toISOString()
 * para "hoy": en la madrugada UTC devuelve el día anterior.
 */
export function getHoyMadrid() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}
