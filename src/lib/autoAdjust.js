const DIA_OFFSET = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }

/**
 * Analiza el plan y el perfil en busca de señales que requieran ajuste automático.
 * Función pura — no hace llamadas a red ni tiene efectos secundarios.
 *
 * @param {object} plan  — plan semanal con { semana, sesiones }
 * @param {object} profile — perfil del usuario (no usado actualmente, reservado para futuro)
 * @returns {{ shouldAdjust: boolean, reason: string, signal: string }}
 */
export function checkShouldAdjust(plan, profile) {
  if (!plan?.sesiones) return { shouldAdjust: false, reason: '', signal: '' }

  const sesiones = plan.sesiones

  // Señal 1: RPE medio de las últimas 3 sesiones completadas >= 8 → sobrecarga
  const completadasConRpe = sesiones.filter(
    s => s.completada && (s.rpe != null || s.rpe_usuario != null)
  )
  const ultimas3Rpe = completadasConRpe.slice(-3)
  if (ultimas3Rpe.length >= 1) {
    const rpeMedia = ultimas3Rpe.reduce((sum, s) => sum + (s.rpe ?? s.rpe_usuario), 0) / ultimas3Rpe.length
    if (rpeMedia >= 8) {
      return { shouldAdjust: true, reason: 'RPE elevado — reduciendo carga', signal: 'sobrecarga' }
    }
  }

  // Señal 2: Volumen Strava > 120% del planificado (últimas 3 sesiones con tiempo real)
  const completadasConTiempo = sesiones.filter(
    s => s.completada && s.tiempo_real_min > 0 && s.duracion_min > 0
  )
  const ultimas3Tiempo = completadasConTiempo.slice(-3)
  if (ultimas3Tiempo.length >= 1) {
    const avgRatio = ultimas3Tiempo.reduce((sum, s) => sum + s.tiempo_real_min / s.duracion_min, 0) / ultimas3Tiempo.length
    if (avgRatio > 1.2) {
      return { shouldAdjust: true, reason: 'Volumen elevado en Strava — ajustando carga', signal: 'sobrecarga' }
    }
  }

  // Señal 3: 2+ sesiones perdidas consecutivas (días ya pasados, no completadas, no descanso)
  if (plan.semana) {
    const todayStr = new Date().toISOString().split('T')[0]
    const lunes = new Date(plan.semana + 'T12:00:00')
    let consec = 0
    for (const s of sesiones) {
      if (s.tipo?.toLowerCase() === 'descanso') { consec = 0; continue }
      const offset = DIA_OFFSET[s.dia] ?? 0
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + offset)
      const fechaStr = d.toISOString().split('T')[0]
      if (fechaStr < todayStr && !s.completada) {
        consec++
        if (consec >= 2) {
          return { shouldAdjust: true, reason: 'Sesiones perdidas — reorganizando semana', signal: 'sesiones_perdidas' }
        }
      } else {
        consec = 0
      }
    }
  }

  return { shouldAdjust: false, reason: '', signal: '' }
}
