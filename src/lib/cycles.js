const OBJETIVOS = {
  base:  'Construir base aeróbica y volumen progresivo',
  build: 'Desarrollar umbral y capacidad de trabajo',
  peak:  'Máxima intensidad y simulacros de carrera',
  taper: 'Reducir volumen, llegar fresco a la carrera',
}

function withObjetivo(fase) {
  return { ...fase, objetivo: OBJETIVOS[fase.nombre] }
}

/**
 * Calcula las fases del macrociclo a partir de fechaInicio y fechaFin (strings YYYY-MM-DD).
 * Devuelve array de { nombre, sem_inicio, sem_fin, objetivo }.
 */
export function calcularFases(fechaInicio, fechaFin) {
  const totalSemanas = Math.round(
    (new Date(fechaFin) - new Date(fechaInicio)) / (7 * 24 * 60 * 60 * 1000)
  )

  if (totalSemanas <= 6) {
    return [
      { nombre: 'peak',  sem_inicio: 1, sem_fin: totalSemanas - 2 },
      { nombre: 'taper', sem_inicio: totalSemanas - 1, sem_fin: totalSemanas },
    ].map(withObjetivo)
  }

  if (totalSemanas <= 10) {
    const buildSem = totalSemanas - 2
    return [
      { nombre: 'build', sem_inicio: 1,            sem_fin: buildSem - 2 },
      { nombre: 'peak',  sem_inicio: buildSem - 1, sem_fin: buildSem },
      { nombre: 'taper', sem_inicio: buildSem + 1, sem_fin: totalSemanas },
    ].map(withObjetivo)
  }

  if (totalSemanas <= 16) {
    const taper = 2
    const peak  = 3
    const build = Math.round((totalSemanas - taper - peak) * 0.55)
    const base  = totalSemanas - taper - peak - build
    return [
      { nombre: 'base',  sem_inicio: 1,                sem_fin: base },
      { nombre: 'build', sem_inicio: base + 1,          sem_fin: base + build },
      { nombre: 'peak',  sem_inicio: base + build + 1,  sem_fin: totalSemanas - taper },
      { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
    ].map(withObjetivo)
  }

  // > 16 semanas
  const taper = 2
  const peak  = 4
  const build = Math.round((totalSemanas - taper - peak) * 0.4)
  const base  = totalSemanas - taper - peak - build
  return [
    { nombre: 'base',  sem_inicio: 1,                sem_fin: base },
    { nombre: 'build', sem_inicio: base + 1,          sem_fin: base + build },
    { nombre: 'peak',  sem_inicio: base + build + 1,  sem_fin: totalSemanas - taper },
    { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
  ].map(withObjetivo)
}

/**
 * Devuelve la fase que contiene el numeroSemana dado.
 * Fallback: primera fase.
 */
export function getFaseActual(fases, numeroSemana) {
  return fases.find(f => numeroSemana >= f.sem_inicio && numeroSemana <= f.sem_fin)
    || fases[0]
}

/**
 * true si es semana de descarga (múltiplo de 4) y no es taper.
 */
export function esSemanaDescarga(numeroSemana, fase) {
  if (fase.nombre === 'taper') return false
  return numeroSemana % 4 === 0
}

/**
 * Calcula el número de semana dentro del ciclo (1-based).
 * fechaInicio y fechaSemanaActual son strings YYYY-MM-DD (lunes de cada semana).
 */
export function getNumeroSemana(fechaInicio, fechaSemanaActual) {
  const diff = new Date(fechaSemanaActual) - new Date(fechaInicio)
  const semanas = Math.round(diff / (7 * 24 * 60 * 60 * 1000))
  return semanas + 1
}

/**
 * Devuelve true si el ciclo genérico (sin fecha_carrera) ha llegado a su última semana.
 * Los ciclos con carrera nunca se consideran "completados" por esta función —
 * su finalización la gestiona la propia fecha de la carrera.
 */
export function esCicloCompletado(cycle, numeroSemanaActual) {
  if (!cycle || cycle.fecha_carrera) return false
  return numeroSemanaActual >= cycle.semanas_totales
}
