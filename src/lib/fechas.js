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


const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Fecha de carrera en ISO (YYYY-MM-DD) a partir de los selectores del onboarding
 * (día, nombre de mes en español, año). Devuelve null si algo no cuadra.
 * Antes se guardaba "7 Marzo 2027" y el resto del código (ciclo, plan, prompt) lo ignoraba.
 */
export function fechaCarreraISO(dia, mes, anio) {
  const m = MESES_ES.indexOf(String(mes || '').toLowerCase()) + 1
  const d = Number(dia)
  const a = Number(anio)
  if (!m || !d || !a || d < 1 || d > 31) return null
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const check = new Date(`${iso}T12:00:00`)
  return check.getDate() === d ? iso : null
}
