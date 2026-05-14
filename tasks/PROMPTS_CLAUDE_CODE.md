# Prompts para Claude Code — TriCoach Redefinición
_Copiar cada bloque entero en Claude Code. Ejecutar en orden._

---

## BLOQUE 1 — SQL migrations + create-cycle + App.jsx

```
Lee CLAUDE.md y tasks/lessons.md antes de empezar.
Lee también SPEC.md en la raíz del proyecto.

Objetivo: crear la infraestructura del macrociclo sin tocar UI ni romper nada existente.

IMPORTANTE: Hay usuarios reales con datos en Supabase. Antes de cualquier ALTER TABLE,
comprueba que la columna no existe ya. Usa IF NOT EXISTS en todo.

━━━ PASO 1 — SQL migrations ━━━

Crea el archivo supabase/migrations/001_training_cycles.sql con:

1. Tabla nueva training_cycles:
CREATE TABLE IF NOT EXISTS training_cycles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  carrera_nombre  text,
  carrera_tipo    text,
  fecha_carrera   date,
  fecha_inicio    date NOT NULL,
  semanas_totales integer NOT NULL,
  fases           jsonb NOT NULL,
  estado          text DEFAULT 'active',
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_cycles_user_estado ON training_cycles(user_id, estado);

2. Extensión de plans:
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS cycle_id              uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS numero_semana         integer,
  ADD COLUMN IF NOT EXISTS fase                  text,
  ADD COLUMN IF NOT EXISTS objetivo_semana       text,
  ADD COLUMN IF NOT EXISTS volumen_planificado_min integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumen_real_min       integer DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_plans_cycle ON plans(user_id, cycle_id);

3. Extensión de profiles:
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_cycle_id      uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS fc_maxima            integer,
  ADD COLUMN IF NOT EXISTS pace_5k              text,
  ADD COLUMN IF NOT EXISTS pace_10k             text,
  ADD COLUMN IF NOT EXISTS pace_media_maraton   text,
  ADD COLUMN IF NOT EXISTS ftp_bici             integer,
  ADD COLUMN IF NOT EXISTS ritmo_natacion_100m  text;

Aplica la migración en Supabase usando la REST API o mostrándola para aplicar manualmente.
Si no puedes aplicarla directamente, guárdala en supabase/migrations/ y muestra instrucciones claras.

━━━ PASO 2 — src/lib/cycles.js ━━━

Crea src/lib/cycles.js con estas funciones exportadas:

calcularFases(fechaInicio, fechaFin):
- Calcula las fases del macrociclo según semanas totales
- Reglas:
  * < 6 sem  → [peak 70%, taper 2sem]
  * 6-10 sem → [build 55%, peak resto-2, taper 2sem]
  * 10-16 sem → [base 30%, build 40%, peak resto-2, taper 2sem]
  * > 16 sem  → [base 40%, build 35%, peak resto-2, taper 2sem]
- Cada fase: { nombre, sem_inicio, sem_fin, objetivo }
- objetivos: base="Construir base aeróbica y volumen progresivo",
  build="Desarrollar umbral y capacidad de trabajo", 
  peak="Máxima intensidad y simulacros de carrera",
  taper="Reducir volumen, llegar fresco a la carrera"

getFaseActual(fases, numeroSemana):
- Devuelve la fase que contiene ese numeroSemana
- Fallback: primera fase

esSemanaDescarga(numeroSemana, fase):
- true si numeroSemana % 4 === 0 AND fase.nombre !== 'taper'

getNumeroSemana(fechaInicio, fechaSemanaActual):
- Calcula semana dentro del ciclo (1-based)
- Usa diferencia de fechas en semanas

━━━ PASO 3 — netlify/functions/create-cycle.js ━━━

Nueva Netlify Function. Usa el template del CLAUDE.md (CommonJS, validar secret, CORS).

Input POST: { userId }

Lógica:
1. Obtener perfil del usuario desde Supabase (REST API, service key)
2. Buscar si ya existe un training_cycle activo para ese user_id → si existe, devolverlo sin crear otro
3. Determinar fecha_carrera: 
   - Buscar en profile.carreras (array jsonb) la carrera con fecha futura más próxima
   - Si no hay → fecha_fin = hoy + 16 semanas (ciclo genérico)
4. fecha_inicio = lunes de la semana actual (calcular en JS)
5. semanas_totales = diferencia en semanas entre fecha_inicio y fecha_carrera/fecha_fin
6. Llamar a calcularFases() — importar la lógica directamente en la function (no importar desde src/)
7. INSERT en training_cycles
8. UPDATE profiles SET active_cycle_id = nuevo_id WHERE id = userId
9. Devolver { cycle }

━━━ PASO 4 — App.jsx ━━━

En App.jsx, dentro del bloque donde se carga el perfil (después de loadOrCreateProfile):

Si profile existe Y profile.active_cycle_id es null o undefined:
  → llamar a /.netlify/functions/create-cycle con { userId }
  → guardar el cycle en estado local (useState activeCycle)

Si profile.active_cycle_id existe:
  → hacer GET a Supabase para obtener el cycle activo
  → guardarlo en estado local

Pasar activeCycle como prop a Dashboard, Chat y Progreso (aunque aún no lo usen — lo necesitarán en bloques siguientes).

━━━ PASO 5 — Tests ━━━

Crea src/test/cycles.test.js con tests de:
- calcularFases con 5, 8, 12, 18, 24 semanas
- getFaseActual para semanas en distintas fases
- esSemanaDescarga (semanas 4, 8, 12 → true; semanas 3, 5 → false; taper → false)
- getNumeroSemana

━━━ CIERRE ━━━

npm test && npm run build

Si todo pasa:
git add .
git commit -m "feat: macrocycle infrastructure - training_cycles table, create-cycle function, cycles lib"
```

---

## BLOQUE 2 — Sesiones con estructura real

```
Lee CLAUDE.md y tasks/lessons.md antes de empezar.
Lee también SPEC.md en la raíz del proyecto.

Objetivo: reescribir la generación de planes para que las sesiones tengan estructura
real (calentamiento, bloque principal, vuelta a la calma) y duraciones correctas.

━━━ PASO 1 — netlify/functions/generate-plan.js ━━━

Reescribir esta función. Mantener toda la lógica existente (multi-deporte, carreras,
diagnóstico, análisis semana anterior) y añadir:

1. Al inicio, recuperar el training_cycle activo del usuario:
   GET /rest/v1/training_cycles?user_id=eq.{userId}&estado=eq.active&limit=1

2. Calcular numero_semana del plan que se genera (usando getNumeroSemana)
   Calcular faseActual usando getFaseActual
   Calcular esSemanaDescarga

3. Nuevo prompt a Claude — añadir estas secciones al userMessage:

CONTEXTO DEL MACROCICLO:
- Semana {numeroSemana} de {semanasTotales} del ciclo
- Fase: {FASE_NOMBRE_UPPERCASE} — {objetivo de la fase}
- {si esSemanaDescarga: "SEMANA DE DESCARGA: reducir carga 15-20%, sin sesiones intensas"}
- Adherencia últimas 4 semanas: {X}% ({n} de {total} sesiones completadas)
- Volumen semana anterior: {X}min

4. Nuevo formato de sesiones en el prompt — el JSON que debe generar Claude:

El JSON debe tener esta estructura EXACTA para cada sesión activa:
{
  "dia": "Lunes",
  "tipo": "Correr",
  "subtipo": "Rodaje Z2",
  "duracion_min": 75,
  "distancia_km": 11,
  "intensidad": "suave",
  "zona_objetivo": "Z2",
  "estructura": {
    "calentamiento": "10min trote muy suave Z1...",
    "principal": "55min continuo Z2. Pace objetivo 5:45-6:05/km...",
    "vuelta_calma": "10min caminata. Estiramientos...",
    "rpe_objetivo": "5-6"
  },
  "completada": false,
  "tiempo_real_min": null,
  "distancia_real_km": null,
  "fc_media_real": null,
  "rpe_usuario": null,
  "notas_usuario": null
}

Para sesiones de descanso: solo dia, tipo="Descanso", intensidad="descanso", completada:false.
No incluir estructura en descansos.

5. DURACIONES MÍNIMAS — incluir esto en el prompt a Claude:
base: Z2 corto 45-70min, largo 70-110min, intervalos 55-70min, bici Z2 75-120min
build: Z2 corto 55-80min, largo 85-130min, intervalos 65-80min, bici 90-150min, brick 90-130min
peak: Z2 60-80min, largo 90-140min, intervalos 70-85min, brick 100-150min
taper: Z2 35-50min, largo 50-70min, bici 50-75min
Si es semana de descarga: usar el mínimo de cada rango.

6. Al guardar el plan en Supabase, incluir los nuevos campos:
   cycle_id, numero_semana, fase (nombre), objetivo_semana, volumen_planificado_min
   (volumen_planificado_min = suma de duracion_min de sesiones no descanso)

━━━ PASO 2 — netlify/functions/adjust-plan.js ━━━

Al ajustar sesiones, conservar la estructura del nuevo formato:
- Si la sesión ajustada tiene campo "estructura", mantenerlo y actualizarlo coherentemente
- Si viene del formato antiguo (sin estructura), convertirla con migrarSesionAntigua() antes de ajustar
- La función de migración:
  function migrarSesionAntigua(s) {
    if (s.estructura) return s
    return {
      ...s,
      subtipo: s.tipo,
      distancia_km: null,
      zona_objetivo: s.intensidad === 'suave' ? 'Z1-Z2' : s.intensidad === 'moderada' ? 'Z3-Z4' : 'Z4-Z5',
      estructura: {
        calentamiento: 'Calentamiento general 10min.',
        principal: s.descripcion,
        vuelta_calma: 'Vuelta a la calma y estiramientos.',
        rpe_objetivo: s.intensidad === 'suave' ? '4-5' : s.intensidad === 'moderada' ? '6-7' : '7-8',
      },
      tiempo_real_min: null, distancia_real_km: null, fc_media_real: null, notas_usuario: null,
    }
  }

━━━ PASO 3 — src/components/WeeklyPlan.jsx ━━━

Actualizar las cards de sesión para mostrar la estructura expandible:

Cada sesión card:
- Cabecera: día + tipo + subtipo + duracion_min + zona_objetivo (chip) + intensidad (chip)
- Si está completada: check verde + tiempo_real + rpe_usuario si existen
- Botón "Ver detalle" o chevron ▸ para expandir
- Expandido muestra 3 bloques:
  🔥 Calentamiento: {estructura.calentamiento}
  💪 Principal: {estructura.principal}
  🧘 Vuelta a la calma: {estructura.vuelta_calma}
  RPE objetivo: {estructura.rpe_objetivo}
- Si la sesión es formato antiguo (sin estructura), mostrar solo la descripción como antes

━━━ PASO 4 — src/components/ModalCompletarSesion.jsx ━━━

Nuevo componente. Modal que aparece al pulsar el check de una sesión.

Campos (todos opcionales excepto el guardado):
- Tiempo real: input numérico (minutos)
- Distancia: input numérico (km) — solo si la sesión no es Fuerza/Descanso
- FC media: input numérico (bpm) — solo si el perfil tiene fc_maxima
- RPE: selector visual 1-10 con colores (1-3 verde, 4-6 amarillo, 7-8 naranja, 9-10 rojo)
- Notas: textarea libre (placeholder: "¿Cómo fue? Dolor, cansancio, condiciones...")

Botones: "Guardar" (primario) y "Solo marcar completada" (secundario, sin datos)

Al guardar: PATCH a Supabase plans actualizando la sesión específica dentro del array sesiones
(buscar por día y tipo), poner completada:true + los campos que haya rellenado.
Recalcular y actualizar volumen_real_min del plan.

━━━ PASO 5 — Tests ━━━

Actualizar weeklyPlan.test.js para el nuevo formato de sesiones.
Actualizar netlify-functions.test.js para generate-plan con los nuevos campos.

━━━ CIERRE ━━━

npm test && npm run build

Si todo pasa:
git add .
git commit -m "feat: structured sessions - calentamiento/principal/vuelta_calma, real durations, completion modal"
```

---

## BLOQUE 3 — Coach con contexto completo

```
Lee CLAUDE.md y tasks/lessons.md antes de empezar.
Lee también SPEC.md en la raíz del proyecto.

Objetivo: el coach sabe en qué fase está el atleta, su progresión real
y sus zonas de entrenamiento. Debe poder responder "¿en qué fase estoy?"
y "¿cómo voy?" con datos reales.

━━━ PASO 1 — src/prompts/buildSystemPrompt.js ━━━

Añadir un nuevo parámetro al final de la firma:
buildSystemPrompt(profile, personalidad, actividades, plan, planProximaSemana, historialPlanes, cycle)

Nueva función helper para calcular métricas de adherencia:
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

Nueva sección en el system prompt (inyectar después de la sección de plan actual):

const macrocicloSection = cycle ? (() => {
  const adherencia = calcularAdherencia(historialPlanes)
  const planAnterior = historialPlanes[0]
  const volumenAnterior = planAnterior ? (planAnterior.volumen_real_min || planAnterior.volumen_planificado_min || 0) : 0
  
  // Calcular fase actual y semana
  const hoy = new Date().toISOString().split('T')[0]
  const fechaInicioCycle = cycle.fecha_inicio
  const semanaActual = Math.max(1, Math.round((new Date(hoy) - new Date(fechaInicioCycle)) / (7*24*60*60*1000)) + 1)
  const faseActual = cycle.fases.find(f => semanaActual >= f.sem_inicio && semanaActual <= f.sem_fin) || cycle.fases[0]
  const semanasRestantes = cycle.semanas_totales - semanaActual
  const esTaper = faseActual.nombre === 'taper'
  const esDescarga = semanaActual % 4 === 0 && !esTaper

  // Zonas desde datos de rendimiento del perfil
  const fc = profile.fc_maxima
  const zonasFC = fc ? `FC máx: ${fc}bpm → Z1: <${Math.round(fc*0.6)}bpm, Z2: ${Math.round(fc*0.6)}-${Math.round(fc*0.75)}bpm, Z3: ${Math.round(fc*0.75)}-${Math.round(fc*0.85)}bpm, Z4: ${Math.round(fc*0.85)}-${Math.round(fc*0.92)}bpm, Z5: >${Math.round(fc*0.92)}bpm` : ''
  
  function sumarSegPace(pace, seg) {
    if (!pace) return null
    const [m, s] = pace.split(':').map(Number)
    const total = m * 60 + s + seg
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`
  }
  const p5k = profile.pace_5k
  const zonasRun = p5k ? `Pace 5K: ${p5k}/km → Z2: ${sumarSegPace(p5k,80)}-${sumarSegPace(p5k,100)}/km, Umbral: ${sumarSegPace(p5k,30)}-${sumarSegPace(p5k,45)}/km` : ''
  const ftp = profile.ftp_bici
  const zonasBici = ftp ? `FTP bici: ${ftp}W → Z2: ${Math.round(ftp*0.55)}-${Math.round(ftp*0.74)}W, Z4: ${Math.round(ftp*0.84)}-${Math.round(ftp*0.97)}W` : ''

  return `
MACROCICLO DEL ATLETA:
Semana ${semanaActual} de ${cycle.semanas_totales} · Fase: ${faseActual.nombre.toUpperCase()}
Objetivo de la fase: ${faseActual.objetivo}
${esDescarga ? '⚠️ SEMANA DE DESCARGA: volumen reducido 15-20%, sin sesiones intensas.' : ''}
${esTaper ? `⚠️ MODO TAPER: ${semanasRestantes} semana${semanasRestantes!==1?'s':''} para la carrera. Prioriza frescura. El trabajo ya está hecho.` : `Semanas restantes del ciclo: ${semanasRestantes}`}
${cycle.carrera_nombre ? `Carrera objetivo: ${cycle.carrera_nombre}` : 'Sin carrera objetivo (ciclo genérico)'}

PROGRESIÓN:
${adherencia ? `Adherencia últimas 4 semanas: ${adherencia.porcentaje}% (${adherencia.completadas}/${adherencia.total} sesiones)` : 'Sin historial suficiente aún.'}
${adherencia?.rpeMedio ? `RPE medio último mes: ${adherencia.rpeMedio}/10` : ''}
Volumen semana anterior: ${volumenAnterior ? `${volumenAnterior}min` : 'sin datos'}
${plan ? `Volumen planificado esta semana: ${plan.volumen_planificado_min || 0}min` : ''}

${zonasFC || zonasRun || zonasBici ? `ZONAS DE ENTRENAMIENTO DEL ATLETA:
${zonasFC}
${zonasRun}
${zonasBici}`.trim() : 'Sin datos de rendimiento calibrados aún. Puedes pedirle al atleta sus resultados de un test de 5K o su FC máxima para personalizar las zonas.'}
`
})() : ''

Inyectar macrocicloSection justo después de las líneas que definen fechaCarrera y antes de contexto.

━━━ PASO 2 — netlify/functions/claude.js ━━━

Al construir el system prompt, recuperar el training_cycle activo del usuario y pasarlo
a buildSystemPrompt como último parámetro.

GET /rest/v1/training_cycles?user_id=eq.{userId}&estado=eq.active&limit=1

Pasar el resultado (o null si no existe) a buildSystemPrompt.

━━━ PASO 3 — Tests ━━━

Actualizar src/test/systemPrompt.test.js:
- Test: con cycle activo, el prompt incluye "MACROCICLO"
- Test: con cycle en fase taper, el prompt incluye "TAPER"
- Test: con fc_maxima en perfil, el prompt incluye las zonas calculadas
- Test: sin cycle, el prompt NO incluye "MACROCICLO" (no rompe nada)

━━━ CIERRE ━━━

npm test && npm run build

Si todo pasa:
git add .
git commit -m "feat: coach with full macrocycle context - phase, progression, training zones"
```

---

## BLOQUE 4 — UI: Dashboard + Progreso

```
Lee CLAUDE.md y tasks/lessons.md antes de empezar.
Lee DESIGN.md para el sistema de diseño (colores, tipografía, tokens).
Lee también SPEC.md en la raíz del proyecto.

Objetivo: el atleta ve de un vistazo en qué fase está y cuántas semanas le quedan.
Estos son los cambios de UI finales antes de mandar el email a Strava con capturas.

━━━ PASO 1 — src/components/Dashboard.jsx ━━━

Recibe activeCycle como prop (ya pasado desde App.jsx en Bloque 1).

Añadir encima de la sesión de hoy una barra de macrociclo:

Si activeCycle existe, mostrar:
┌──────────────────────────────────────────────────────┐
│  Semana 6 de 20   [████████░░░░░░░░░░░░]   Fase Build│
│  16 semanas para Valencia Marathon                    │
└──────────────────────────────────────────────────────┘

Implementación:
- Barra de progreso: div con background var(--secondary), dentro div con width=(semanaActual/semanasTotales*100)% y background var(--primary)
- Texto izquierda: "Semana X de Y" en 13px var(--muted-foreground)
- Texto derecha: "Fase NOMBRE" con color según fase:
  base → var(--success), build → #3B8BD4, peak → var(--primary), taper → #8B5CF6
- Segunda línea: "X semanas para {carrera_nombre}" o "Ciclo general" si sin carrera
- Si faseActual es descarga: añadir chip pequeño "Semana de descarga" en naranja suave

━━━ PASO 2 — src/components/Progreso.jsx (o donde esté la pantalla de progreso) ━━━

Añadir al inicio de la pantalla, antes de las métricas actuales, la timeline del macrociclo.

Timeline visual horizontal:
- Un bloque por fase, ancho proporcional a sus semanas
- Colores: base=#10B981, build=#3B8BD4, peak=#FF6B2B, taper=#8B5CF6
- La fase actual: borde más grueso + etiqueta "← aquí"
- Fases completadas: opacidad reducida
- Dentro de cada bloque: nombre de la fase + "X sem"

Ejemplo visual:
[  BASE 8sem  ][BUILD 6sem▼][PEAK 4s][TAP]
                    ↑ aquí

Implementación en React sin librerías externas:
- Flex row con los bloques
- Calcular qué fase es la actual comparando semanaActual con sem_inicio/sem_fin de cada fase
- Indicador de posición con un pequeño triángulo o línea vertical bajo el bloque activo

Las métricas actuales (días para objetivo, consistencia, adherencia, volumen) se mantienen
exactamente igual debajo de la timeline.

━━━ PASO 3 — src/components/WeeklyPlan.jsx ━━━

Añadir cabecera de semana si el plan tiene los campos nuevos (fase, objetivo_semana):

Si plan.fase existe:
┌──────────────────────────────────────┐
│  Semana 6 · BUILD                    │
│  Objetivo: Desarrollar umbral y...   │
└──────────────────────────────────────┘

Pequeño texto de 13px en var(--muted-foreground). No invasivo.

━━━ CIERRE ━━━

npm test && npm run build

Revisar en el navegador que:
- Dashboard muestra la barra de macrociclo
- Progreso muestra la timeline de fases
- WeeklyPlan muestra el objetivo de la semana
- Todo el diseño es coherente con el design system (dark theme, tokens CSS)

Si todo bien:
git add .
git commit -m "feat: macrocycle UI - phase bar in dashboard, timeline in progress, week objective in plan"
```

---

## Notas para Claude Code

- Leer siempre CLAUDE.md + tasks/lessons.md + SPEC.md al inicio de cada bloque
- `npm test && npm run build` al final de cada bloque sin excepción
- Si un test falla, buscar la causa raíz antes de seguir
- Los 48 tests existentes deben seguir pasando en todos los bloques
- Usar siempre variables CSS del design system (--primary, --card, --border, etc.)
- Netlify Functions: CommonJS siempre, validar x-tricoach-secret, usar https nativo para Supabase
- No usar console.log en producción, solo console.error para errores reales
- Cada bloque termina con git commit antes de cerrar
