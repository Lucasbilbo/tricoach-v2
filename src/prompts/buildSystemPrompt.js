function calcularAdherencia(historialPlanes) {
  const ultimas4 = historialPlanes.slice(0, 4)
  if (!ultimas4.length) return null
  const sesionesActivas = ultimas4.flatMap(p => (p.sesiones || []).filter(s => s.tipo !== 'Descanso' && s.intensidad !== 'descanso'))
  const completadas = sesionesActivas.filter(s => s.completada)
  const rpesValidos = completadas.filter(s => s.rpe_usuario != null)
  return {
    porcentaje: sesionesActivas.length ? Math.round(completadas.length / sesionesActivas.length * 100) : null,
    completadas: completadas.length,
    total: sesionesActivas.length,
    rpeMedio: rpesValidos.length ? Math.round(rpesValidos.reduce((a, s) => a + s.rpe_usuario, 0) / rpesValidos.length * 10) / 10 : null,
  }
}

const personalidades = {
  cercano: `Eres cercano, empático y motivador. Tratas al atleta como a un amigo.
Usas un tono cálido y personal, celebras sus logros y le apoyas en los momentos difíciles.`,

  estricto: `Eres exigente y directo. No te andas con rodeos.
Marcas objetivos claros, exiges cumplimiento y no aceptas excusas.
El atleta sabe que contigo no hay medias tintas.`,

  gracioso: `Eres divertido y usas el humor para motivar.
Haces referencias a la cultura pop, pones apodos cariñosos y conviertes el entrenamiento en algo entretenido.
Sin perder nunca el rigor técnico.`,

  motivador: `Eres un coach al estilo Tony Robbins. Cada mensaje es una dosis de energía.
Usas frases poderosas, referencias a grandes atletas y haces que el usuario sienta que puede con todo.`,

  cientifico: `Eres un coach deportivo basado en ciencia y datos.
Cada recomendación tiene una razón fisiológica. Usas métricas exactas: zonas de FC (Z1-Z5), ritmos por km, vatios, V̇O2max, velocidad crítica, umbrales. Cuando el atleta te da resultados de entrenamientos, los analizas numéricamente. No das motivación vacía — das datos, progresión medible y explicaciones de por qué cada sesión tiene sentido fisiológicamente. Hablas de forma precisa y directa. Cuando no tienes datos suficientes, lo dices y pides los que necesitas.`,
}

export function buildSystemPrompt(profile, personalidad = 'cercano', actividades = null, plan = null, planProximaSemana = null, historialPlanes = [], cycle = null, wellness = null) {
  const truncar = (str, max) => str && str.length > max ? str.slice(0, max) + '…' : str

  const ahora = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Europe/Madrid'
  })
  // Deportes: multi-deporte o single
  const deportesArr = Array.isArray(profile.deportes) && profile.deportes.length > 0
    ? profile.deportes
    : profile.deporte ? [{ deporte: profile.deporte, nivel: profile.nivel }] : []
  const deporte = deportesArr[0]?.deporte || profile.deporte || 'deporte de resistencia'
  const nivel = deportesArr[0]?.nivel || profile.nivel || 'principiante'
  const objetivo = truncar(profile.objetivo, 200) || 'mejorar mi forma física'
  const nombre = truncar(profile.nombre, 50) || 'atleta'
  const nombreCoach = truncar(profile.nombre_coach, 50) || 'Coach'

  // Carreras: array o legacy fecha_carrera
  const carrerasArr = Array.isArray(profile.carreras) && profile.carreras.length > 0
    ? profile.carreras
    : profile.fecha_carrera ? [{ nombre: 'Carrera objetivo', tipo: '', fecha: profile.fecha_carrera }] : []
  const hoy = new Date() // usado solo para contar días (aritmética aproximada, no comparación de fechas)
  // Comparar con fecha ISO local (sv-SE da YYYY-MM-DD en timezone Madrid)
  // new Date('YYYY-MM-DD') se parsea como UTC midnight, lo que filtraría incorrectamente carreras de hoy
  const hoyStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
  const carrerasFuturas = carrerasArr.filter(c => {
    if (!c.fecha) return false
    const f = new Date(c.fecha + 'T12:00:00') // T12 para validación de formato
    return !isNaN(f.getTime()) && c.fecha >= hoyStr
  }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  const carreraProxima = carrerasFuturas[0] || null

  const fechaCarreraLegible = carreraProxima?.fecha
    ? (() => {
        const d = new Date(carreraProxima.fecha + 'T12:00:00')
        return isNaN(d.getTime()) ? carreraProxima.fecha : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      })()
    : null
  const fechaCarrera = fechaCarreraLegible
    ? `El próximo evento es "${carreraProxima.nombre || carreraProxima.tipo}" el ${fechaCarreraLegible}.`
    : ''
  const contexto = profile.contexto
    ? `\nLo que sabes de este atleta de conversaciones anteriores:\n${truncar(profile.contexto, 500)}\nNota: el contexto puede incluir datos temporales de semanas anteriores. Úsalo solo para métricas permanentes. Para disponibilidad semanal usa siempre profile.disponibilidad.`
    : ''

  const deporteInfo = {
    triatlon: 'triatlón olímpico (natación 1.5km, ciclismo 40km, running 10km)',
    running: 'running y carreras populares',
    natacion: 'natación (piscina y aguas abiertas)',
    hyrox: 'Hyrox (carrera funcional con estaciones de fitness)',
  }

  // Multi-deporte section
  const multiDeporteSection = deportesArr.length > 1
    ? `\nDEPORTES DEL ATLETA:\n${deportesArr.map(d => `- ${deporteInfo[d.deporte] || d.deporte}: nivel ${d.nivel || 'principiante'}`).join('\n')}\nEl atleta entrena múltiples disciplinas. Al diseñar o ajustar planes, distribuye las sesiones entre todos sus deportes.`
    : ''

  // Todas las carreras futuras
  const todasCarrerasSection = carrerasFuturas.length > 1
    ? `\nTODAS LAS CARRERAS OBJETIVO (ordenadas por fecha):\n${carrerasFuturas.map(c => {
        const d = new Date(c.fecha + 'T12:00:00')
        const legible = isNaN(d.getTime()) ? c.fecha : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        const diasRestantes = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24))
        return `- "${c.nombre || c.tipo}" (${c.tipo}) — ${legible}${diasRestantes > 0 ? ` (en ${diasRestantes} días)` : ''}`
      }).join('\n')}\nOrganiza el entrenamiento priorizando la carrera más próxima sin descuidar las siguientes.`
    : ''

  const natacionContext = deporte === 'natacion'
    ? `\nContexto técnico natación: trabaja estilo crol como base. Incluye ejercicios de técnica (patada tabla, pull con paletas, drills de brazada) si el nivel es principiante o intermedio. Para series: especifica estilo, distancia, tiempo de descanso y referencia de ritmo por 100m.`
    : ''

  const estiloPersonalidad = personalidades[personalidad] || personalidades.cercano

  // ── 1. Protocolo de seguridad (universal, todas las personalidades) ──────────
  const protocoloSeguridad = `
PROTOCOLO DE SEGURIDAD: Si el atleta menciona dolor, molestias, pinchazos o cualquier síntoma físico preocupante, SIEMPRE responde primero con el protocolo RICE (Reposo, Hielo, Compresión, Elevación), recomienda descanso completo y sugiere consultar a un fisioterapeuta antes de retomar el entrenamiento. Nunca minimices el dolor ni propongas continuar entrenando con molestias.`

  // ── 2. Actividades Strava (con alerta sobreentrenamiento zona 2) ─────────────
  const tieneActividades = actividades && actividades.resumen && actividades.resumen !== 'Sin actividades recientes'
  const alertaZona2 = tieneActividades
    ? `\nSi los datos de Strava muestran que el atleta entrena consistentemente por encima de zona 2 en sesiones marcadas como suaves (ritmo notablemente más rápido de lo planificado o FC media >75% FCmax en sesiones Z2), advierte sobre el riesgo de sobreentrenamiento y recuerda la importancia de respetar las zonas de intensidad.`
    : ''

  const detalleActividades = tieneActividades && actividades.actividades?.length > 0
    ? actividades.actividades
        .filter(a => a.intensidad_pct != null && a.fc_media != null)
        .map(a => {
          const alerta = a.duracion_min < 60 && a.intensidad_pct > 75 ? ' ⚠️' : ''
          return `${a.tipo} ${a.distancia_km}km — FC media ${a.fc_media}ppm (${a.intensidad_pct}% FCmax = ${a.zona_fc})${alerta}`
        })
        .join('\n')
    : ''

  const sinDatos = actividades && actividades.sinDatos === true

  const actividadesSection = tieneActividades
    ? `\nDATOS REALES DE STRAVA (sincronizados automáticamente): ${actividades.resumen}${detalleActividades ? '\nDetalle por actividad:\n' + detalleActividades : ''}\nEstos datos son reales y actualizados. Úsalos con confianza cuando el atleta pregunte por sus entrenamientos recientes.${alertaZona2}`
    : sinDatos
      ? '\nEl atleta tiene Strava conectado pero no hay actividades recientes. NO inventes datos de entrenamientos.'
      : ''

  const wellnessSection = wellness ? (() => {
    const hrv = wellness.hrv != null ? `${wellness.hrv} ms` : 'no disponible'
    const atl = wellness.atl != null ? `${Math.round(wellness.atl)}` : 'no disponible'
    const tsb = wellness.tsb != null ? `${Math.round(wellness.tsb)}` : 'no disponible'
    const sleep = wellness.sleepSecs ? `${Math.round(wellness.sleepSecs / 3600 * 10) / 10}h` : 'no disponible'
    const feel = wellness.feel != null ? String(wellness.feel) : 'no registrada'
    const alertas = []
    if (wellness.atl != null && wellness.atl > 50) alertas.push('fatiga alta (ATL > 50) — reduce intensidad esta sesión')
    if (wellness.tsb != null && wellness.tsb < -20) alertas.push('forma negativa (TSB < -20) — el atleta está en deuda de recuperación')
    if (wellness.hrv != null && wellness.hrv < 40) alertas.push('HRV muy bajo — prioriza recuperación')
    return `\nDATOS DE INTERVALS.ICU (hoy):
- HRV: ${hrv}
- Fatiga (ATL): ${atl}
- Forma (TSB): ${tsb}
- Sueño: ${sleep}
- Sensaciones del atleta: ${feel}
${alertas.length > 0 ? `\n⚠️ ALERTAS: ${alertas.join('; ')}. Ajusta la intensidad recomendada a la baja y no propongas sesiones intensas hasta que los valores mejoren.` : 'Los valores de recuperación son normales. Puedes mantener la intensidad planificada.'}`
  })() : ''

  const completadaLabel = (s) => {
    if (!s.completada) return ' (pendiente)'
    return s.via_strava ? ' ✓ completada (Strava)' : ' ✓ completada (manual)'
  }

  // ── DIA_OFFSET_MAP: semana empieza en lunes (índice 0) ──────────────────────
  const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }

  const planSection = plan ? (() => {
    const nDias = plan.sesiones.length
    const nota = nDias < 7
      ? `\n(Este plan tiene ${nDias} día${nDias > 1 ? 's' : ''} porque se generó a mitad de semana. No es una semana completa.)`
      : ''

    // Fecha de hoy en zona horaria local (Madrid) — sv-SE da formato YYYY-MM-DD
    const hoyLocalStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    // T12:00:00 evita que cambios de zona horaria desplacen el día
    const lunesPlan = new Date(plan.semana + 'T12:00:00')

    // Comprobar si el plan es de la semana actual
    const hoyLocal = new Date(hoyLocalStr + 'T12:00:00')
    const dowHoy = hoyLocal.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb (JS nativo)
    const diasDesdeElLunes = dowHoy === 0 ? 6 : dowHoy - 1 // distancia al lunes en semana lun-dom
    const lunesSemanaActual = new Date(hoyLocal)
    lunesSemanaActual.setDate(hoyLocal.getDate() - diasDesdeElLunes)
    const lunesSemanaActualStr = lunesSemanaActual.toISOString().split('T')[0]
    const advertenciaSemana = plan.semana < lunesSemanaActualStr
      ? `\n⚠️ ADVERTENCIA: Este plan es de la semana anterior (${plan.semana}). El atleta todavía no tiene plan para esta semana.`
      : ''

    const lines = plan.sesiones.map(s => {
      const offset = DIA_OFFSET_MAP[s.dia] ?? 0
      const sesionDate = new Date(lunesPlan)
      sesionDate.setDate(lunesPlan.getDate() + offset)
      const sesionDateStr = sesionDate.toISOString().split('T')[0]

      let label
      if (sesionDateStr === hoyLocalStr) {
        label = s.completada
          ? (s.via_strava ? ' [HOY ✓ completada (Strava)]' : ' [HOY ✓ completada]')
          : ' [HOY - pendiente]'
      } else if (sesionDateStr < hoyLocalStr) {
        label = s.completada
          ? (s.via_strava ? ' ✓ completada (Strava)' : ' ✓ completada')
          : ' [pasado - no realizada]'
      } else {
        label = s.completada ? ' ✓ completada' : ' (pendiente)'
      }

      return `${s.dia} (${sesionDateStr}): ${s.tipo} - ${s.descripcion}${label}`
    })

    return `\nPLAN SEMANA ACTUAL (semana del ${plan.semana}):${advertenciaSemana}\n${lines.join('\n')}${nota}`
  })() : ''

  const sesionesCompletadas = plan
    ? plan.sesiones.filter(s => s.completada)
    : []

  const reconocimientoSection = sesionesCompletadas.length > 0
    ? `\nSESIONES COMPLETADAS ESTA SEMANA:\n${sesionesCompletadas.map(s =>
        `- ${s.dia}: ${s.tipo} (${s.descripcion})${s.via_strava ? ' — datos reales de Strava disponibles' : ''}`
      ).join('\n')}\n\nCuando el usuario te escriba, si hay sesiones recién completadas que aún no has comentado, reconócelas brevemente: "Vi que completaste el [entrenamiento] del [día], ¿cómo fue?" Solo pregunta una vez por sesión, no repitas si ya lo comentaste en la conversación.`
    : ''

  // ── 4. Historial + alerta fatiga acumulada ───────────────────────────────────
  // Calculamos métricas fuera del IIFE para reutilizarlas en la alerta de fatiga
  const historialMetricas = historialPlanes.map((p) => {
    const sesiones = p.sesiones || []
    const activas = sesiones.filter(s => s.tipo?.toLowerCase() !== 'descanso')
    const completadas = sesiones.filter(s => s.completada)
    const adherencia = activas.length > 0
      ? Math.round((completadas.length / activas.length) * 100)
      : null
    const getRpe = s => s.rpe ?? s.rpe_usuario
    const rpesValidos = completadas.filter(s => getRpe(s) != null)
    const rpeMedia = rpesValidos.length > 0
      ? Math.round(rpesValidos.reduce((a, s) => a + getRpe(s), 0) / rpesValidos.length * 10) / 10
      : null
    const saltadas = activas.filter(s => !s.completada).length
    return { adherencia, rpeMedia, saltadas }
  })

  const historialSection = historialMetricas.length > 0 ? (() => {
    const LABELS = ['Semana -1', 'Semana -2', 'Semana -3', 'Semana -4']
    const lineas = historialMetricas.map((m, i) =>
      `${LABELS[i] || `Semana -${i + 1}`}: adherencia ${m.adherencia != null ? m.adherencia + '%' : '?'}${m.rpeMedia != null ? `, RPE ${m.rpeMedia}` : ''}${m.saltadas > 0 ? `, ${m.saltadas} sesión${m.saltadas > 1 ? 'es' : ''} saltada${m.saltadas > 1 ? 's' : ''}` : ''}`
    )
    const adherencias = historialMetricas.map(m => m.adherencia).filter(a => a != null)
    const rpes = historialMetricas.slice(0, 2).map(m => m.rpeMedia).filter(r => r != null)
    let tendencia = 'datos insuficientes'
    if (adherencias.length >= 2) {
      const avg = adherencias.slice(0, 2).reduce((a, b) => a + b, 0) / 2
      tendencia = avg >= 85 ? 'alta adherencia, buena recuperación' : avg >= 60 ? 'adherencia moderada' : 'baja adherencia, revisar carga'
    }
    if (rpes.length >= 2) {
      const diff = rpes[0] - rpes[1]
      if (diff > 1) tendencia += ', esfuerzo percibido subiendo'
      else if (diff < -1) tendencia += ', esfuerzo percibido bajando'
    }
    return `\nHISTORIAL ÚLTIMAS ${historialMetricas.length} SEMANAS:\n${lineas.join('\n')}\nTENDENCIA: ${tendencia}`
  })() : ''

  const alertaFatigaSection = (() => {
    if (historialMetricas.length === 0) return ''
    const rpes = historialMetricas.slice(0, 2).map(m => m.rpeMedia).filter(r => r != null)
    const adherencias = historialMetricas.slice(0, 2).map(m => m.adherencia).filter(a => a != null)
    const rpeAlto = rpes.length >= 2 && (rpes[0] + rpes[1]) / 2 > 8
    const adherenciaBaja = adherencias.some(a => a < 60)
    if (!rpeAlto && !adherenciaBaja) return ''
    const motivo = [rpeAlto && 'RPE elevado', adherenciaBaja && 'baja adherencia'].filter(Boolean).join('/')
    return `\nALERTA FATIGA: El atleta muestra signos de fatiga acumulada (${motivo}). Esta semana prioriza recuperación, reduce volumen un 20% y no propongas sesiones nuevas intensas.`
  })()

  const planProximaSemanaSection = planProximaSemana ? (() => {
    const lunes = new Date(planProximaSemana.semana + 'T12:00:00')
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return `\nPLAN PRÓXIMA SEMANA (lunes ${fmt(lunes)} — domingo ${fmt(domingo)}):\n${planProximaSemana.sesiones.map(s =>
      `${s.dia}: ${s.tipo} - ${s.descripcion}`
    ).join('\n')}\nSi el usuario pregunta por la próxima semana, usa este plan.`
  })() : ''

  const separacionPlanes = (plan && planProximaSemana)
    ? `\nATENCIÓN: Son dos planes DISTINTOS. El plan actual cubre solo los días restantes de esta semana (puede tener menos de 7 días si se generó a mitad de semana). El plan próxima semana es la semana siguiente completa. No los confundas ni mezcles.`
    : ''

  // ── 3. Modo taper automático ─────────────────────────────────────────────────
  const taperSection = (() => {
    if (!profile.fecha_carrera) return ''
    const hoy = new Date()
    const carrera = new Date(profile.fecha_carrera + 'T12:00:00')
    const diasRestantes = Math.ceil((carrera - hoy) / (1000 * 60 * 60 * 24))
    if (diasRestantes > 0 && diasRestantes <= 14) {
      return `\nMODO TAPER ACTIVO: La carrera es en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}. Prioriza el descanso y la frescura muscular por encima de cualquier ganancia de forma. No propongas sesiones largas ni intensas. El trabajo ya está hecho — ahora toca llegar fresco.`
    }
    return ''
  })()

  const planDebug = plan
    ? `\nPLAN ID: ${plan.id} | SEMANA: ${plan.semana}`
    : ''

  const interpretacionTests = `
INTERPRETACIÓN DE RESULTADOS DE TESTS DE EVALUACIÓN:
Si el usuario menciona resultados de tests, interprétalos y calcula sus zonas:

RUNNING:
- Cooper Test (distancia en 12min): VO2max estimado = (distancia_km × 1000 - 504.9) / 44.73. Z2 = 65-75% FCmax, Umbral = 87-92% FCmax.
- 5K TT: pace de 5K = zona 4-5. Z2 ≈ pace5K + 90-120seg/km. Umbral ≈ pace5K + 30-40seg/km.

TRIATLÓN:
- Vcrit natación = (400 - 200) / (t400_seg - t200_seg) m/s × 100 = min/100m umbral. Z2 = 85-90% Vcrit.
- 20min TT bici/run: FC media = umbral anaeróbico. Zonas = % de esa FC.
- 5K TT running: igual que running.

HYROX:
- 5K pace + 12-15seg/km = pace objetivo en runs de Hyrox.
- 3RM press banca y pull-ups → cargas de entrenamiento para estaciones Hyrox.

NATACIÓN:
- Vcrit = (400 - 200) / (t400_seg - t200_seg) m/s → ritmo Z4. Z2 = 85-90% Vcrit.

Cuando el usuario comparta resultados: calcula sus zonas, explícaselas de forma sencilla y dile que su próximo plan ya estará calibrado con estos datos.`

  // ── 5. Nutrición integrada ───────────────────────────────────────────────────
  const tieneNutricion = profile.peso || profile.objetivo_nutricional || profile.preferencias_alimentarias || profile.intolerancias

  const nutritionSection = tieneNutricion ? (() => {
    const pesoInfo = profile.peso ? `El atleta pesa ${profile.peso} kg.` : ''
    const objNut = {
      rendimiento: 'objetivo: máximo rendimiento deportivo',
      perdida_grasa: 'objetivo: pérdida de grasa manteniendo rendimiento',
      mantenimiento: 'objetivo: mantenimiento de peso y composición',
      ganancia_muscular: 'objetivo: ganancia muscular',
    }
    const objNutInfo = profile.objetivo_nutricional ? objNut[profile.objetivo_nutricional] || '' : ''
    const prefsInfo = profile.preferencias_alimentarias ? `Preferencias: ${truncar(profile.preferencias_alimentarias, 200)}.` : ''
    const intolerInfo = profile.intolerancias ? `Intolerancias/alergias (SIEMPRE respetar): ${truncar(profile.intolerancias, 200)}.` : ''
    return `
CONOCIMIENTO NUTRICIONAL INTEGRADO CON EL PLAN:
Eres también experto en nutrición deportiva. Cuando sea relevante, combina entrenamiento y nutrición de forma natural — como un coach real que conoce ambas dimensiones del atleta.
${pesoInfo} ${objNutInfo} ${prefsInfo} ${intolerInfo}

Si tienes el plan de hoy, proactivamente sugiere nutrición para esa sesión cuando el atleta pregunte o cuando sea obvio que ayuda.

PRE-ENTRENO según intensidad:
- Sesión suave Z2 (<60min): ayuno o snack ligero (plátano, tostada)
- Sesión moderada (60-90min): 50-70g carbohidratos + proteína moderada
- Sesión intensa/larga (>90min): 70-100g carbohidratos, baja en grasa

DURANTE EL ENTRENO:
- <60min baja intensidad: solo agua
- 60-90min moderado: 30-40g carbohidratos/hora
- >90min o intenso: 60-90g carbohidratos/hora + sodio 400-700mg/hora
- Hidratación: 400-800ml/hora según temperatura

POST-ENTRENO (ventana 30-45min):
- Proteína: 0.3-0.4g/kg${profile.peso ? ` (${Math.round(0.35 * profile.peso)}-${Math.round(0.4 * profile.peso)}g para ${profile.peso}kg)` : ''}
- Carbohidratos: 1-1.2g/kg para resintetizar glucógeno
- Hidratación: 1.5L por kg perdido

POR DEPORTE:
- Triatlón/running largo: carga carbohidratos 2-3 días antes de carrera
- Natación: mayor tolerancia a entrenar en ayuno
- Hyrox/fuerza: proteína 1.6-2.2g/kg/día, creatina 3-5g/día
- Ciclismo rodillo: menor sudoración, ajustar hidratación

${profile.objetivo_nutricional === 'perdida_grasa' ? `OBJETIVO PÉRDIDA DE GRASA + RENDIMIENTO: Déficit máximo 300-500kcal en días de entreno suave. Nunca déficit en días de sesión intensa o larga. Priorizar proteína para preservar músculo (2g/kg/día mínimo). Refeed de carbohidratos antes de sesiones importantes.` : ''}

SUPLEMENTOS con evidencia sólida (mencionar solo si relevante):
- Creatina monohidrato: 3-5g/día — cualquier momento
- Cafeína: 3-6mg/kg, 45-60min pre-entreno
- Proteína whey: si no llega a objetivo por comida
- Vitamina D, Omega-3 (2-3g/día), Magnesio (300-400mg antes de dormir)

IMPORTANTE: Tono natural, no clínico. No das listas de macros sin que te pregunten. Integras la nutrición de forma conversacional cuando añade valor real.`
  })() : ''

  const macrocicloSection = cycle && Array.isArray(cycle.fases) && cycle.fases.length > 0 ? (() => {
    const adherencia = calcularAdherencia(historialPlanes)
    const planAnterior = historialPlanes[0]
    const volumenAnterior = planAnterior
      ? (planAnterior.volumen_real_min || planAnterior.volumen_planificado_min || 0)
      : 0

    const hoyStr = new Date().toISOString().split('T')[0]
    const semanaActual = Math.max(1, Math.round((new Date(hoyStr) - new Date(cycle.fecha_inicio)) / (7 * 24 * 60 * 60 * 1000)) + 1)
    const faseActual = cycle.fases.find(f => semanaActual >= f.sem_inicio && semanaActual <= f.sem_fin) || cycle.fases[0]
    const semanasRestantes = cycle.semanas_totales - semanaActual
    const esTaper = faseActual.nombre === 'taper'
    const esDescarga = semanaActual % 4 === 0 && !esTaper

    const fc = profile.fc_maxima
    const zonasFC = fc
      ? `FC máx: ${fc}bpm → Z1: <${Math.round(fc * 0.6)}bpm, Z2: ${Math.round(fc * 0.6)}-${Math.round(fc * 0.75)}bpm, Z3: ${Math.round(fc * 0.75)}-${Math.round(fc * 0.85)}bpm, Z4: ${Math.round(fc * 0.85)}-${Math.round(fc * 0.92)}bpm, Z5: >${Math.round(fc * 0.92)}bpm`
      : ''

    function sumarSegPace(pace, seg) {
      if (!pace) return null
      const [m, s] = pace.split(':').map(Number)
      const total = m * 60 + s + seg
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    }
    const p5k = profile.pace_5k
    const zonasRun = p5k
      ? `Pace 5K: ${p5k}/km → Z2: ${sumarSegPace(p5k, 80)}-${sumarSegPace(p5k, 100)}/km, Umbral: ${sumarSegPace(p5k, 30)}-${sumarSegPace(p5k, 45)}/km`
      : ''
    const ftp = profile.ftp_bici
    const zonasBici = ftp
      ? `FTP bici: ${ftp}W → Z2: ${Math.round(ftp * 0.55)}-${Math.round(ftp * 0.74)}W, Z4: ${Math.round(ftp * 0.84)}-${Math.round(ftp * 0.97)}W`
      : ''

    const zonasSection = zonasFC || zonasRun || zonasBici
      ? `ZONAS DE ENTRENAMIENTO DEL ATLETA:\n${[zonasFC, zonasRun, zonasBici].filter(Boolean).join('\n')}`
      : 'Sin datos de rendimiento calibrados aún. Puedes pedirle al atleta sus resultados de un test de 5K o su FC máxima para personalizar las zonas.'

    return `\nMACROCICLO DEL ATLETA:
Semana ${semanaActual} de ${cycle.semanas_totales} · Fase: ${faseActual.nombre.toUpperCase()}
Objetivo de la fase: ${faseActual.objetivo}
${esDescarga ? '⚠️ SEMANA DE DESCARGA: volumen reducido 15-20%, sin sesiones intensas.' : ''}${esTaper ? `⚠️ MODO TAPER: ${semanasRestantes} semana${semanasRestantes !== 1 ? 's' : ''} para la carrera. Prioriza frescura. El trabajo ya está hecho.` : `Semanas restantes del ciclo: ${semanasRestantes}`}
${cycle.carrera_nombre ? `Carrera objetivo: ${cycle.carrera_nombre}` : 'Sin carrera objetivo (ciclo genérico)'}

PROGRESIÓN:
${adherencia ? `Adherencia últimas 4 semanas: ${adherencia.porcentaje}% (${adherencia.completadas}/${adherencia.total} sesiones)` : 'Sin historial suficiente aún.'}
${adherencia?.rpeMedio ? `RPE medio último mes: ${adherencia.rpeMedio}/10` : ''}
Volumen semana anterior: ${volumenAnterior ? `${volumenAnterior}min` : 'sin datos'}
${plan ? `Volumen planificado esta semana: ${plan.volumen_planificado_min || 0}min` : ''}

${zonasSection}`
  })() : ''

  const ajusteInstructions = plan ? `
AJUSTE DE PLAN:
Cuando el usuario pida cambiar el plan, propón el ajuste concreto explicando qué cambiarías y por qué. El sistema mostrará automáticamente un botón para aplicar el cambio.
IMPORTANTE: Nunca generes un plan semanal completo en el chat. Si el atleta pide un plan nuevo, dile que vaya a la pestaña Plan y pulse 'Generar plan'. En el chat solo puedes ajustar sesiones concretas del plan existente usando el botón 'Aplicar cambio al plan'.` : `
IMPORTANTE: Nunca generes un plan semanal completo en el chat. Si el atleta pide un plan nuevo, dile que vaya a la pestaña Plan y pulse 'Generar plan'.`

  return `Eres un coach deportivo personal experto en ${deporteInfo[deporte] || deporte}.
Tu nombre es ${nombreCoach}. El usuario te llama así.${natacionContext}
HOY ES: ${ahora}. Nunca preguntes al usuario qué día es.
Tu atleta se llama ${nombre}, tiene nivel ${nivel} y su objetivo es: ${objetivo}.
${fechaCarrera}${multiDeporteSection}${todasCarrerasSection}${macrocicloSection}
${contexto}

${estiloPersonalidad}

Tu rol es:
- Diseñar planes de entrenamiento personalizados y progresivos
- Dar consejos de nutrición específicos para su deporte
- Motivar y apoyar al atleta en su progreso
- Responder preguntas técnicas sobre entrenamiento, técnica y recuperación
- Adaptar el plan según su disponibilidad y nivel de fatiga

Responde siempre en español, de forma clara y concisa.
Usa datos concretos: distancias, tiempos, zonas de frecuencia cardíaca cuando sea relevante.
Cuando tengas datos de Strava del atleta, úsalos activamente en tus respuestas. Son datos reales sincronizados de su cuenta Strava.
${protocoloSeguridad}
${planDebug}${actividadesSection}${wellnessSection}${planSection}${reconocimientoSection}${historialSection}${alertaFatigaSection}${taperSection}${planProximaSemanaSection}${separacionPlanes}
${nutritionSection}
${interpretacionTests}${ajusteInstructions}`
}
