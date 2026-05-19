# TriCoach AI — Contexto del proyecto

> Última actualización: 19 mayo 2026

## Qué es esto
Entrenador IA conversacional para triatletas, runners y atletas de Hyrox hispanohablantes.
App web React + Vite, backend Netlify Functions, base de datos Supabase.
Freemium: Free (25 msg/día, plan básico) / Pro (9,99€/mes, Strava + plan adaptativo + macrociclos).

## Stack
- Frontend: React + Vite (JavaScript, NO TypeScript)
- Auth + DB: Supabase (URL: https://luqpjgzpydquqturgjmt.supabase.co) — RLS activado
- Backend: Netlify Functions (CommonJS — require/exports.handler, NUNCA import/export)
- Tests: Vitest — **155 tests pasando** (20 archivos) + Playwright E2E (3 specs)
- Deploy: Netlify (producción: https://tricoach-v2.netlify.app)
- Pagos: Stripe (checkout + webhooks)
- Email: Resend (coach@getricoach.com)

## Reglas críticas — leer siempre antes de tocar código

### Netlify Functions
- CommonJS SIEMPRE: `const x = require('x')` y `exports.handler = async (event) => {}`
- NO usar @supabase/supabase-js — usar REST API con https nativo
- Validar siempre el header `x-tricoach-secret` contra `process.env.TRICOACH_SECRET` — **TODAS las funciones sin excepción**
- Validar UUID antes de usar en queries: `const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — añadido en todas las funciones que reciben userId/planId
- El modelo de Claude está fijo: `CLAUDE_MODEL = 'claude-sonnet-4-20250514'` en claude.js — nunca viene del frontend
- No usar console.log en producción — solo console.error para errores reales

Template mínimo para nueva función:
```javascript
const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  const secret = event.headers['x-tricoach-secret'];
  if (!FUNCTION_SECRET || secret !== FUNCTION_SECRET) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) }; }
  const { userId } = parsed;
  if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  if (!UUID_REGEX.test(userId)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  // ...
};
```

### Rate limiting (claude.js)
El límite de mensajes usa una RPC atómica de Postgres para evitar race conditions:
```
POST /rest/v1/rpc/increment_messages_today
{ p_user_id, p_limit, p_today }
→ retorna nuevo contador, o -1 si límite alcanzado
```
**Función SQL requerida en Supabase** (ejecutar una vez en SQL Editor):
```sql
CREATE OR REPLACE FUNCTION increment_messages_today(p_user_id uuid, p_limit int, p_today text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_count int;
BEGIN
  UPDATE profiles
  SET messages_today = CASE WHEN last_message_date::text = p_today THEN messages_today + 1 ELSE 1 END,
      last_message_date = p_today::date
  WHERE id = p_user_id AND (last_message_date::text != p_today OR messages_today < p_limit)
  RETURNING messages_today INTO new_count;
  RETURN COALESCE(new_count, -1);
END; $$;
GRANT EXECUTE ON FUNCTION increment_messages_today TO service_role;
```

### Soft delete (delete-account.js)
`delete-account.js` NO borra el registro de `profiles` — hace `PATCH {deleted_at: now()}`.
En `App.jsx`, `loadOrCreateProfile()` detecta `profile?.deleted_at` y hace `signOut()` mostrando pantalla de cuenta eliminada.
**Migración requerida** (ejecutar una vez):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

### Frontend
- Sistema de diseño: variables CSS en src/index.css (--background, --primary, --card, etc.)
- Fuentes: **Barlow Condensed** (títulos h1/h2, weight 900) + **Barlow** (texto, --font-sans) — Google Fonts
- Sin librerías de UI externas (no shadcn, no lucide-react, no Material UI)
- **Solo SVG inline para iconos — nunca emojis como iconos en la UI**. SVGs con `fill="none"`, `stroke`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`
- `buildSystemPrompt.js`: campos de texto libre truncados (contexto → 500 chars, objetivo → 200, nombre → 50, preferencias/intolerancias → 200)
- `buildSystemPrompt.js`: incluye sección **REGLAS DE CONTEXTO — OBLIGATORIAS** al final — el coach nunca pregunta info que ya tiene (plan, deporte, nivel, carrera). No eliminar.

### Tests
- Ejecutar `npm test` al terminar SIEMPRE
- **155 tests deben pasar** — si alguno falla, arreglarlo antes de terminar
- No borrar ni modificar tests existentes sin motivo explícito

## Estado del proyecto — Fases completadas

### Fase 7 — Mejoras visuales (abril 2026) ✅
- Tipografía Barlow + Barlow Condensed (antes: Source Sans 3)
- WeeklyPlan: cards con opacidad en días pasados, tags de zona/intensidad con colores semánticos, bloques de estructura con borde izquierdo
- Chat: burbujas del coach con fondo #1C1C1E y borde naranja, avatar con glow
- EditProfile: campos con border #2a2a2a, labels uppercase, personalidad como grupo de botones
- Dashboard: capitalización correcta de fecha, botón Strava como pill, título sesión en blanco fijo

### Fase 8 — Ajuste automático del plan (abril 2026) ✅
- `src/lib/autoAdjust.js`: `checkShouldAdjust(plan, profile)` — detecta RPE medio ≥ 8, volumen Strava > 120%, y 2+ sesiones perdidas consecutivas
- `src/components/AdjustmentBanner.jsx`: banner naranja con mensaje del coach tras ajuste automático
- `netlify/functions/adjust-plan.js`: acepta `signal` además de `motivo`; añade `getMensajeAjuste()` al response
- `src/lib/plans.js`: `autoAdjustPlan(userId, planId, signal)` — función helper
- `WeeklyPlan.jsx`: `onComplete` del modal llama a `checkShouldAdjust` y dispara ajuste si hay señal; muestra AdjustmentBanner
- `Dashboard.jsx`: tras Strava sync, evalúa señales y ajusta automáticamente
- **Importante**: el flujo real de completar sesión pasa por `ModalCompletarSesion` → `onComplete()`, no por `handleCompletar()` de Dashboard

### Auditoría técnica (abril 2026) ✅
1. **Rate limiting atómico**: RPC Postgres en lugar de GET+PATCH (race condition eliminado)
2. **Soft delete**: `delete-account.js` usa PATCH en lugar de DELETE en profiles; `App.jsx` bloquea cuentas con `deleted_at` set
3. **UUID validation**: `UUID_REGEX` en 12 funciones (adjust-plan, claude, coach-intro, create-checkout, create-cycle, delete-account, generate-plan, intervals, recalculate-cycle, strava-activities, strava-match-activity, strava-sync)
4. **Truncado de campos libres** en `buildSystemPrompt.js`
5. **Bug consistencia 0%**: `Progress.jsx` usa `getHistorialPlanes` (semanas pasadas) en lugar de `getRecentPlans` (incluía semana actual incompleta); `calcularConsistencia` acepta `completada` como boolean/number/string
6. **Sticky header**: `handleNavigate` en App.jsx resetea `.screen-enter` scrollTop además de `window.scrollTo(0,0)`

### Fase 10 — Macrociclos e infraestructura avanzada (abril–mayo 2026) ✅
- Tabla `training_cycles` en Supabase, migración aplicada en producción
- `src/lib/cycles.js` — calcularFases, getFaseActual, esSemanaDescarga, esCicloCompletado
- `create-cycle.js` — idempotente, con y sin carrera objetivo
- `App.jsx` — crea/carga ciclo activo al arrancar, pasa `activeCycle` a Dashboard/Chat/Progreso
- Dashboard: barra "Semana X de Y · FASE BASE" con barra de progreso
- Progreso: timeline horizontal BASE → BUILD → PEAK → TAPER con indicador actual
- WeeklyPlan: cabecera con objetivo de la semana

### Fase 10.5 — Sesiones con estructura real (mayo 2026) ✅
- `generate-plan.js` — nuevo schema (calentamiento, principal, vuelta a la calma, zona_objetivo, rpe_objetivo)
- `generate-plan.js` — guarda cycle_id, numero_semana, fase, objetivo_semana, volumen_planificado_min
- `adjust-plan.js` — migra sesiones antiguas al nuevo formato antes de ajustar
- `WeeklyPlan.jsx` — cards expandibles con 3 bloques de estructura
- `ModalCompletarSesion.jsx` — RPE visual, tiempo real, distancia, FC, notas
- `validarDuracion(sesion, fase)` — duraciones mínimas por deporte y fase

### Fase 10.8 — Multi-deporte y sistema A/B/C de carreras (mayo 2026) ✅
- Campo `prioridad: 'A' | 'B' | 'C'` en array `carreras` del perfil
- `create-cycle.js` selecciona carrera A como objetivo del ciclo
- `generate-plan.js` detecta carrera B/C en <14 días → mini-taper / sesión de calidad
- `recalculate-cycle.js` — recalcula fases desde semana actual al cambiar carrera
- Diagnóstico multi-deporte, refresh token Strava en generate-plan, fallback deporteInfo
- Bugs de fechas UTC vs local corregidos (getMondayOfCurrentWeek UTC+2, getPlanActual fecha local)

### Fase 11.1 — Feedback automático post-entreno (mayo 2026) ✅
- `strava-feedback.js` — cuando se sincroniza actividad Strava, el coach genera feedback automático
- Análisis sesión vs plan, tono conversacional, solo Pro, fire-and-forget desde strava-sync.js

### Fase 11.2 — Informe semanal automático por email (mayo 2026) ✅
- `weekly-report.js` — domingos 19h UTC: informe con adherencia y resumen semanal
- `thursday-reminder.js` — jueves 17h UTC: recordatorio a usuarios sin plan próxima semana
- Pro: informe completo tabla sesión a sesión + mensaje del coach
- Free: resumen con % adherencia + bloque upsell a Pro

### Correcciones calidad IA y API (mayo 2026) ✅
- `claude.js`: filtra mensajes antes de enviar a Anthropic — elimina content null/undefined/vacío, roles inválidos, y mensajes assistant al inicio del array. Devuelve 400 si no quedan mensajes válidos tras filtrar.
- `Chat.jsx`: guards en `saveMessage()` — no guarda si content es falsy
- `buildSystemPrompt.js`: sección **REGLAS DE CONTEXTO — OBLIGATORIAS** al final del prompt — el coach nunca pregunta info que ya tiene (plan de la semana, deporte, nivel, objetivo, fechas de carrera)

### Rediseño visual Dashboard + BottomNav (mayo 2026) ✅
- `Dashboard.jsx` — Hero card: barra izquierda 3px sportColor, badge deporte (SVG + nombre), título 22px serif, metadata "Duración" 28px + chip intensidad, ilustración fantasma SVG 120px opacity 0.06
- `Dashboard.jsx` — Tracker semanal: dots 32px, check SVG en completados, inner dot + glow en día actual, borde dashed en descansos, barra progreso 3px
- `Dashboard.jsx` — Card volumen semanal: mini gráfico barras SVG con 4 semanas placeholder + semana actual
- `Dashboard.jsx` — Acciones rápidas: iconos en círculo 40×40 con fondo coloreado, sliders SVG para Ajustar
- `Dashboard.jsx` — `SportIcon` interno: paths simplificados de una sola `<path>`, prop `opacity` para ilustración fantasma
- `BottomNav.jsx` — Colores activo/inactivo: `var(--primary)` / `var(--muted-foreground)` (antes hex hardcoded)

## Estructura de archivos completa

```
tricoach-v2/
├── CLAUDE.md
├── SPEC.md                    — arquitectura macrociclos (leer antes de tocar training_cycles)
├── DESIGN.md                  — sistema de diseño de referencia
├── ESTADO_PROYECTO.md         — estado detallado, pendientes y próximos sprints
├── tricoach_plan.md           — plan de producto v11.2
├── tasks/
│   ├── lessons.md             — lecciones aprendidas (leer siempre antes de empezar)
│   └── PROMPTS_CLAUDE_CODE.md
├── scripts/
│   └── generate-icons.js
├── supabase/
│   └── migrations/
│       └── 001_training_cycles.sql
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Chat.jsx                  — chat con coach IA, rate limiting frontend
│   │   ├── Dashboard.jsx             — pantalla "Hoy": sesión del día, Strava sync, auto-adjust
│   │   ├── WeeklyPlan.jsx            — plan semanal, modal completar, botones ajuste
│   │   ├── Progress.jsx              — estadísticas, consistencia (historialPlanes), gráfico semana
│   │   ├── EditProfile.jsx           — editar perfil, sección "Mis carreras", datos rendimiento
│   │   ├── BottomNav.jsx
│   │   ├── UpgradeModal.jsx
│   │   ├── CookieBanner.jsx
│   │   ├── ModalCompletarSesion.jsx  — modal RPE + tiempo real + distancia + FC + notas; integra Strava
│   │   ├── AdjustmentBanner.jsx      — banner naranja tras ajuste automático (Fase 8)
│   │   ├── CicloCompletadoBanner.jsx — banner cuando macrociclo termina
│   │   ├── SessionDetail.jsx
│   │   ├── StravaConnect.jsx
│   │   ├── ErrorBoundary.jsx
│   │   └── WelcomeGuide.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── profiles.js        — getProfile, updateProfile, canSendMessage, incrementMessageCount
│   │   ├── messages.js
│   │   ├── context.js
│   │   ├── plans.js           — getPlan, generatePlan, markSessionComplete, adjustPlan,
│   │   │                        autoAdjustPlan, getHistorialPlanes, calcularConsistencia, analizarPlan
│   │   ├── autoAdjust.js      — checkShouldAdjust(plan, profile) — función pura, sin efectos
│   │   └── cycles.js          — calcularFases, getFaseActual, esSemanaDescarga, esCicloCompletado
│   ├── pages/
│   │   ├── Privacidad.jsx     — página política de privacidad
│   │   └── Terminos.jsx       — página términos de servicio
│   ├── prompts/
│   │   └── buildSystemPrompt.js
│   ├── test/
│   │   ├── setup.js
│   │   ├── supabase.test.js           (2 tests)
│   │   ├── netlify-functions.test.js  (5 tests)
│   │   ├── profiles.test.js           (2 tests)
│   │   ├── limits.test.js             (4 tests)
│   │   ├── auth.test.jsx              (2 tests)
│   │   ├── onboarding.test.jsx        (3 tests)
│   │   ├── weeklyPlan.test.jsx        (5 tests)
│   │   ├── systemPrompt.test.js       (32 tests)
│   │   ├── strava-activities.test.js  (4 tests)
│   │   ├── strava-match-activity.test.js (6 tests)
│   │   ├── cycles.test.js             (30 tests)
│   │   ├── recalculate-cycle.test.js  (4 tests)
│   │   ├── ciclo-completado.test.js   (3 tests)
│   │   ├── race-priority.test.js      (7 tests) — sistema A/B/C de carreras
│   │   ├── autoRegenPlan.test.js      (8 tests)
│   │   ├── autoAdjust.test.js         (11 tests) — checkShouldAdjust
│   │   ├── chat.test.js               (14 tests) — Chat.jsx + claude.js
│   │   ├── phase8.test.jsx            (4 tests)
│   │   ├── phase10.test.jsx           (4 tests)
│   │   ├── phase105.test.jsx          (5 tests)
│   │   └── e2e/
│   │       ├── auth.spec.js
│   │       ├── audit.spec.js
│   │       └── coach-calendar-sync.spec.js
│   ├── index.css
│   ├── App.jsx
│   └── main.jsx
├── netlify/
│   └── functions/
│       ├── claude.js                — chat Claude, rate limiting atómico (RPC)
│       ├── adjust-plan.js           — ajusta plan (lesión/viaje/sobrecarga/sesiones_perdidas + signal)
│       ├── generate-plan.js         — genera plan semanal con estructura real y contexto macrociclo
│       ├── create-cycle.js          — crea macrociclo de entrenamiento (idempotente)
│       ├── recalculate-cycle.js     — recalcula fases del ciclo tras cambio de carrera
│       ├── coach-intro.js           — mensaje de bienvenida del coach
│       ├── strava-auth.js           — OAuth Strava
│       ├── strava-activities.js     — actividades Strava + refresh token
│       ├── strava-sync.js           — sincronización automática sesiones Strava → plan
│       ├── strava-match-activity.js — match actividad Strava con sesión del plan
│       ├── strava-feedback.js       — feedback automático post-entreno (Pro, fire-and-forget)
│       ├── intervals.js             — integración Intervals.icu (GET/POST/DELETE)
│       ├── weekly-report.js         — informe semanal [SCHEDULED: domingos 19h UTC]
│       ├── thursday-reminder.js     — recordatorio semanal [SCHEDULED: jueves 17h UTC]
│       ├── create-checkout.js       — Stripe Checkout Session
│       ├── stripe-webhook.js        — webhook Stripe (activar/revocar Pro)
│       └── delete-account.js        — soft delete: PATCH profiles SET deleted_at, borra messages/plans
├── index.html
├── netlify.toml
├── vite.config.js
└── package.json
```

## Schema Supabase

> RLS activado en todas las tablas. Service key solo en Netlify Functions.

### tabla `profiles`
```
id (uuid pk), email, nombre, deporte, nivel, objetivo,
fecha_carrera, plan ('free'|'pro'),
created_at, messages_today, last_message_date,
personalidad ('cercano'|'estricto'|'gracioso'|'motivador'|'cientifico'),
contexto, nombre_coach,
strava_token, strava_refresh_token, strava_token_expires_at,
stripe_customer_id, stripe_subscription_id,
intervals_athlete_id, intervals_api_key,
active_cycle_id (uuid fk → training_cycles),
fc_maxima, pace_5k, ftp_bici, peso, edad,
deportes (jsonb — array multi-deporte),
carreras (jsonb — array de carreras objetivo),
objetivo_nutricional, preferencias_alimentarias, intolerancias,
deleted_at (timestamptz — soft delete, requiere migración si no existe)
```

### tabla `plans`
```
id (uuid pk), user_id (uuid fk), semana (date — lunes),
sesiones (jsonb — array 7 objetos), created_at,
volumen_planificado_min (int), volumen_real_min (int)
```

Estructura de una sesión en `sesiones`:
```json
{
  "dia": "Lunes",
  "tipo": "Correr|Bici|Nadar|Fuerza|Brick|Descanso",
  "subtipo": "Rodaje Z2",
  "descripcion": "string",
  "duracion_min": 45,
  "intensidad": "suave|moderada|fuerte|descanso",
  "distancia_km": 6,
  "zona_objetivo": "Z1-Z2|Z2-Z3|Z3-Z4|Z4-Z5",
  "estructura": {
    "calentamiento": "string",
    "principal": "string",
    "vuelta_calma": "string",
    "rpe_objetivo": "5-6"
  },
  "completada": false,
  "rpe": null,
  "rpe_usuario": null,
  "tiempo_real_min": null,
  "distancia_real_km": null,
  "fc_media_real": null,
  "notas_usuario": null,
  "via_strava": false
}
```

### tabla `messages`
```
id (uuid pk), user_id (uuid fk), role, content, created_at
```

### tabla `training_cycles`
```
id (uuid pk), user_id (uuid fk),
semanas_totales (int), fecha_inicio (date),
fases (jsonb — array de { nombre, sem_inicio, sem_fin, objetivo }),
carrera_nombre (text), estado ('active'|'completed'),
created_at
```

## Variables de entorno

Frontend (VITE_*):
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- VITE_TRICOACH_SECRET
- VITE_STRAVA_CLIENT_ID, VITE_STRAVA_REDIRECT_URI
- VITE_STRIPE_PUBLISHABLE_KEY

Backend (solo en Netlify Functions):
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY
- TRICOACH_SECRET
- STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL
- RESEND_API_KEY

## Diferenciación Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Mensajes/día | 25 | 150 |
| Plan semanal | Básico | Con datos Strava |
| Macrociclo | Sí (genérico) | Sí (con carrera) |
| Ajuste automático | Sí | Sí |
| Strava sync | No | Sí |
| Intervals.icu | No | Sí |

Validación Free/Pro siempre en **backend** (claude.js) — nunca confiar solo en el frontend.

## Flujos críticos

### Completar sesión
⚠️ **Trampa frecuente**: hay DOS funciones de completar sesión con nombres similares:

| Función | Archivo | Cuándo se usa |
|---|---|---|
| `patchSesionCompleta(planId, dia, campos)` | `ModalCompletarSesion.jsx` (local, Supabase directo) | Flujo principal — WeeklyPlan |
| `markSessionComplete(planId, dia, rpe)` | `src/lib/plans.js` | Picker inline de Dashboard (flujo secundario) |

El flujo real es: botón "Completar" → `ModalCompletarSesion` → `guardar()` → `patchSesionCompleta()` → `onComplete(updatedPlan)` en `WeeklyPlan`.
El `handleCompletar()` de Dashboard solo se usa para el picker inline de RPE en la pantalla de hoy.
Ambos flujos llaman a `checkShouldAdjust` tras guardar y disparan `autoAdjustPlan` si hay señal.

Si añades lógica post-completar (auto-adjust, notificaciones, etc.) debes hacerlo en **ambos** sitios o solo en `onComplete` de WeeklyPlan y `handleCompletar` de Dashboard.

### Auto-ajuste del plan
Señales detectadas por `checkShouldAdjust(plan, profile)`:
1. RPE medio ≥ 8 en las últimas 3 sesiones completadas → `signal: 'sobrecarga'`
2. Volumen Strava > 120% del planificado (últimas 3 sesiones) → `signal: 'sobrecarga'`
3. 2+ sesiones perdidas consecutivas en días pasados → `signal: 'sesiones_perdidas'`

### Consistencia en Progress
`calcularConsistencia` recibe solo `getHistorialPlanes` (semanas pasadas, no la actual en curso).
El `GraficoSemana` usa el prop `plan` de la semana actual pasado directamente desde App.jsx.

### `getRecentPlans` vs `getHistorialPlanes`
| Función | Incluye | Usar para |
|---|---|---|
| `getRecentPlans(userId, n)` | Semana actual + pasadas | Mostrar historial completo |
| `getHistorialPlanes(userId, n)` | Solo semanas pasadas (cutoff: 6 días atrás) | Stats de consistencia/adherencia |

El cutoff de `getHistorialPlanes` es **6 días** (no 7) para cubrir el caso de que hoy sea domingo — la semana empezó el lunes y llevan 6 días completos.

### Fechas de sesiones — patrón `DIA_OFFSET_MAP`
`plan.semana` es siempre el **lunes de la semana en ISO date** (ej: `"2026-04-28"`).
Para calcular la fecha real de cada sesión:
```javascript
const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }
const base = new Date(plan.semana + 'T12:00:00') // T12 evita problemas de zona horaria
base.setDate(base.getDate() + (DIA_OFFSET_MAP[sesion.dia] ?? 0))
const fechaStr = base.toISOString().split('T')[0]
```
Este patrón se usa en `WeeklyPlan.jsx`, `autoAdjust.js` y donde se necesite comparar sesiones con la fecha actual.

## Tests — 155 pasando (20 archivos) + 3 specs E2E Playwright

Tests más pesados (referencia rápida):
- `systemPrompt.test.js` — buildSystemPrompt (32 tests)
- `cycles.test.js` — macrociclos (30 tests)
- `chat.test.js` — Chat.jsx + claude.js integration (14 tests)
- `autoAdjust.test.js` — checkShouldAdjust (11 tests)
- `autoRegenPlan.test.js` — auto-regeneración plan (8 tests)
- `race-priority.test.js` — sistema A/B/C carreras (7 tests)
- `strava-match-activity.test.js` (6 tests)
- `netlify-functions.test.js` (5 tests)
- `phase105.test.jsx` (5 tests)
- `recalculate-cycle.test.js` (4 tests), `limits.test.js` (4 tests)

## Workflow
1. `netlify dev` para desarrollo local → http://localhost:8888
2. Claude Code implementa → `npm test && npm run build`
3. `git add ... && git commit -m "..." && git push origin main`
4. Netlify despliega automáticamente

## Eficiencia
- Ejecuta directamente sin preámbulos ni explicaciones de lo que vas a hacer
- Al terminar: resumen breve de cambios realizados
- `npm test && npm run build` siempre al final en un solo comando
- No leas archivos que no sean necesarios para la tarea
- No hagas búsquedas globales si sabes el archivo exacto
- No confirmes con el usuario durante la ejecución — completa todo el prompt de una vez

## Git
- Después de cada commit: `git push origin main` inmediatamente
- Nunca dar una tarea por terminada sin confirmar que el push se ha ejecutado
- Formato de commit: `tipo: descripción breve` (feat, fix, refactor, docs, test, chore)

## Bugs conocidos
- El auto-ajuste no dispara en WeeklyPlan cuando se completa desde el histórico de semanas pasadas — comportamiento esperado (no tiene sentido ajustar semanas ya cerradas)

## Skills — invocar automáticamente cuando aplique

| Situación | Skill |
|-----------|-------|
| Tocando `netlify/functions/` | `/netlify-functions-commonjs` — plantilla CommonJS, CORS, withTimeout, x-tricoach-secret |
| Bug difícil de entender | `/systematic-debugging` |
| A punto de decir "listo" | `/verification-before-completion` |
| Feature en múltiples archivos | `/dispatching-parallel-agents` |
| Código que usa `anthropic` SDK | `/claude-api` — prompt caching, token tracking |
| Copy de landing o marketing | `/storybrand-messaging` |
