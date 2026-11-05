// Helpers de fechas de sesiones — fuente única del patrón DIA_OFFSET_MAP.
// plan.semana es siempre el lunes de la semana en ISO date (ej: "2026-06-08").
// T12:00:00 evita que el desfase UTC/local desplace el día (madrugada, DST).

export const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Miercoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Sabado: 5, Domingo: 6 }

// Los planes son semanas "rodantes": plan.semana es el día en que empieza el plan
// (lunes en los automáticos, pero el primer plan empieza el día del alta). El offset
// de cada sesión se cuenta desde ese día, no desde el lunes. Para planes que empiezan
// en lunes el resultado es idéntico al de antes.
export function offsetDesdeInicio(inicio, dia) {
  const objetivo = DIA_OFFSET_MAP[dia] ?? DIA_OFFSET_MAP[String(dia || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')] ?? 0
  const inicioIdx = (inicio.getDay() + 6) % 7
  return (objetivo - inicioIdx + 7) % 7
}


/**
 * Fecha real (YYYY-MM-DD) de una sesión a partir del lunes de la semana y el día.
 * @param {string} semana — día de inicio del plan (ISO); normalmente lunes
 * @param {string} dia — nombre del día ('Lunes'...'Domingo')
 */
export function getFechaSesion(semana, dia) {
  const base = new Date(semana + 'T12:00:00')
  base.setDate(base.getDate() + offsetDesdeInicio(base, dia))
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
