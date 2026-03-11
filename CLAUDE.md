# TriCoach AI — Contexto del proyecto

## Qué es esto
Entrenador IA conversacional para triatletas, runners y atletas de Hyrox hispanohablantes.
App web React + Vite, backend Netlify Functions, base de datos Supabase.

## Stack
- Frontend: React + Vite
- Auth + DB: Supabase (URL: https://luqpjgzpydquqturgjmt.supabase.co)
- Backend: Netlify Functions (CommonJS, NO usar ESM)
- Tests: Vitest + Playwright
- Deploy: Netlify

## Reglas importantes
- Las Netlify Functions usan CommonJS (require, exports.handler) — NUNCA usar import/export
- Para llamar a Supabase desde las Functions: usar REST API con https nativo, NO @supabase/supabase-js (incompatible con CommonJS)
- El modelo de Claude está fijo en claude.js como CLAUDE_MODEL — nunca viene del frontend
- Siempre ejecutar `npm test` al terminar para verificar que los 31 tests siguen pasando
- No tocar .env ni subirlo a git

## Estructura de archivos clave
- netlify/functions/claude.js — función principal del chat
- netlify/functions/strava-auth.js — OAuth de Strava
- src/components/Chat.jsx — UI del chat
- src/lib/profiles.js — gestión de perfiles y límites
- src/prompts/buildSystemPrompt.js — system prompt dinámico
- src/lib/context.js — memoria del coach

## Variables de entorno disponibles (en .env)
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- ANTHROPIC_API_KEY
- STRAVA_CLIENT_ID (208711), STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI
- TRICOACH_SECRET, VITE_TRICOACH_SECRET

## Schema Supabase — tabla profiles
id, email, nombre, deporte, nivel, objetivo, fecha_carrera, plan (default: 'free'),
created_at, messages_today, last_message_date, personalidad (default: 'cercano'),
contexto, strava_token, strava_refresh_token, strava_token_expires_at,
intervals_athlete_id, intervals_api_key

## Tests actuales: 39
- 35 Vitest (npm test)
- 4 Playwright E2E (npx playwright test)
