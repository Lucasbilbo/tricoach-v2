# TriCoach AI — Contexto del proyecto

## Qué es esto
Entrenador IA conversacional para triatletas, runners y atletas de Hyrox hispanohablantes.
App web React + Vite, backend Netlify Functions, base de datos Supabase.
Freemium: Free (10 msg/día, plan básico) / Pro (9,99€/mes, Strava + plan adaptativo).

## Stack
- Frontend: React + Vite (JavaScript, NO TypeScript)
- Auth + DB: Supabase (URL: https://luqpjgzpydquqturgjmt.supabase.co)
- Backend: Netlify Functions (CommonJS — require/exports.handler, NUNCA import/export)
- Tests: Vitest (43 tests) + Playwright E2E (4 tests)
- Deploy: Netlify (producción: https://tricoach-v2.netlify.app)
- Pagos: Stripe (checkout + webhooks)
- Email: Resend (coach@getricoach.com)

## Reglas críticas — leer siempre antes de tocar código

### Netlify Functions
- CommonJS SIEMPRE: `const x = require('x')` y `exports.handler = async (event) => {}`
- NO usar @supabase/supabase-js — usar REST API con https nativo
- Validar siempre el header `x-tricoach-secret` contra `process.env.TRICOACH_SECRET`
- El modelo de Claude está fijo: `CLAUDE_MODEL = 'claude-sonnet-4-20250514'` en claude.js — nunca viene del frontend

### Supabase desde Functions
Patrón estándar para GET:
```javascript
const https = require('https')
function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'luqpjgzpydquqturgjmt.supabase.co',
      path: `/rest/v1/${path}`,
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    }
    https.get(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject)
  })
}
```

### Frontend
- Sistema de diseño: variables CSS en src/index.css (--background, --primary, --card, etc.)
- Fuentes: Playfair Display (serif, títulos) + Source Sans 3 (sans, texto)
- Sin librerías de UI externas (no shadcn, no lucide-react, no Material UI)
- Usar emojis o SVG inline para iconos

### Tests
- Ejecutar `npm test` al terminar SIEMPRE
- 43 tests deben pasar — si alguno falla, arreglarlo antes de terminar
- No borrar ni modificar tests existentes sin motivo explícito

## Estructura de archivos completa

```
tricoach-v2/
├── CLAUDE.md
├── src/
│   ├── components/
│   │   ├── Login.jsx          — login con Google
│   │   ├── Onboarding.jsx     — onboarding nuevo usuario
│   │   ├── Chat.jsx           — chat con el coach IA
│   │   ├── EditProfile.jsx    — editar perfil (página, no modal)
│   │   ├── StravaConnect.jsx  — conectar Strava
│   │   ├── WeeklyPlan.jsx     — plan semanal con cards
│   │   ├── BottomNav.jsx      — navegación fija abajo
│   │   ├── UpgradeModal.jsx   — modal upgrade Free→Pro con Stripe
│   │   └── CookieBanner.jsx   — banner GDPR
│   ├── lib/
│   │   ├── supabase.js        — cliente Supabase
│   │   ├── profiles.js        — getProfile, updateProfile, checkLimit
│   │   ├── messages.js        — getMessages, saveMessage
│   │   ├── context.js         — memoria del coach
│   │   └── plans.js           — getPlan, generatePlan, markSessionComplete,
│   │                             getLastWeekPlan, adjustPlan, analizarPlan
│   ├── pages/
│   │   ├── Privacidad.jsx
│   │   └── Terminos.jsx
│   ├── prompts/
│   │   └── buildSystemPrompt.js — system prompt dinámico (perfil + actividades + plan)
│   ├── test/
│   │   ├── setup.js
│   │   ├── example.test.jsx
│   │   ├── supabase.test.js
│   │   ├── auth.test.jsx
│   │   ├── netlify-functions.test.js
│   │   ├── profiles.test.js
│   │   ├── onboarding.test.jsx
│   │   ├── limits.test.js
│   │   ├── systemPrompt.test.js
│   │   ├── strava-activities.test.js
│   │   ├── weeklyPlan.test.js
│   │   ├── phase8.test.jsx
│   │   ├── phase10.test.jsx
│   │   └── e2e/auth.spec.js
│   ├── index.css              — variables CSS del sistema de diseño
│   ├── App.jsx
│   └── main.jsx
├── netlify/
│   └── functions/
│       ├── claude.js          — chat con Claude (modelo fijo, límite Free)
│       ├── strava-auth.js     — OAuth Strava
│       ├── strava-activities.js — actividades Strava + refresh token
│       ├── generate-plan.js   — genera plan semanal con Claude
│       ├── adjust-plan.js     — ajusta plan (lesión/viaje/día suelto)
│       ├── create-checkout.js — crea Stripe Checkout Session
│       ├── stripe-webhook.js  — webhook Stripe (activar/revocar Pro)
│       └── delete-account.js  — borrar cuenta GDPR
├── index.html                 — incluye fuentes Google Fonts
├── netlify.toml
├── vite.config.js
└── package.json
```

## Schema Supabase

### tabla `profiles`
```
id, email, nombre, deporte, nivel, objetivo, fecha_carrera,
plan ('free'|'pro'), created_at, messages_today, last_message_date,
personalidad ('cercano'|'estricto'|'gracioso'|'motivador'),
contexto, strava_token, strava_refresh_token, strava_token_expires_at,
stripe_customer_id, intervals_athlete_id, intervals_api_key
```

### tabla `messages`
```
id, user_id, role, content, created_at
```

### tabla `plans`
```
id, user_id, semana (date — lunes de la semana), sesiones (jsonb), created_at
```

Estructura de `sesiones` (array de 7 objetos):
```json
{
  "dia": "Lunes",
  "tipo": "run|bike|swim|strength|rest",
  "descripcion": "string",
  "distancia": "string",
  "duracion": "string",
  "intensidad": "string",
  "completada": false,
  "rpe_usuario": null
}
```

## Variables de entorno

Frontend (VITE_*):
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- VITE_TRICOACH_SECRET
- VITE_STRAVA_CLIENT_ID (208711), VITE_STRAVA_REDIRECT_URI
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
| Mensajes/día | 10 | Ilimitados |
| Plan semanal | Básico (sin Strava) | Con datos Strava |
| Análisis semana anterior | No | Sí |
| Plan adaptativo | No | Sí |

Validación Free/Pro siempre en **backend** (claude.js, generate-plan.js) — nunca confiar solo en el frontend.

## Flujo de trabajo
1. `netlify dev` para desarrollo local → http://localhost:8888
2. Claude Code implementa → `npm test` → `npm run build`
3. `git add . && git commit -m "..." && git push`
4. Netlify despliega automáticamente

## Eficiencia
- Ejecuta directamente sin preámbulos ni explicaciones de lo que vas a hacer
- Al terminar: resumen breve de cambios realizados (no de lo que ibas a hacer)
- npm test && npm run build siempre al final en un solo comando
- No leas archivos que no sean necesarios para la tarea
- No hagas búsquedas globales en el proyecto si sabes el archivo exacto
- Si el prompt especifica el archivo, ve directo a él
- No ejecutes npm test en medio de la tarea, solo al final
- No confirmes con el usuario durante la ejecución, completa todo el prompt de una vez

## Configuración del entorno
- PATH de Claude Code: `export PATH="$HOME/.local/bin:$PATH"` — ya añadido permanentemente en `~/.zshrc`

## Tests: 48 pasando
- systemPrompt.test.js (10), strava-activities.test.js (4), weeklyPlan.test.js (4)
- phase8.test.jsx (4), phase10.test.jsx (4), phase105.test.jsx (5), limits.test.js (4)
- onboarding.test.jsx (3), netlify-functions.test.js (3)
- profiles.test.js (2), supabase.test.js (2), auth.test.jsx (2), example.test.jsx (1)
- E2E: auth.spec.js (4)

## Workflow
- Para tareas de 3+ pasos: escribe un plan breve antes de ejecutar
- Si algo falla: para, replantea, no sigas empujando en la misma dirección
- Nunca marques una tarea como completa sin demostrar que funciona

## Bugs
- Cuando hay un bug: busca la causa raíz, no parches temporales
- Apunta a logs y tests fallando, luego resuélvelos
- No pidas confirmación del usuario durante la ejecución

## Calidad
- Para cambios no triviales: pregúntate "¿hay una forma más elegante?"
- Si un fix parece un hack: reimplementa desde la causa raíz
- Cada cambio debe poder ser aprobado por un senior engineer

## Lecciones aprendidas
- Después de cualquier corrección del usuario: actualizar tasks/lessons.md con el patrón del error
- Revisar tasks/lessons.md al inicio de cada sesión
