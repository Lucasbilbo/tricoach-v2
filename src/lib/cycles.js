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

  if (totalSemanas < 3) {
    throw new Error(`El ciclo debe tener al menos 3 semanas (recibido: ${totalSemanas})`)
  }

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
 * Devuelve true si el ciclo ha terminado.
 * - Ciclos genéricos (sin carrera_nombre ni fecha_carrera): completados al llegar
 *   a la semana final (sem >= semanas_totales).
 * - Ciclos con carrera: completados con 4 semanas de gracia tras la última semana
 *   (fallback para ciclos cuyo estado en Supabase no se actualizó).
 */
export function esCicloCompletado(cycle, numeroSemanaActual) {
  if (!cycle) return false
  if (!cycle.fecha_carrera && !cycle.carrera_nombre) {
    // Ciclo genérico: completado al llegar a la semana final
    return numeroSemanaActual >= cycle.semanas_totales
  }
  // Ciclo con carrera: gracia de 4 semanas tras la última planificada
  return numeroSemanaActual > cycle.semanas_totales + 4
}
