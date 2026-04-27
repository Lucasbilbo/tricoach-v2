# TriCoach AI — Especificación de Redefinición
_Versión 1.0 — Abril 2026_

---

## Resumen ejecutivo

Redefinición completa de la lógica de entrenamiento de TriCoach. El cambio central es pasar de un sistema de **planes semanales aislados** a un sistema de **macrociclo completo** que da contexto real a cada sesión, al coach y al atleta. El stack técnico, diseño y monetización no cambian.

---

## Decisiones tomadas

| # | Decisión |
|---|----------|
| 1 | Macrociclo generado al terminar el onboarding para todos los usuarios |
| 2 | Migración de datos para usuarios existentes (ciclo creado automáticamente) |
| 3 | Datos de rendimiento (FC, paces) opcionales en onboarding |
| 4 | Pantalla Progreso: mantener métricas actuales + añadir timeline del macrociclo encima |
| 5 | Usuarios existentes: ciclo creado a partir de `fecha_carrera` del perfil |
| 6 | Sin carrera objetivo → ciclo genérico de 16 semanas renovable automáticamente |

---

## Arquitectura del macrociclo

### Fases y distribución

```
Con carrera objetivo (ej: 20 semanas):
├── BASE    8 sem  → Aeróbico Z2, volumen progresivo, técnica
├── BUILD   6 sem  → Umbral + intervalos, descarga cada 4ª semana
├── PEAK    4 sem  → VO2max, simulacros de ritmo de carrera
└── TAPER   2 sem  → Reducción volumen 40-60%, mantener intensidad

Ajuste automático por semanas disponibles:
- < 6 semanas  → Solo TAPER + PEAK reducido
- 6-10 sem     → PEAK + TAPER (sin base ni build formal)
- 10-16 sem    → BUILD + PEAK + TAPER
- 16-20 sem    → BASE + BUILD + PEAK + TAPER (estándar)
- > 20 sem     → BASE extendida

Sin carrera:
└── Ciclo de 16 semanas renovable: 6 BASE + 6 BUILD + 4 PEAK → reinicia
```

### Algoritmo de cálculo de fases (JavaScript)

```javascript
function calcularFases(fechaInicio, fechaFin) {
  const totalSemanas = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (7 * 24 * 60 * 60 * 1000))
  
  if (totalSemanas <= 6) {
    return [
      { nombre: 'peak',  sem_inicio: 1, sem_fin: totalSemanas - 2 },
      { nombre: 'taper', sem_inicio: totalSemanas - 1, sem_fin: totalSemanas },
    ]
  }
  if (totalSemanas <= 10) {
    const buildSem = totalSemanas - 2
    return [
      { nombre: 'build', sem_inicio: 1, sem_fin: buildSem - 2 },
      { nombre: 'peak',  sem_inicio: buildSem - 1, sem_fin: buildSem },
      { nombre: 'taper', sem_inicio: buildSem + 1, sem_fin: totalSemanas },
    ]
  }
  if (totalSemanas <= 16) {
    const taper = 2, peak = 3, build = Math.round((totalSemanas - taper - peak) * 0.55)
    const base = totalSemanas - taper - peak - build
    return [
      { nombre: 'base',  sem_inicio: 1,                 sem_fin: base },
      { nombre: 'build', sem_inicio: base + 1,          sem_fin: base + build },
      { nombre: 'peak',  sem_inicio: base + build + 1,  sem_fin: totalSemanas - taper },
      { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
    ]
  }
  // > 16 semanas
  const taper = 2, peak = 4
  const build = Math.round((totalSemanas - taper - peak) * 0.4)
  const base = totalSemanas - taper - peak - build
  return [
    { nombre: 'base',  sem_inicio: 1,                sem_fin: base },
    { nombre: 'build', sem_inicio: base + 1,         sem_fin: base + build },
    { nombre: 'peak',  sem_inicio: base + build + 1, sem_fin: totalSemanas - taper },
    { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
  ]
}

function getFaseActual(cycle, numeroSemana) {
  return cycle.fases.find(f => numeroSemana >= f.sem_inicio && numeroSemana <= f.sem_fin)
    || cycle.fases[0]
}

function esSemanaDescarga(numeroSemana, fase) {
  if (fase.nombre === 'taper') return false  // taper ya es descarga
  return numeroSemana % 4 === 0
}
```

---

## Modelo de datos

### Nueva tabla: `training_cycles`

```sql
CREATE TABLE training_cycles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  carrera_nombre  text,
  carrera_tipo    text,     -- 'running' | 'triatlon' | 'hyrox' | null
  fecha_carrera   date,     -- null si ciclo genérico sin carrera
  fecha_inicio    date NOT NULL,
  semanas_totales integer NOT NULL,
  fases           jsonb NOT NULL,
  -- fases: [{ nombre: 'base'|'build'|'peak'|'taper', sem_inicio: int, sem_fin: int, objetivo: text }]
  estado          text DEFAULT 'active', -- 'active' | 'completed' | 'paused'
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON training_cycles(user_id, estado);
```

### Extensión de `plans`

```sql
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS cycle_id              uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS numero_semana         integer,
  ADD COLUMN IF NOT EXISTS fase                  text,   -- 'base'|'build'|'peak'|'taper'|'diagnostico'
  ADD COLUMN IF NOT EXISTS objetivo_semana       text,
  ADD COLUMN IF NOT EXISTS volumen_planificado_min integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumen_real_min       integer DEFAULT 0;

CREATE INDEX ON plans(user_id, cycle_id);
```

### Extensión de `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_cycle_id      uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS fc_maxima            integer,         -- FC máxima del atleta
  ADD COLUMN IF NOT EXISTS pace_5k              text,            -- ej: "4:30"
  ADD COLUMN IF NOT EXISTS pace_10k             text,
  ADD COLUMN IF NOT EXISTS pace_media_maraton   text,
  ADD COLUMN IF NOT EXISTS ftp_bici             integer,         -- vatios
  ADD COLUMN IF NOT EXISTS ritmo_natacion_100m  text;            -- ej: "1:50"
```

### Nuevo schema de `sesiones` (jsonb en plans)

Cada elemento del array `sesiones` pasa de:
```json
{ "dia": "Lunes", "tipo": "Correr", "descripcion": "...", "duracion_min": 45, "intensidad": "suave", "completada": false }
```

A:
```json
{
  "dia": "Lunes",
  "tipo": "Correr",
  "subtipo": "Rodaje Z2",
  "duracion_min": 75,
  "distancia_km": 11,
  "intensidad": "suave",
  "zona_objetivo": "Z2",
  "estructura": {
    "calentamiento": "10min trote muy suave Z1. Movilidad articular de tobillos y caderas.",
    "principal": "55min continuo Z2. Pace objetivo: 5:45-6:05/km. FC bajo 75% FCmax. Si sube, bajar ritmo.",
    "vuelta_calma": "10min caminata. Estiramientos gemelos, cuádriceps e isquios 2min cada uno.",
    "rpe_objetivo": "5-6"
  },
  "completada": false,
  "tiempo_real_min": null,
  "distancia_real_km": null,
  "fc_media_real": null,
  "rpe_usuario": null,
  "notas_usuario": null
}
```

### Migración del campo `sesiones` (usuarios existentes)

Al generar el primer plan con el nuevo sistema para cada usuario, el sistema detecta si las sesiones tienen el formato antiguo (sin campo `estructura`) y las convierte. No hay migración masiva en SQL — se hace lazy al regenerar el plan.

```javascript
function migrarSesionAntigua(sesionAntigua) {
  if (sesionAntigua.estructura) return sesionAntigua  // ya nuevo formato
  return {
    ...sesionAntigua,
    subtipo: sesionAntigua.tipo,
    distancia_km: null,
    zona_objetivo: inferirZona(sesionAntigua.intensidad),
    estructura: {
      calentamiento: 'Calentamiento general 10min.',
      principal: sesionAntigua.descripcion,
      vuelta_calma: 'Vuelta a la calma y estiramientos.',
      rpe_objetivo: inferirRpe(sesionAntigua.intensidad),
    },
    tiempo_real_min: null,
    distancia_real_km: null,
    fc_media_real: null,
    notas_usuario: null,
  }
}

function inferirZona(intensidad) {
  return { suave: 'Z1-Z2', moderada: 'Z3-Z4', fuerte: 'Z4-Z5', descanso: null }[intensidad] || 'Z2'
}
function inferirRpe(intensidad) {
  return { suave: '4-5', moderada: '6-7', fuerte: '7-8', descanso: null }[intensidad] || '5-6'
}
```

---

## Migración de usuarios existentes

Al arrancar la app (App.jsx, después de `loadOrCreateProfile`), si el usuario no tiene `active_cycle_id`, se llama a `create-cycle.js` automáticamente.

### Función `create-cycle.js` (nueva Netlify Function)

**Input:**
```json
{
  "userId": "uuid"
}
```

**Lógica:**
1. Obtener perfil del usuario
2. Determinar `fecha_fin`: la carrera más próxima futura, o si no hay → hoy + 16 semanas
3. `fecha_inicio`: lunes de la semana actual
4. Calcular `semanas_totales` y `fases`
5. Insertar en `training_cycles`
6. Actualizar `profiles.active_cycle_id`
7. Devolver el ciclo creado

**Output:**
```json
{
  "cycle": {
    "id": "uuid",
    "semanas_totales": 20,
    "fases": [...],
    "fecha_carrera": "2026-10-15",
    "estado": "active"
  }
}
```

---

## Actualización de `generate-plan.js`

### Nuevos parámetros de entrada

```json
{
  "userId": "uuid",
  "fechaInicio": "2026-04-28",
  "contextoSemana": "opcional"
}
```

La función ahora, además del perfil y Strava (si disponible), recupera:
- `training_cycles` activo del usuario
- `numero_semana` del plan que se va a generar
- `fase` correspondiente a ese número de semana
- `esSemanaDescarga` (numero_semana % 4 === 0)
- Últimas 4 semanas de adherencia y RPE medio

### Nuevas secciones del prompt a Claude

```
CONTEXTO DEL MACROCICLO:
- Semana: 6 de 20 del ciclo
- Fase actual: BUILD
- Objetivo de la fase: Desarrollar umbral anaeróbico y capacidad de trabajo a ritmo de carrera
- Semana de descarga: NO (es semana de carga)
- Adherencia últimas 4 semanas: 85% (17 de 20 sesiones completadas)
- Volumen semana anterior: 280min | Objetivo esta semana: +8% = ~302min
- RPE medio últimas 4 semanas: 6.2

DATOS DE RENDIMIENTO DEL ATLETA (si disponibles):
- FC máxima: 185 bpm
- Pace 5K: 4:30/km → Zonas: Z2=5:45-6:10, Z4=4:45-5:00, Umbral=4:55-5:05
- FTP bici: 220W
```

### Duraciones mínimas por tipo de sesión

```javascript
const DURACIONES_MINIMAS = {
  base: {
    'Correr-Z2':           { min: 45, max: 70  },
    'Correr-Largo':        { min: 70, max: 110 },
    'Correr-Intervalos':   { min: 55, max: 70  },
    'Bici-Z2':             { min: 75, max: 120 },
    'Bici-Intervalos':     { min: 60, max: 80  },
    'Nadar':               { min: 45, max: 65  },
    'Fuerza':              { min: 50, max: 65  },
  },
  build: {
    'Correr-Z2':           { min: 55, max: 80  },
    'Correr-Largo':        { min: 85, max: 130 },
    'Correr-Intervalos':   { min: 65, max: 80  },
    'Bici-Z2':             { min: 90, max: 150 },
    'Bici-Intervalos':     { min: 70, max: 90  },
    'Nadar':               { min: 55, max: 75  },
    'Fuerza':              { min: 55, max: 70  },
    'Brick':               { min: 90, max: 130 },
  },
  peak: {
    'Correr-Z2':           { min: 60, max: 80  },
    'Correr-Largo':        { min: 90, max: 140 },
    'Correr-Intervalos':   { min: 70, max: 85  },
    'Bici-Z2':             { min: 100, max: 160 },
    'Brick':               { min: 100, max: 150 },
  },
  taper: {
    'Correr-Z2':           { min: 35, max: 50  },
    'Correr-Largo':        { min: 50, max: 70  },
    'Bici-Z2':             { min: 50, max: 75  },
  },
}
```

### Campos que guarda el plan generado

```javascript
{
  user_id: userId,
  semana: weekStart,
  sesiones: sesionesConEstructura,
  cycle_id: activeCycle.id,
  numero_semana: numSemana,
  fase: faseActual.nombre,
  objetivo_semana: objetivoSemana,
  volumen_planificado_min: totalMinutosPlan,
  volumen_real_min: 0,
}
```

---

## Actualización de `buildSystemPrompt.js`

Nueva sección inyectada en el system prompt del coach:

```javascript
const macrocicloSection = cycle ? `
MACROCICLO DEL ATLETA:
- Ciclo: ${cycle.semanas_totales} semanas totales
- Posición actual: Semana ${numeroSemana} de ${cycle.semanas_totales}
- Fase: ${faseActual.nombre.toUpperCase()} — ${objetivoFase[faseActual.nombre]}
- ${esSemanaDescarga ? 'ES SEMANA DE DESCARGA: reducir carga 15-20%, sin intensidades altas' : 'Semana de carga normal'}
- Semanas hasta la carrera: ${semanasRestantes}
${semanasRestantes <= 2 ? '⚠️ MODO TAPER: prioriza frescura. El trabajo ya está hecho.' : ''}

PROGRESIÓN RECIENTE:
- Adherencia últimas 4 semanas: ${adherencia}% (${sesionesCompletadas} de ${sesionesTotal} sesiones)
- RPE medio último mes: ${rpeMedio}/10
- Volumen semana anterior: ${volumenAnterior}min
- Tendencia: ${tendencia}  (↑ mejorando / → estable / ↓ bajando)

DATOS DE RENDIMIENTO:
${fcMaxima ? `- FC máxima: ${fcMaxima}bpm → Z2: ${Math.round(fcMaxima*0.65)}-${Math.round(fcMaxima*0.75)}bpm, Umbral: ${Math.round(fcMaxima*0.87)}-${Math.round(fcMaxima*0.92)}bpm` : ''}
${pace5k ? `- Pace 5K: ${pace5k}/km → Z2: ${sumarSegundos(pace5k, 80)}-${sumarSegundos(pace5k, 100)}/km, Umbral: ${sumarSegundos(pace5k, 30)}-${sumarSegundos(pace5k, 45)}/km` : ''}
${ftpBici ? `- FTP bici: ${ftpBici}W → Z2: ${Math.round(ftpBici*0.55)}-${Math.round(ftpBici*0.74)}W, Umbral: ${Math.round(ftpBici*0.84)}-${Math.round(ftpBici*0.97)}W` : ''}
` : ''
```

---

## Cambios en la UI

### 1. Dashboard

Añadir sobre la sesión de hoy:

```
┌─────────────────────────────────────────────────────┐
│  Semana 6 de 20  ▓▓▓▓▓▓░░░░░░░░░░░░░░  Fase Build  │
│  16 semanas para Valencia Marathon                   │
└─────────────────────────────────────────────────────┘
```

Sesión de hoy: expandible con 3 bloques (calentamiento / principal / vuelta a la calma).

### 2. Plan semanal

- Cabecera de semana: "Semana 6 — BUILD · Objetivo: desarrollar umbral"
- Cada sesión: card expandible con estructura completa
- Al marcar como completado: modal con campos opcionales (tiempo real, RPE, notas)
- Chips de zona (Z2, Z4) visibles en la card

### 3. Pantalla Progreso (nueva sección al inicio)

```
MACROCICLO ──────────────────────────────────────────────
[BASE 8sem ████████][BUILD 6sem ██░░░░][PEAK 4sem][TAPER]
                         ↑ estás aquí (sem 6)

Métricas actuales (igual que ahora):
- Días para el objetivo
- Consistencia
- Adherencia
- Volumen vs semana anterior
- Actividades (Strava cuando esté disponible)
```

### 4. Modal "Completar sesión"

Reemplaza el check simple actual:

```
✓ Sesión completada

Tiempo real:  [____] min   (opcional)
Distancia:    [____] km    (opcional)
FC media:     [____] bpm   (opcional)
RPE: ○1 ○2 ○3 ○4 ○5 ○6 ○7 ○8 ○9 ○10
Notas: [________________________]

[Guardar]
```

Al guardar: actualizar `completada`, `tiempo_real_min`, `fc_media_real`, `rpe_usuario`, `notas_usuario` en la sesión. Recalcular `volumen_real_min` del plan.

---

## Plan de implementación (orden de bloques)

### Bloque 1 — Base de datos y migración (sin UI) ~1 día

1. `supabase/migrations/001_training_cycles.sql` — crear tabla `training_cycles`
2. `supabase/migrations/002_plans_extensions.sql` — nuevas columnas en `plans`
3. `supabase/migrations/003_profiles_performance.sql` — nuevas columnas en `profiles`
4. `netlify/functions/create-cycle.js` — nueva función
5. `src/lib/cycles.js` — `createCycle()`, `getActiveCycle()`, `getFaseActual()`
6. `App.jsx` — llamar a `createCycle` si `active_cycle_id` es null al cargar

**Validación:** Todo usuario que cargue la app tiene un ciclo activo en Supabase.

### Bloque 2 — Sesiones con estructura real ~1-2 días

1. Reescribir `generate-plan.js`:
   - Nuevo prompt con estructura calentamiento/principal/vuelta a calma
   - Duraciones realistas según fase
   - Guardar `cycle_id`, `numero_semana`, `fase`, `objetivo_semana`, `volumen_planificado_min`
2. Actualizar `adjust-plan.js` para conservar estructura al ajustar
3. UI: `WeeklyPlan.jsx` — cards expandibles con 3 bloques de sesión
4. UI: `ModalCompletarSesion.jsx` — nuevo componente (reemplaza check simple)
5. Tests: actualizar `weeklyPlan.test.js` y `netlify-functions.test.js`

**Validación:** Generar plan nuevo muestra sesiones con estructura completa y duraciones correctas.

### Bloque 3 — Coach con contexto completo ~1 día

1. Actualizar `buildSystemPrompt.js`:
   - Calcular adherencia últimas 4 semanas
   - Calcular RPE medio y tendencia
   - Inyectar sección macrociclo
   - Calcular zonas desde FC max / paces del perfil
2. Actualizar `claude.js` — pasar `cycle` y métricas al buildSystemPrompt
3. Tests: actualizar `systemPrompt.test.js`

**Validación:** El coach responde correctamente a "¿en qué fase estoy?" y "¿cuánto me queda?".

### Bloque 4 — UI Progreso y Dashboard ~1-2 días

1. `Progreso.jsx` — añadir timeline del macrociclo en la cabecera
2. `Dashboard.jsx` — añadir barra "Semana X de Y — Fase"
3. Ajustes visuales menores en `WeeklyPlan.jsx` (objetivo de la semana visible)

**Validación:** El atleta puede ver de un vistazo en qué fase está y cuántas semanas le quedan.

### Bloque 5 — Strava (cuando se apruebe la API)

No bloquea nada. Cuando se apruebe:
- Conectar sincronización con los nuevos campos (`fc_media_real`, `distancia_real_km`)
- El coach ya usa esos campos — la integración es transparente

---

## Tests a añadir

```
cycles.test.js         — calcularFases(), getFaseActual(), esSemanaDescarga()
create-cycle.test.js   — crear ciclo desde perfil con y sin carrera
weeklyPlan.test.js     — nueva estructura de sesiones
systemPrompt.test.js   — sección macrociclo en el prompt
```

---

## Lo que NO cambia

- Stack: React + Vite, Supabase, Netlify Functions, CommonJS
- Auth: Google OAuth con Supabase
- Diseño: design system actual (dark theme, tokens CSS)
- Monetización: Stripe, Free vs Pro
- Onboarding: 8 pasos actuales (solo se añade paso opcional de datos de rendimiento)
- 48 tests existentes — todos deben seguir pasando

---

## Glosario

| Término | Definición |
|---------|-----------|
| Macrociclo | Plan completo desde hoy hasta la carrera (o 16 semanas sin carrera) |
| Fase | Período del macrociclo (Base, Build, Peak, Taper) con objetivos distintos |
| Microciclo | Semana de entrenamiento |
| Semana de descarga | Cada 4ª semana: volumen -15-20%, sin intensidades altas |
| Estructura de sesión | Calentamiento + Bloque principal + Vuelta a la calma |
| Adherencia | % de sesiones completadas vs planificadas en un período |
| Volumen | Total de minutos de entrenamiento en una semana |
| RPE | Escala 1-10 de esfuerzo percibido |
| Z1-Z5 | Zonas de frecuencia cardíaca / vatios / ritmo |

---

## Casos de borde — comportamiento definido

| Caso | Comportamiento |
|------|---------------|
| Usuario cambia fecha de carrera | Recalcular ciclo activo desde la semana actual. Mantener historial de planes anteriores. |
| Usuario borra su carrera objetivo | Convertir a ciclo genérico de 16 semanas desde hoy. |
| Ciclo genérico de 16 semanas completado | Mostrar mensaje "Tu ciclo ha terminado — ¿empezamos otro?" y crear nuevo ciclo al confirmar. |
| Usuario añade carrera nueva a mitad de ciclo | Si la nueva carrera es antes que la actual fin de ciclo → preguntar si quiere recalcular. Si es después → ignorar hasta que el ciclo actual termine. |
| Semana de diagnóstico | Es la semana 1 del ciclo, fase BASE. numero_semana = 1. |
| Usuario sin carrera desde onboarding | Ciclo genérico 16 semanas, sin fecha_carrera en training_cycles. |
| Dos usuarios con mismo email (no debería pasar) | La constraint de Supabase en profiles lo previene. |

## Sistema de prioridad de carreras A/B/C — PENDIENTE

Implementar en sprint posterior al lanzamiento inicial.

Concepto:
- Carrera A: objetivo principal. Taper completo (2 semanas). El macrociclo apunta aquí.
- Carrera B: secundaria. Mini-taper 4-5 días. Vuelta al entrenamiento normal después.
- Carrera C: entrenamiento con dorsal. Sin taper. Sesión de calidad intensa.

Campo a añadir: `prioridad: 'A' | 'B' | 'C'` en cada objeto del array `profile.carreras`.
El selector de prioridad se añade en el paso 4 del onboarding y en editar perfil.
El macrociclo se construye sobre la carrera A. El generate-plan detecta B/C en las semanas próximas y ajusta.
