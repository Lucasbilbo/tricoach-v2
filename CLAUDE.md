# TriCoach AI — Contexto del proyecto

> Última actualización: 9 junio 2026
> Última auditoría: junio 2026

## Qué es esto
Entrenador IA conversacional para triatletas, runners y atletas de Hyrox hispanohablantes.
App web React + Vite, backend Netlify Functions, base de datos Supabase.
Freemium: Free (10 msg/día, plan básico) / Pro (9,99€/mes, Strava + plan adaptativo + macrociclos).

## Stack
- Frontend: React + Vite (JavaScript, NO TypeScript)
- Auth + DB: Supabase (URL: https://luqpjgzpydquqturgjmt.supabase.co) — RLS activado
- Backend: Netlify Functions (CommonJS — require/exports.handler, NUNCA import/export)
- Tests: Vitest — **201 tests pasando** (27 archivos) + Playwright E2E (3 specs)
- Deploy: Netlify (producción: https://tricoach-v2.netlify.app)
- Pagos: Stripe (checkout + webhooks)
- Email: Resend (coach@getricoach.com)

## Reglas críticas — leer siempre antes de tocar código

### Netlify Functions
- CommonJS SIEMPRE: `const x = require('x')` y `exports.handler = async (event) => {}`
- NO usar @supabase/supabase-js — usar REST API con https nativo
- Validar siempre el header `x-tricoach-secret` contra `process.env.TRICOACH_SECRET` — **TODAS las funciones sin excepción**
- Validar UUID antes de usar en queries: `const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — añadido en todas las funciones que reciben userId/planId
- El modelo de Claude está fijo: `CLAUDE_MODEL = 'claude-sonnet-4-20250514'` — nunca viene del frontend. Sigue siendo el estándar del proyecto. Inventario de archivos donde está hardcodeado (auditoría junio 2026, útil para una migración futura):
  - `netlify/functions/claude.js:6`
  - `netlify/functions/generate-plan.js:10`
  - `netlify/functions/adjust-plan.js:10`
  - `netlify/functions/coach-intro.js:11`
  - `netlify/functions/strava-feedback.js:11`
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

### Código compartido frontend ↔ functions — patrón espejo + paridad
`src/lib` es ESM (Vite) y `netlify/functions` es CommonJS (zisi) — **no pueden importar el mismo archivo**. La lógica compartida vive duplicada deliberadamente con un test de paridad que rompe si divergen:

| Lógica | Canónico (ESM) | Espejo (CJS) | Test de paridad |
|---|---|---|---|
| Umbrales wellness ATL/TSB/HRV | `src/lib/wellness.js` | `netlify/functions/lib/wellness.js` | `wellness.test.js` |
| Volumen real (`calcularVolumenReal`) | `src/lib/volumen.js` | `netlify/functions/lib/volumen.js` | `volumen.test.js` |
| Idempotencia generate-plan | — | `netlify/functions/lib/planes.js` | `planes-idempotencia.test.js` |

Reglas: si tocas un lado, toca el otro (el test de paridad te lo recordará). `netlify/functions/lib/` NO se despliega como functions (no crear `lib.js` ni `index.js` ahí). Las functions lo requieren con ruta relativa `require('./lib/...')`.

### Idempotencia de generate-plan (junio 2026)
- Antes de generar, comprueba si ya existe plan para `(user_id, semana)`:
  - existe y sin `forzar` → devuelve el existente con `{ ya_existe: true }` **sin llamar a Claude**.
  - existe y con `forzar: true` → genera y hace PATCH sobre la fila existente (conserva el id).
- `forzar: true` se usa en: regeneración explícita del usuario (WeeklyPlan `handleGenerarPlan`) y migración de formato antiguo (App.jsx). El auto-regen del jueves y el cron auto-plans van sin forzar.
- **Migración 003 EJECUTADA** ✅ (verificado vía REST 10-jun-2026: 0 duplicados sobre 30 planes) — `UNIQUE (user_id, semana)` activo en producción.

### Generación automática semanal — auto-plans.js (Fase 1, junio 2026)
- **Cron**: lunes 03:00 UTC (`0 3 * * 1` en netlify.toml) = 04:00/05:00 Madrid — fuera de la ventana de peligro DST (domingo 22-24h UTC).
- **Flujo por usuario elegible** (Pro + `training_cycle` activo + no borrado): `syncUsuario()` de strava-sync (adherencia fresca, bloqueante) → POST interno a generate-plan con `fechaInicio` explícito (lunes Madrid de `lib/fechas.js`) y SIN `forzar` (si el plan ya existe → `ya_existe`, coste cero).
- **Camino interno de generate-plan**: header `x-internal-secret` === env `INTERNAL_API_SECRET`. Solo en ese camino y tras guardar con éxito: email Resend "Tu plan de esta semana está listo 🏃" (`lib/email.js`) y limpieza de `profiles.contexto_proxima_semana` si se consumió. Sin el header válido, generate-plan se comporta exactamente como siempre.
- **Degradación**: el orquestador envía también `x-tricoach-secret` como fallback — si `INTERNAL_API_SECRET` no existe aún en Netlify, los planes se generan igual (sin email ni limpieza de nota). Si la migración 004 no está ejecutada, el cron funciona sin notas (catch del 42703).
- **Notas del usuario**: card "Notas para la próxima semana" en WeeklyPlan (vista próxima semana) → `profiles.contexto_proxima_semana` → el cron la pasa como `contexto_semana` y se limpia tras usarla (lo temporal no sangra a semanas futuras).
- **Resumen en logs**: `[auto-plans] semana=… elegibles=N generados=X ya_existian=Y pendientes=W fallos=Z` — "pendientes" = generaciones disparadas cuya respuesta no llegó dentro del presupuesto de ~20s del orquestador (la petición ya está entregada; generate-plan termina por su cuenta).

#### Fase 1 — puesta en marcha completada ✅ (10 junio 2026)
- `INTERNAL_API_SECRET` creada en Netlify y verificada en producción (smoke: `ya_existe` en ~2s solo con `x-internal-secret`).
- Migración 004 aplicada y verificada vía REST (columna `contexto_proxima_semana` existe).
- Prueba end-to-end del orquestador ejecutada en local contra producción: `elegibles=2 ya_existian=1 pendientes=1` → plan real generado con contexto de macrociclo + email Resend entregado. Primer cron real: lunes 15 junio 03:00 UTC.

#### Cómo probar el orquestador
- **Local**: `netlify dev` en una terminal y `netlify functions:invoke auto-plans` en otra (usa el `.env` local; las invocaciones a generate-plan irán a localhost:8888).
- **Smoke inocuo en producción** (coste cero, no escribe): pedir la generación de la semana ACTUAL sin forzar para un usuario que ya tiene plan → debe responder `{ ya_existe: true }` sin llamar a Claude:
  `curl -s -X POST https://app.getricoach.com/.netlify/functions/generate-plan -H "Content-Type: application/json" -H "x-internal-secret: $INTERNAL_API_SECRET" -d '{"userId":"<tu-uuid>","fechaInicio":"<lunes-actual>"}'`

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
- **201 tests deben pasar** (27 archivos — actualizado junio 2026) — si alguno falla, arreglarlo antes de terminar
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
- Análisis sesión vs plan, tono conversacional, solo Pro, fire-and-forget desde strava-activities.js (no strava-sync — verificado junio 2026)

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
│   │   ├── StravaConnect.jsx         — 2 estados: conectado / no conectado; OAuth usa VITE_STRAVA_CLIENT_ID global; key={strava_token} fuerza remonte al conectar
│   │   ├── ErrorBoundary.jsx
│   │   └── WelcomeGuide.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── profiles.js        — getProfile, updateProfile, canSendMessage, incrementMessageCount
│   │   ├── messages.js
│   │   ├── context.js
│   │   ├── plans.js           — getPlan, generatePlan, completarSesion (función canónica), adjustPlan,
│   │   │                        autoAdjustPlan, getHistorialPlanes, calcularConsistencia, analizarPlan
│   │   ├── fechas.js          — getFechaSesion, getHoyMadrid, DIA_OFFSET_MAP (fuente única de fechas)
│   │   ├── wellness.js        — UMBRALES_WELLNESS, evaluarWellness (espejo CJS en functions/lib)
│   │   ├── volumen.js         — calcularVolumenReal (espejo CJS en functions/lib)
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
│   │   ├── completarSesion.test.js    (14 tests) — completarSesion + fechas Madrid
│   │   ├── wellness.test.js           (7 tests) — umbrales + paridad ESM↔CJS
│   │   ├── volumen.test.js            (6 tests) — criterio volumen + paridad ESM↔CJS
│   │   ├── planes-idempotencia.test.js (3 tests) — decidirAccionPlan
│   │   ├── fechas-madrid.test.js      (6 tests) — lunes Madrid verano/invierno + bordes DST
│   │   ├── auto-plans.test.js         (7 tests) — elegibles + body interno sin forzar
│   │   ├── email-plan-listo.test.js   (3 tests) — HTML del email del cron
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
│       ├── lib/                     — código compartido CJS (NO son functions): wellness.js, volumen.js, planes.js, fechas.js, email.js
│       ├── auto-plans.js            — orquestador generación automática [SCHEDULED: lunes 03:00 UTC]
│       ├── claude.js                — chat Claude, rate limiting atómico (RPC)
│       ├── adjust-plan.js           — ajusta plan (lesión/viaje/sobrecarga/sesiones_perdidas + signal)
│       ├── generate-plan.js         — genera plan semanal (estructura real, macrociclo, idempotente + forzar)
│       ├── create-cycle.js          — crea macrociclo de entrenamiento (idempotente)
│       ├── recalculate-cycle.js     — recalcula fases del ciclo tras cambio de carrera
│       ├── coach-intro.js           — mensaje de bienvenida del coach
│       ├── strava-auth.js           — OAuth Strava (usa STRAVA_CLIENT_ID/SECRET globales, no per-user)
│       ├── strava-activities.js     — actividades Strava + refresh token (credenciales globales)
│       ├── strava-sync.js           — sync Strava → plan; exporta syncUsuario() reutilizable; recalcula volumen_real_min
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
strava_client_id, strava_client_secret (migración 002 — OBSOLETAS, sin uso; per-user descartado),
stripe_customer_id, stripe_subscription_id,
intervals_athlete_id, intervals_api_key,
active_cycle_id (uuid fk → training_cycles),
fc_maxima, pace_5k, ftp_bici, peso, edad,
deportes (jsonb — array multi-deporte),
carreras (jsonb — array de carreras objetivo),
objetivo_nutricional, preferencias_alimentarias, intolerancias,
contexto_proxima_semana (text — nota semanal para el cron; migración 004 aplicada ✅),
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
- VITE_STRAVA_CLIENT_ID, VITE_STRAVA_REDIRECT_URI  ← credenciales globales TriCoach (no per-user)
- VITE_STRIPE_PUBLISHABLE_KEY

Backend (solo en Netlify Functions):
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY
- TRICOACH_SECRET
- STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI  ← credenciales globales TriCoach (no per-user)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL
- RESEND_API_KEY
- INTERNAL_API_SECRET  ← camino server-to-server de generate-plan (creada y verificada en producción)

## Diferenciación Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Mensajes/día | 10 | 30 |
| Plan semanal | Básico | Con datos Strava |
| Macrociclo | Sí (genérico) | Sí (con carrera) |
| Ajuste automático | Sí | Sí |
| Strava sync | No | Sí |
| Intervals.icu | No | Sí |

Validación Free/Pro siempre en **backend** (claude.js) — nunca confiar solo en el frontend.

## Flujos críticos

### Completar sesión — función canónica única (unificado junio 2026)
**`completarSesion(planId, dia, campos = {})`** en `src/lib/plans.js` es la ÚNICA vía desde el frontend para completar una sesión. No crear variantes locales.
- Campos opcionales: `rpe`, `tiempo_real_min`, `distancia_real_km`, `fc_media_real`, `notas_usuario`, `via_strava`.
- SIEMPRE recalcula `volumen_real_min` (suma `tiempo_real_min || duracion_min` de completadas no-descanso).
- Lanza `Error('Plan no encontrado')` si el plan no existe.

Call sites:
1. `ModalCompletarSesion.guardar()` → `onComplete(updatedPlan)` en WeeklyPlan, que llama a `checkShouldAdjust` + `autoAdjustPlan` (flujo principal).
2. `Dashboard.handleCompletar()` — picker RPE inline de "Hoy"; también llama a `checkShouldAdjust` + `autoAdjustPlan`.
3. `App.jsx` — `SessionDetail.onComplete(rpe)` (sin auto-adjust).

Historia: antes coexistían `markSessionComplete` (plans.js, no recalculaba volumen) y `patchSesionCompleta` (local del modal) — **eliminadas** en la unificación. La vía server-side de `strava-sync.js` también recalcula `volumen_real_min` desde junio 2026 (vía `netlify/functions/lib/volumen.js`, espejo CJS de `src/lib/volumen.js` con test de paridad) — deuda resuelta. Además exporta `syncUsuario(userId)` para invocarla desde otras functions (Fase 1).

El coach se entera de las sesiones completadas vía `buildSystemPrompt` (etiquetas "✓ completada (manual/Strava)" y sección "SESIONES COMPLETADAS ESTA SEMANA") — no hay notificación explícita, es por diseño.

### Flujo OAuth de Strava (callback)

El callback llega a `app.getricoach.com/?code=XXX&state=strava`. El flujo completo vive en **App.jsx**, no en StravaConnect:

1. `useEffect([], [])` de arranque — lee `?code=&state=strava`, guarda en `stravaCallbackCode`, limpia la URL
2. `useEffect([stravaCallbackCode, session?.user?.id])` — cuando ambos están disponibles:
   - Navega a `setCurrentScreen('profile')` para que el usuario vea la pantalla correcta
   - Llama a `strava-auth` con el código y el `userId`
   - En éxito: `loadOrCreateProfile` recarga el perfil con el nuevo `strava_token`
3. `<StravaConnect key={profile?.strava_token ? 'strava-on' : 'strava-off'} …>` — el `key` fuerza el remonte cuando el token cambia de null a valor, lo que provoca que el `useEffect` interno re-consulte Supabase y muestre "✓ Strava conectado"

**No mover la lógica de intercambio OAuth a StravaConnect** — vive en App.jsx intencionalmente.

### Strava — modelo de credenciales (cerrado junio 2026)
- Strava amplió el límite de la app a **10 atletas conectados** → el modelo per-user queda **DESCARTADO definitivamente**.
- El modelo definitivo es el actual: credenciales globales en env — `STRAVA_CLIENT_ID/SECRET` en backend y `VITE_STRAVA_CLIENT_ID` en frontend.
- ⚠️ Las columnas `strava_client_id`/`strava_client_secret` de `profiles` (migración 002) están **OBSOLETAS y sin uso** — no implementar lógica per-user sobre ellas.

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

### Fechas de sesiones — `src/lib/fechas.js` (unificado junio 2026)
`plan.semana` es siempre el **lunes de la semana en ISO date** (ej: `"2026-04-28"`).
Helpers canónicos en `src/lib/fechas.js` — usar SIEMPRE estos, no reimplementar el patrón:
- `getFechaSesion(semana, dia)` — fecha real de una sesión (patrón `DIA_OFFSET_MAP` + `T12:00:00`).
- `getHoyMadrid()` — fecha de hoy en Europe/Madrid (`sv-SE`); NUNCA usar `toISOString()` para "hoy" (en la madrugada devuelve el día UTC anterior).

Usados en `WeeklyPlan.jsx` y `autoAdjust.js`. `buildSystemPrompt.js` mantiene su copia interna deliberadamente (cubierto por 32 tests, no tocar sin motivo).
Al abrir `ModalCompletarSesion`, WeeklyPlan adjunta `fecha` a la sesión (`{ ...sesion, fecha: sesionFecha }`) — necesario para el auto-import de Strava del modal.

## Tests — 201 pasando (27 archivos) + 3 specs E2E Playwright

Tests más pesados (referencia rápida):
- `systemPrompt.test.js` — buildSystemPrompt (32 tests)
- `cycles.test.js` — macrociclos (30 tests)
- `chat.test.js` — Chat.jsx + claude.js integration (14 tests)
- `completarSesion.test.js` — completarSesion + fechas Europe/Madrid (14 tests)
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
