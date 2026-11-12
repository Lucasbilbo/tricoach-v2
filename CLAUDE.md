# TriCoach AI — Contexto del proyecto

> Última actualización: 5 noviembre 2026 (reactivación del coach)
> Última auditoría: noviembre 2026 (doc "Auditoría TriCoach v2 — noviembre 2026" en el Project)

## 🔧 REACTIVACIÓN (5 noviembre 2026) — leer primero
El coach no respondía desde el 15-jun-2026: `claude-sonnet-4-20250514` fue retirado por Anthropic y todas las llamadas fallaban ("Error al responder"). Cambios:
- **Modelos**: `netlify/functions/lib/claude.js` es el ÚNICO sitio con modelos. Free → `claude-haiku-5-5`, Pro → `claude-sonnet-5-5` (env `CLAUDE_MODEL_FREE` / `CLAUDE_MODEL_PRO`). Usar siempre `callClaude()` y `extractText()` (los modelos 5.5 pueden empezar con bloques `thinking`; no aceptan temperature ni prefill). Un test falla si alguien escribe un modelo a mano en una function.
- **Auth**: `netlify/functions/lib/auth.js`. El navegador manda `Authorization: Bearer <token Supabase>` (lo añade `src/lib/api.js` envolviendo fetch) y el userId SALE DEL TOKEN. Server-to-server: `x-internal-secret` = `INTERNAL_API_SECRET` (solo funciones con `allowInternal`). **`x-tricoach-secret` / `VITE_TRICOACH_SECRET` ya no se usan** (se pueden borrar de Netlify). CORS por función (`corsHeaders`), sin `*`.
- **Crons pausados protegidos** con `guardScheduled` (requieren `x-internal-secret`, o `CRONS_ENABLED=true` + invocación del scheduler). Al reactivar los crons, crear `CRONS_ENABLED=true`.
- **health-check** (programada, diaria 07:13 UTC): prueba los modelos y manda email a `ALERT_EMAIL` si fallan (independiente de `EMAILS_ENABLED`). Prueba manual: `POST /.netlify/functions/claude-status` (`?modo=completo&plan=free|pro` hace chat + plan reales) con `x-internal-secret`.
- **Chat**: nunca guarda errores como respuesta del coach; si Claude solo usa `actualizar_perfil` sin texto, `claude.js` hace una segunda llamada con el `tool_result`. `purpose: 'contexto'` = resumen con modelo barato, system fijado en servidor, no cuenta para el límite.
- **Carreras**: `profiles.carreras[].fecha` SIEMPRE ISO `YYYY-MM-DD` (`fechaCarreraISO` en `src/lib/fechas.js`). Las 36 antiguas en texto se convirtieron el 5-nov (copia en `_backup_profiles_carreras_20261105`).
- **Macrociclo**: se crea cuando el perfil tiene `deporte` (tras onboarding). Ciclos activos sin `fecha_carrera` con carrera futura se recalculan solos al cargar (`repararCicloSinCarrera` en App.jsx).
- **Bienvenida**: la primera respuesta tras el onboarding siempre genera el plan, con lo que cuente el usuario como `contexto_semana`.
- **Límites**: `LIMITE_DIARIO` en `src/lib/profiles.js` (Free 10, Pro 20) = `DAILY_LIMIT` de claude.js. Nunca "ilimitados".
- **Onboarding (5-nov-2026)**: 3 pantallas (tú: nombre+deportes+nivel / objetivo: carreras / tu semana: lesiones+disponibilidad). Personalidad `cercano` y coach `Coach` por defecto (se cambian en EditProfile); historial, equipamiento y Strava ya no se piden aquí. `disponibilidad` y `lesiones` ahora SÍ llegan a `generate-plan` (`restriccionesSection`) y a `buildSystemPrompt` (antes se guardaban y se ignoraban).
- **Medición (5-nov-2026)**: `src/lib/analytics.js` (`track()`, sin datos personales) con eventos GA4 `sign_up`, `onboarding_complete`, `first_plan_generated`, `coach_reply`, `strava_connected`, `begin_checkout`, `upgrade_success`. Consent Mode en `index.html` (analytics denegado hasta aceptar; banner con "Solo esenciales"). La meta de retorno (3 de 10 altas vuelven en 7 días) se mide con `scripts/metricas-activacion.sql` (BD, sin cookies). Marcar los eventos como "key events" en GA4 desde su panel.
- **Prueba Pro (5-nov-2026)**: `profiles.trial_ends_at` (migración 005; default now()+7d solo para filas nuevas, las existentes NULL). `planEfectivo()` (`src/lib/planEfectivo.js` + espejo `functions/lib/plan-efectivo.js`) decide modelo y límite de mensajes. **Strava/Intervals/feedback siguen exigiendo `profile.plan === 'pro'` de pago** (Strava limita a 10 atletas). Precios: 14,99 €/mes · 119 €/año; `create-checkout` solo acepta `STRIPE_PRICE_MONTHLY/ANNUAL`.
- **Borrado de cuenta**: ahora es real (mensajes, planes, ciclos, perfil, usuario de auth; cancela Stripe y revoca Strava). Rechaza (409) entrenadores y atletas del Coach Dashboard. Las 8 cuentas "borradas" antiguas: `scripts/purgar-cuentas-borradas.sql` (a mano, irreversible).
- **Fiabilidad (5-nov-2026)**: (1) `callClaude` se autocura: si el modelo devuelve 404 `not_found_error` (retirado), busca el más reciente de la misma familia en `GET /v1/models`, reintenta y deja `console.error`; el health-check llama con `sinFallback` y SIGUE avisando. Retiradas anunciadas: haiku-5-5 no antes del 7-oct-2027, sonnet-5-5 no antes del 28-sep-2027 (Anthropic avisa por email con ≥60 días a la cuenta de la API: que sea un buzón que se lee). (2) health-check también avisa si ≥3 mensajes y ≥30 % de los de las últimas 24 h no recibieron respuesta (`calcularSinRespuesta` en `lib/salud.js`, deducido de `messages`; excluye usuarios con ≥10 mensajes por el límite diario). (3) `stripe-webhook` usa `lib/stripe-eventos.js`: firma con tolerancia 5 min, `invoice.payment_failed` → alerta a ALERT_EMAIL (no baja a Free), `subscription.deleted/updated` terminal → solo baja a Free si en Stripe no queda ninguna suscripción viva (si Stripe no responde, NO baja y avisa), `subscription.updated` active/trialing → reactiva Pro. **El endpoint del webhook en Stripe debe estar suscrito a `invoice.payment_failed` y `customer.subscription.updated`.** (4) `validarDuracion` vive en `lib/duraciones.js`: a un principiante ya no se le suben las sesiones a los mínimos de fase (antes 80 min de bici) y se limita a 60 min, coherente con el prompt. Las alertas a Lucas usan `sendAlertEmail` (independiente de `EMAILS_ENABLED`); los emails a usuarios siguen apagados.
- **Semana de diagnóstico (5-nov-2026)**: el primer plan de todo usuario sin ≥3 actividades de Strava es de diagnóstico (`buildDiagnosticoUserMessage`). Hasta hoy esa plantilla IGNORABA `disponibilidad`, `lesiones`, `contexto_semana` (lo que el usuario cuenta en la bienvenida) y `nivel`. Ahora `buildBloqueDiagnostico` los añade, pide rodajes suaves (Z1-Z2) en los días sin test (máx. 2 descansos reales) y a los principiantes les quita los tests a máximo esfuerzo. `Dashboard.esSesionTest` excluye las sesiones `suave`. La conversación de bienvenida ahora se guarda en `messages`. `profiles.contexto` tenía por defecto el texto `'null'` (migración 006 pendiente de aplicar); el código ya lo ignora.

## 💶 EMBUDO DE PAGO (11 noviembre 2026) — plan completo en `tasks/plan-ventas.md`
- **Checkout**: el navegador manda `plan: 'monthly' | 'annual'` y `create-checkout` elige el precio (`STRIPE_PRICE_MONTHLY/ANNUAL`). `VITE_STRIPE_PRICE_*` ya no se usan (se pueden borrar de Netlify). Tras pagar o cancelar se vuelve a `<origen>/app` (`?upgrade=success`), nunca a la raíz: la raíz es la landing y ahí no se medía `upgrade_success` ni se confirmaba la compra.
- **Oferta de Pro**: se enseña a todo el que no paga (`profile.plan !== 'pro'`), también durante la prueba. `planEfectivo()` sigue decidiendo solo modelo y límite de mensajes.
- **Fin de prueba**: `TrialBanner` en "Hoy" (`src/lib/estadoPrueba.js`): avisa los últimos 3 días y, al caducar, durante 14 días (se puede cerrar; `localStorage.trial_fin_visto`).
- **Strava en el perfil**: solo `StravaConnect` (App.jsx). El formulario de credenciales por usuario de EditProfile se eliminó (modelo descartado).
- `profiles.stripe_subscription_id` NO existe; solo `stripe_customer_id`.

## ✉️ EMAILS, CRONS Y PORTAL (12 noviembre 2026)
- **Variables necesarias en Netlify**: `EMAILS_ENABLED=true` (emails a usuarios) y `CRONS_ENABLED=true` (crons). Sin ellas las functions programadas no hacen nada. **Migración 007** obligatoria (marcas de envío + `trial_ends_at` protegido en el trigger `profiles_proteger_campos`); sin ella `trial-reminder` y `recuperacion-altas` fallan sin enviar nada.
- **Crons activos**: `auto-plans` (lunes 03:00 UTC; ahora Pro de pago **y cuentas en prueba**, `filtroPlan()`), `trial-reminder` (diario 08:23 UTC; un email por cuenta cuando quedan <48 h de prueba; marca `trial_aviso_enviado_at`), `recuperacion-altas` (envío ÚNICO el 13-nov-2026; caduca el 20-nov; después borrar la función y su bloque en `netlify.toml`). `weekly-report` y `thursday-reminder` siguen pausados.
- **Plantillas** de bienvenida Pro, fin de prueba y recuperación: `netlify/functions/lib/emails-usuario.js` (enlace siempre a `https://getricoach.com/app`, nombre escapado, pie con baja).
- **Portal de Stripe**: `create-portal.js` + botón "Gestionar suscripción" en EditProfile (solo `plan === 'pro'` con `stripe_customer_id`). Requiere activar el portal de clientes en Stripe.
- **`lib/supa.js`**: cliente REST mínimo de Supabase para functions nuevas (`supa(method, path, body)` → `{ ok, status, data }`).

## 📸 CAPTURA DEL ENTRENO Y STRAVA CERRADO A NUEVOS (12 noviembre 2026)
- **Por qué**: la API Policy de Strava (1-jun-2026, §5.3) prohíbe usar sus datos con IA, incluido meterlos en el contexto de un modelo. La app no puede crecer por Strava ni pedir más plazas. **Decisión de Lucas**: quien ya está conectado sigue igual; no se admiten conexiones nuevas; Strava no se vende.
- **Strava**: `StravaConnect` solo pinta el estado conectado (+ desconectar, con aviso de que no se puede reconectar); sin token devuelve `null` y App.jsx no enseña el bloque "Integraciones". No reintroducir el botón de conectar ni mencionar Strava en landing, guías, modal Pro, avisos o emails (lo comprueba `captura.test.js`). `strava-*` functions siguen vivas para los conectados.
- **Captura**: en `ModalCompletarSesion`, "Subir captura del entreno" → `src/lib/captura.js` reduce la imagen (JPEG, lado máx. 1568) → `analizar-captura.js` → Claude lee duración, distancia y FC media y devuelve un comentario frente a lo planificado. Los campos se rellenan y **el usuario los revisa antes de guardar** (sigue pasando por `completarSesion`). Lógica pura y prompt en `functions/lib/captura.js` (valida rangos; el texto de la imagen son datos, no instrucciones).
- Cada captura **cuenta como un mensaje del día** (misma RPC `increment_messages_today`; `DAILY_LIMIT` duplicado con test de paridad). La imagen no se guarda ni se registra. Evento GA4 `captura_leida`.
- **Qué vende Pro ahora**: coach avanzado, 20 mensajes al día, plan nuevo cada lunes (auto-plans) e Intervals.icu. La captura está en Free y Pro.
- **Siguiente fuente de datos automática**: app nativa con Apple Health / Health Connect. Garmin directo exige solicitar como organización; Intervals.icu ya no sirve de puente para datos de Garmin ni de Strava.

## ⭐ QUÉ GANA PRO (12 noviembre 2026) — "en Free el coach te dice qué hacer; en Pro además mira lo que haces"
| | Free | Pro (de pago o en prueba) |
|---|---|---|
| Capturas de entreno | 2 por semana | Sin tope semanal |
| Plan semanal | Lo genera el usuario | Llega solo cada lunes (`auto-plans`) |
| Revisión semanal por email | No | Domingos 19:00 UTC (`weekly-report`) |
| Modelo / mensajes al día | Haiku / 10 | Sonnet / 20 |
| Intervals.icu | No | Sí (solo Pro de pago) |
- **Tope semanal de capturas**: `LIMITE_SEMANAL_FREE = 2` en `functions/lib/captura.js` (espejo en `src/lib/captura.js`, test de paridad). Semana = lunes a domingo en Madrid. **Migración 008**: columnas `capturas_semana` / `capturas_semana_inicio`, RPC `registrar_captura` y campos protegidos en el trigger. `analizar-captura` corta ANTES de llamar a Claude y suma solo si la lectura sale bien; sin la migración funciona sin tope semanal (deja `console.error`). Cada captura sigue contando como mensaje del día.
- **Modal**: enseña las capturas que quedan; a 0, oferta de Pro (cierra el modal antes de abrir `UpgradeModal`, que tiene z-index menor).
- **`weekly-report`**: solo Pro y prueba Pro; ya no existe la versión Free ni se registran emails en los logs. `thursday-reminder` sigue pausado.
- Al tocar lo que incluye cada plan, actualizar a la vez: landing (listas, nota y FAQ + JSON-LD), `llms.txt`, `UpgradeModal`, `TrialBanner`, `EditProfile`, `Chat` y `lib/emails-usuario.js` (`pro-beneficios.test.js` lo comprueba).

## ⏸ PAUSA DEL 29 octubre 2026 (parcialmente levantada el 12-nov: ver sección anterior)
Estado en que quedaron las automatizaciones durante la pausa:
- **Crons desactivados**: se han quitado de `netlify.toml` los schedules de `weekly-report` (dom 19:00 UTC), `thursday-reminder` (jue 17:00 UTC) y `auto-plans` (lun 03:00 UTC). Las funciones siguen existiendo, solo no se disparan solas.
- **Emails desactivados por defecto** (Resend): interruptor `EMAILS_ENABLED` en `netlify/functions/lib/email.js`. Sin la variable `EMAILS_ENABLED=true` en Netlify no sale ningún email: informe semanal, recordatorio del jueves, "plan listo" y bienvenida de Stripe (el pago y la activación Pro siguen funcionando igual).
- **Cómo reactivar**: (1) restaurar los 3 bloques `[functions."..."] schedule` (valores en el comentario de `netlify.toml`); (2) crear `EMAILS_ENABLED=true` en las variables de entorno de Netlify; (3) `git push origin main`.
- El Coach Dashboard no tiene tareas programadas; Supabase no tiene pg_cron ni edge functions.
- Tests: 7 archivos fallan en entornos sin `.env` (variables VITE_*) y un test de `systemPrompt` depende de la fecha actual; ya fallaban antes de la pausa.

## Qué es esto
Entrenador IA conversacional para triatletas, runners y atletas de Hyrox hispanohablantes.
App web React + Vite, backend Netlify Functions, base de datos Supabase.
Freemium: Free (10 msg/día, 2 capturas de entreno por semana, plan que genera el propio usuario) / Pro (14,99€/mes o 119€/año: modelo avanzado, 20 msg/día, capturas sin tope semanal, plan nuevo cada lunes, revisión semanal por email). Cuentas nuevas: 7 días de prueba Pro sin tarjeta.
El coach sabe lo que entrena el usuario por el check-in de la sesión (hecho, esfuerzo, notas) y por la captura del entreno (el usuario sube el pantallazo del reloj y Claude lee duración, distancia y pulso; la imagen no se guarda). Strava ya no admite conexiones nuevas ni se vende (ver sección del 12-nov-2026).

## Stack
- Frontend: React + Vite (JavaScript, NO TypeScript)
- Auth + DB: Supabase (URL: https://luqpjgzpydquqturgjmt.supabase.co) — RLS activado
- Backend: Netlify Functions (CommonJS — require/exports.handler, NUNCA import/export)
- Tests: Vitest — **368 tests pasando** (41 archivos, cargan sin .env) + Playwright E2E (3 specs)
- Deploy: Netlify (producción: https://getricoach.com — la app vive en `/app`; `tricoach-v2.netlify.app` sigue como alias)
- Pagos: Stripe (checkout + webhooks)
- Email: Resend (coach@getricoach.com)

## Reglas críticas — leer siempre antes de tocar código

### Netlify Functions
- CommonJS SIEMPRE: `const x = require('x')` y `exports.handler = async (event) => {}`
- NO usar @supabase/supabase-js — usar REST API con https nativo
- Autenticar SIEMPRE con `authenticate(event, { cors, bodyUserId })` de `./lib/auth` y usar `auth.userId` — **TODAS las funciones sin excepción** (nunca fiarse del userId del body)
- Validar UUID antes de usar en queries: `const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — añadido en todas las funciones que reciben userId/planId
- El modelo de Claude nunca viene del frontend: se elige en `lib/claude.js` con `modelFor(profile.plan)` (o `cheapModel()` para tareas internas). Ver sección REACTIVACIÓN.
- No usar console.log en producción — solo console.error para errores reales

Template mínimo para nueva función:
```javascript
const { authenticate, corsHeaders } = require('./lib/auth');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) }; }
  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId; // del token de Supabase, nunca del body
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
- Prueba end-to-end del orquestador ejecutada en local contra producción: `elegibles=2 ya_existian=1 pendientes=1` → plan real generado con contexto de macrociclo + email Resend entregado y **HTML verificado en bandeja real** (render correcto). Primer cron real: lunes 15 junio 03:00 UTC.

#### Cómo probar el orquestador
- **Local**: `netlify dev` en una terminal y `netlify functions:invoke auto-plans` en otra (usa el `.env` local; las invocaciones a generate-plan irán a localhost:8888).
- **Smoke inocuo en producción** (coste cero, no escribe): pedir la generación de la semana ACTUAL sin forzar para un usuario que ya tiene plan → debe responder `{ ya_existe: true }` sin llamar a Claude:
  `curl -s -X POST https://app.getricoach.com/.netlify/functions/generate-plan -H "Content-Type: application/json" -H "x-internal-secret: $INTERNAL_API_SECRET" -d '{"userId":"<tu-uuid>","fechaInicio":"<lunes-actual>"}'`

### Borrado de cuenta (delete-account.js) — real desde nov-2026
Borra mensajes, planes, ciclos, perfil y usuario de auth; cancela suscripciones y borra el cliente de Stripe; revoca Strava. Devuelve 409 a entrenadores y atletas del Coach Dashboard (no tocar sus datos).
`deleted_at` queda solo por las cuentas antiguas soft-deleted: `App.jsx` las sigue detectando y cerrando sesión.
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
- **368 tests deben pasar** (41 archivos — actualizado noviembre 2026) — si alguno falla, arreglarlo antes de terminar
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
├── README.md
├── landing.html               — landing (raíz del dominio); scripts/build-static.js la copia al build
├── <guía>.html                — guías SEO en la raíz (zona 2, planes 5K/10K/media/maratón, Hyrox, triatlón, natación, bici para triatlón, recuperación, calculadora…);
│                                cada una con su par de redirects en netlify.toml, entrada en sitemap.xml y static/llms.txt
├── tasks/
│   ├── lessons.md             — lecciones aprendidas (leer siempre antes de empezar)
│   ├── plan-ventas.md         — auditoría del embudo de pago (11-nov-2026)
│   ├── seo-informe-2026-11-06.md
│   ├── analisis-flujo-datos.md, DESIGN-raycast.md, PROMPTS_CLAUDE_CODE.md
├── scripts/
│   ├── build-static.js        — copia landing, guías y ficheros estáticos al build
│   ├── generate-icons.js
│   ├── metricas-activacion.sql — meta de retorno (3 de 10 altas vuelven en 7 días), sin cookies
│   ├── embudo-semanal.sql      — embudo por semana de alta (alta → onboarding → plan → sesión marcada → vuelve → Pro); solo lectura, sin datos personales
│   └── purgar-cuentas-borradas.sql — borrado manual e irreversible de cuentas soft-deleted antiguas
├── static/                    — robots.txt, llms.txt, og-image.png, verificación de Bing
├── public/                    — manifest.json, sw.js, iconos
├── supabase/
│   └── migrations/            — 001_training_cycles, 002_strava_user_credentials (obsoleta), 003_unique_plan_semana,
│                                004_contexto_proxima_semana, 005_trial_pro, 006_contexto_null, 007_emails_usuario,
│                                008_capturas_semana, 009_recordatorio_sesion, 010_trial_dia3, 011_trial_reactivacion. Las ejecuta Lucas a mano en Supabase.
├── src/
│   ├── components/
│   │   ├── Login.jsx, Onboarding.jsx (3 pantallas), WelcomeGuide.jsx
│   │   ├── Chat.jsx                  — chat con coach IA, rate limiting frontend
│   │   ├── Dashboard.jsx             — pantalla "Hoy": sesión del día, auto-adjust, TrialBanner
│   │   ├── WeeklyPlan.jsx            — plan semanal, modal completar, botones ajuste
│   │   ├── Progress.jsx              — estadísticas, consistencia (historialPlanes), gráfico semana
│   │   ├── EditProfile.jsx           — editar perfil, "Mis carreras", datos de rendimiento, portal de Stripe, borrar cuenta
│   │   ├── ModalCompletarSesion.jsx  — RPE + tiempo real + distancia + FC + notas; "Subir captura del entreno"
│   │   ├── SessionDetail.jsx, BottomNav.jsx, ErrorBoundary.jsx, CookieBanner.jsx
│   │   ├── UpgradeModal.jsx          — oferta de Pro (checkout mensual/anual)
│   │   ├── TrialBanner.jsx           — aviso de fin de prueba Pro en "Hoy"
│   │   ├── AdjustmentBanner.jsx      — banner naranja tras ajuste automático (Fase 8)
│   │   ├── CicloCompletadoBanner.jsx — banner cuando el macrociclo termina
│   │   └── StravaConnect.jsx         — solo pinta el estado conectado (+ desconectar); sin token devuelve null
│   ├── lib/
│   │   ├── supabase.js, api.js (envuelve fetch y añade Authorization), analytics.js (track(), GA4 sin datos personales)
│   │   ├── profiles.js        — getProfile, updateProfile, canSendMessage, LIMITE_DIARIO
│   │   ├── messages.js, context.js
│   │   ├── plans.js           — getPlan, generatePlan, completarSesion (función canónica), adjustPlan,
│   │   │                        autoAdjustPlan, getHistorialPlanes, calcularConsistencia, analizarPlan
│   │   ├── fechas.js          — getFechaSesion, getHoyMadrid, DIA_OFFSET_MAP, fechaCarreraISO (fuente única de fechas)
│   │   ├── planEfectivo.js    — plan efectivo (pro / prueba / free), enPrueba, diasPruebaRestantes (espejo CJS en functions/lib)
│   │   ├── estadoPrueba.js    — cuándo y qué avisar al acabar la prueba (TrialBanner)
│   │   ├── captura.js         — reduce la imagen de la captura y LIMITE_SEMANAL_FREE (espejo CJS en functions/lib)
│   │   ├── wellness.js        — UMBRALES_WELLNESS, evaluarWellness (espejo CJS)
│   │   ├── volumen.js         — calcularVolumenReal (espejo CJS)
│   │   ├── autoAdjust.js      — checkShouldAdjust(plan, profile) — función pura, sin efectos
│   │   └── cycles.js          — calcularFases, getFaseActual, esSemanaDescarga, esCicloCompletado
│   ├── pages/
│   │   ├── Privacidad.jsx     — política de privacidad
│   │   └── Terminos.jsx       — términos de uso
│   ├── prompts/
│   │   └── buildSystemPrompt.js
│   ├── test/                  — 41 archivos Vitest (ver sección Tests) + e2e/ con 3 specs Playwright
│   │   └── e2e/ (auth.spec.js, audit.spec.js, coach-calendar-sync.spec.js)
│   ├── index.css
│   ├── App.jsx
│   └── main.jsx
├── netlify/
│   └── functions/
│       ├── lib/                     — código compartido CJS (NO son functions): auth.js (authenticate, corsHeaders, guardScheduled),
│       │                              claude.js (modelos y callClaude), supa.js (REST de Supabase), email.js (Resend, EMAILS_ENABLED),
│       │                              emails-usuario.js (plantillas), fechas.js, plan-efectivo.js, planes.js, captura.js, duraciones.js,
│       │                              salud.js, stripe-eventos.js, volumen.js, wellness.js
│       ├── claude.js                — chat Claude, rate limiting atómico (RPC)
│       ├── analizar-captura.js      — lee la captura del entreno con Claude (imagen no guardada; cuenta como mensaje; tope semanal en Free)
│       ├── generate-plan.js         — genera plan semanal (estructura real, macrociclo, idempotente + forzar)
│       ├── adjust-plan.js           — ajusta plan (lesión/viaje/sobrecarga/sesiones_perdidas + signal)
│       ├── create-cycle.js          — crea macrociclo de entrenamiento (idempotente)
│       ├── recalculate-cycle.js     — recalcula fases del ciclo tras cambio de carrera
│       ├── coach-intro.js           — mensaje de bienvenida del coach
│       ├── auto-plans.js            — plan semanal automático [SCHEDULED: lunes 03:00 UTC — ACTIVO; Pro de pago y prueba Pro]
│       ├── weekly-report.js         — revisión semanal por email [SCHEDULED: domingos 19:00 UTC — ACTIVO; Pro y prueba Pro]
│       ├── trial-reminder.js        — aviso de fin de prueba [SCHEDULED: diario 08:23 UTC — ACTIVO]
│       ├── trial-dia3.js            — email del día 3 de la prueba Pro, un envío por cuenta [SCHEDULED: diario 09:12 UTC — ACTIVO tras aplicar migración 010]
│       ├── trial-reactivacion.js    — email único 3-4 días tras caducar la prueba [SCHEDULED: diario 09:42 UTC — ACTIVO tras aplicar migración 011]
│       ├── session-reminder.js      — recordatorio el día de la sesión pendiente, Free y Pro [SCHEDULED: diario 18:30 UTC — ACTIVO]
│       ├── recuperacion-altas.js    — email ÚNICO de recuperación [SCHEDULED: 13-nov-2026; caduca el 20-nov, luego borrar]
│       ├── health-check.js          — prueba los modelos y avisa a ALERT_EMAIL [SCHEDULED: diario 07:13 UTC — ACTIVO]
│       ├── thursday-reminder.js     — recordatorio semanal [jueves 17:00 UTC — PAUSADO, no activar]
│       ├── claude-status.js         — prueba manual del coach (con x-internal-secret)
│       ├── create-checkout.js       — Stripe Checkout Session (monthly | annual)
│       ├── create-portal.js         — portal de cliente de Stripe
│       ├── stripe-webhook.js        — webhook Stripe (activar/revocar Pro, alertas de cobro)
│       ├── delete-account.js        — borrado real de la cuenta (cancela Stripe, revoca Strava)
│       ├── strava-auth.js           — OAuth Strava (la UI ya no ofrece conectar; exige plan Pro de pago; credenciales globales STRAVA_CLIENT_ID/SECRET)
│       ├── strava-activities.js     — actividades Strava + refresh token (solo cuentas ya conectadas)
│       ├── strava-sync.js           — sync Strava → plan; exporta syncUsuario() reutilizable; recalcula volumen_real_min
│       ├── strava-match-activity.js — match actividad Strava con sesión del plan
│       ├── strava-feedback.js       — feedback automático post-entreno (Pro, fire-and-forget)
│       └── intervals.js             — integración Intervals.icu (GET/POST/DELETE)
├── index.html
├── netlify.toml
├── vite.config.js, playwright.config.js, eslint.config.js
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
stripe_customer_id,
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
- (VITE_TRICOACH_SECRET — OBSOLETA desde nov-2026, ya no se usa)
- VITE_STRAVA_CLIENT_ID, VITE_STRAVA_REDIRECT_URI  ← credenciales globales TriCoach (no per-user)
- VITE_STRIPE_PUBLISHABLE_KEY

Backend (solo en Netlify Functions):
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY
- (TRICOACH_SECRET — OBSOLETA desde nov-2026)
- CLAUDE_MODEL_FREE, CLAUDE_MODEL_PRO (opcionales; por defecto haiku-5-5 / sonnet-5-5)
- ALERT_EMAIL ← destinatario del health-check
- CRONS_ENABLED ← poner a true al reactivar los crons
- STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI  ← credenciales globales TriCoach (no per-user)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL
- RESEND_API_KEY
- INTERNAL_API_SECRET  ← camino server-to-server de generate-plan (creada y verificada en producción)

## Diferenciación Free vs Pro

| Feature | Free | Pro (de pago o en prueba de 7 días) |
|---------|------|-----|
| Mensajes/día | 10 | 20 |
| Modelo de IA | Haiku | Sonnet (avanzado) |
| Capturas de entreno | 2 por semana | Sin tope semanal |
| Plan semanal | Lo genera el usuario | Llega solo cada lunes (`auto-plans`) |
| Revisión semanal por email | No | Domingos 19:00 UTC (`weekly-report`) |
| Macrociclo | Sí (genérico) | Sí (con carrera) |
| Ajuste automático | Sí | Sí |
| Recordatorios y emails de aviso | Según el email | Según el email |
| Intervals.icu | No | Sí (solo Pro de pago) |
| Strava (feedback post-entreno; solo cuentas ya conectadas) | No | Sí (solo Pro de pago); no hay conexiones nuevas |

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

## Tests — 368 pasando (41 archivos) + 3 specs E2E Playwright

Tests más pesados (referencia rápida):
- `systemPrompt.test.js` — buildSystemPrompt (32 tests)
- `cycles.test.js` — macrociclos (30 tests)
- `reactivacion-coach.test.js` — modelos, auth y reactivación del coach (19 tests)
- `salud-y-stripe.test.js` — health-check y webhook de Stripe (15 tests)
- `completarSesion.test.js` — completarSesion + fechas Europe/Madrid (14 tests)
- `chat.test.js` — Chat.jsx + claude.js integration (14 tests)
- `pro-beneficios.test.js` — coherencia de lo que incluye cada plan (13 tests)
- `captura.test.js` — captura del entreno y Strava cerrado (13 tests)
- `guias-seo.test.js` — cada guía tiene redirects, sitemap, llms.txt, canonical y no cita Strava (16 tests)
- `emails-usuario.test.js` — plantillas y crons de email (11 tests)
- `session-reminder.test.js` — recordatorio de sesión: destinatarios, día en Madrid, una vez al día, baja (25 tests)
- `autoAdjust.test.js` — checkShouldAdjust (11 tests)
- `trial-banner.test.jsx` (10 tests), `plan-efectivo.test.js` (9 tests), `autoRegenPlan.test.js` (8 tests)

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
