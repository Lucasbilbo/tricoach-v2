# TriCoach AI — Plan de Producto
_Versión 11.2 — actualizado junio 2026 (auditoría)_

---

## 🎯 Visión

Entrenador IA conversacional para triatletas, runners, atletas de Hyrox y nadadores hispanohablantes. El único coach IA que habla tu idioma, conoce tus datos reales de Strava, y te dice exactamente qué entrenar hoy.

**Posicionamiento:** Entrenador personal digital (estilo Whoop). No herramienta técnica (estilo TrainingPeaks).

**Mensaje central:** "Abres la app y sabes exactamente qué entrenar hoy."

---

## 👤 Usuario objetivo

- 25–45 años, deportista aficionado, trabajador, tiempo limitado
- Deportes: triatlón, running (5K–42K), Hyrox, natación
- Nivel: principiante o intermedio
- Mercado: ES, MX, AR, CO

---

## 💰 Modelo de negocio

| Plan | Precio | Límites |
|------|--------|---------|
| **Free** | 0€ | 25 msg/día, 1 plan/semana, 1 ajuste/día |
| **Pro** | 9,99€/mes | 150 msg/día, 3 planes/semana, 5 ajustes/día |
| **Pro Anual** | 79€/año | Todo Pro con ~34% descuento |

- Stripe live activo ✅
- Código amigos: `FRIENDS2026` (100% descuento, para siempre)
- Modelo revisable con datos reales tras primeros 25 usuarios
- Abandoned checkout: no disponible en plan actual de Stripe

---

## ✅ COMPLETADO

**Base técnica**
- React + Vite, Supabase, Google Auth, Netlify Functions
- 125 tests pasando, E2E Playwright
- GDPR, cookies, borrado de cuenta
- CLAUDE.md con workflow, calidad y sistema de lecciones aprendidas

**Onboarding (8 pasos)**
- Nombre, deporte, nivel, carreras múltiples (fechas futuras)
- Contexto personal: historial, lesiones, disponibilidad, equipamiento
- Personalidad del coach + nombre del coach
- Campos obligatorios validados + guía bienvenida primera vez

**Plan de entrenamiento**
- Generación siempre dentro de semana lunes-domingo actual
- Solo muestra días desde hoy hasta el domingo (no días pasados)
- Semana de diagnóstico automática para usuarios nuevos
- Método inteligente según semanas a la carrera (base → polarizado → pico → taper)
- Progresión obligatoria entre semanas (+5-10% carga, variar tipos)
- Descarga automática cada 4ª semana
- Historial 4 semanas para contexto de progresión
- Botón "Próxima semana →" visible desde el jueves
- Navegación < > entre semana actual y próxima semana
- Ajuste por lesión/viaje/día suelto + análisis semana anterior
- Descarga TCX para relojes Garmin/Suunto/Polar
- Optimistic UI al marcar sesiones completadas

**Coach**
- 4 personalidades: cercano, estricto, motivador, científico
- Científico: zonas FC, vatios, ritmos exactos, fisiología
- Fecha actual con zona horaria Madrid en system prompt
- Nunca pregunta qué día es
- Rate limiting fiable en Supabase
- Confirmación automática de ajustes desde el chat
- Coach reconoce sesiones completadas (Strava vs manual)
- Mensaje de bienvenida proactivo al abrir el chat
- Memoria real: historial 4 semanas, adherencia, RPE medio, tendencia
- Toast "✅ Plan actualizado" al ajustar desde chat
- Badge "Actualizado por el coach" en WeeklyPlan

**Sincronización coach-calendario**
- Fuente de verdad única: fecha de hoy
- getPlanActual() por rango de fechas (nunca limit 1)
- Supabase Realtime — cualquier cambio se propaga instantáneamente
- Coach y calendario siempre muestran el mismo plan
- Ajuste desde chat → WeeklyPlan actualizado en < 1 segundo

**Strava**
- OAuth con token guardado desde backend (service key)
- Sincronización automática + auto-marcado de sesiones
- FC, potencia, cadencia, desnivel en actividades
- Actividades visibles en Progreso + en system prompt del coach
- Sección Strava omitida del system prompt si no hay datos
- Solo disponible para usuarios Pro
- Strava: acceso con límite de 10 atletas conectados. Modelo de credenciales globales (env) es el definitivo. Per-user credentials descartado (junio 2026)

**Diseño**
- Dark theme premium, BottomNav fija SVG, headers sticky
- Skeleton screens, gráfico adherencia 7 días, typing indicator, fade-in mensajes
- Safe area iPhone, scroll reset al cambiar pestaña

**Monetización**
- Stripe live: checkout, webhook, email Pro, código promocional
- Strava bloqueado para Free
- Emails automáticos: renovaciones, tarjetas a punto de caducar, pagos fallidos

**Branding e infraestructura**
- Nombre: **TriCoach AI**
- Dominio: **getricoach.com** (Porkbun)
- App: **getricoach.com/app** + **app.getricoach.com**
- Landing: **getricoach.com**
- Email: **coach@getricoach.com** con forwarding a Gmail
- Analytics: Google Analytics GA4 (G-HKG9V6M7KF)
- SSL: activo vía Netlify
- CI/CD: automático desde GitHub → Netlify
- Beta badge flotante con enlace a Tally feedback
- Enlace "Reportar problema" en perfil y footer

**Emails y retención**
- `weekly-report.js` — informe dominical Pro + Free (upsell), URL corregida a app.getricoach.com
- `thursday-reminder.js` — recordatorio jueves 17h UTC a usuarios sin plan (scheduled)

**Macrociclos y sesiones estructuradas (training_cycles)**
- Tabla `training_cycles` en Supabase con fases BASE → BUILD → PEAK → TAPER
- Sesiones con estructura real: calentamiento / principal / vuelta a la calma, zona y RPE objetivo
- Sistema de prioridades A/B/C en las carreras del perfil — la carrera A define el ciclo
- Carrera B/C a <14 días → mini-taper / sesión de calidad en el plan semanal
- Recálculo automático de fases del ciclo al cambiar la carrera A (`recalculate-cycle.js`)
- Dashboard con "Semana X de Y · FASE" y timeline de fases en Progreso

**Intervals.icu (completo)**
- Wellness diario (HRV, ATL, TSB, sueño) inyectado en system prompt del coach
- Wellness usado en generate-plan para reducir carga si hay fatiga acumulada
- Plan generado sincronizado automáticamente con calendario Intervals (POST por sesión)
- IDs de eventos guardados en plans.intervals_event_ids
- Al desconectar: borrado de eventos en Intervals + limpieza en Supabase

**Multi-deporte y Strava**
- Fase 10.8 completada: diagnóstico multi-deporte, refresh token Strava en generate-plan, fallback deporteInfo
- Fase 11.1 completada: `strava-feedback.js` — feedback automático del coach tras sincronizar actividad (solo Pro, fire-and-forget)

**SEO**
- Google Search Console verificado ✅
- Sitemap enviado a Google ✅
- 8 páginas de contenido live:
  - `/entrenamiento-zona-2` — calculadora FC interactiva
  - `/plan-media-maraton` — calculadora de ritmo por 10K
  - `/preparar-primer-triatlon` — guía transiciones T1/T2
  - `/plan-entrenamiento-triatlon` — volúmenes por nivel y distancia
  - `/plan-entrenamiento-hyrox` — 8 estaciones + estimador de tiempo
  - `/maraton-valencia` — plan 16 semanas, diciembre 2026, IAAF Gold Label
  - `/maraton-madrid` — plan Rock 'n' Roll Madrid, evergreen, gestión desnivel y calor
  - `/maraton-barcelona` — plan Zurich Marató, evergreen, circuito costero y viento
- Sección "Guías gratuitas" en landing enlazando las 8 páginas
- Sitemap actualizado con las 3 URLs nuevas
- Links internos entre todas las páginas SEO
- Schema.org en landing y páginas de contenido

**Perfil**
- `EditProfile.jsx`: sección "Mis carreras" — ver, añadir y eliminar carreras desde el perfil

**Deuda técnica**
- Unificación de completar sesión (junio 2026): función canónica `completarSesion` en plans.js, eliminadas las dos implementaciones duplicadas, helpers de fechas Europe/Madrid en `lib/fechas.js`, fix del auto-import Strava del modal — 14 tests nuevos (169 totales)

**Fase 0 — Hardening generación de planes (junio 2026)** ✅
- Wellness compartido: umbrales ATL/TSB/HRV en `src/lib/wellness.js` + espejo CJS para functions, con test de paridad (coach y generador ya no pueden divergir en silencio)
- Generador con datos de rendimiento: fc_maxima, pace_5k, ftp_bici y peso inyectados en el prompt de generate-plan; `contexto` truncado a 500 chars como en el coach
- Idempotencia: generate-plan devuelve `{ ya_existe: true }` sin llamar a Claude si ya hay plan para la semana; `forzar: true` regenera con PATCH sobre la misma fila; migración 003 (UNIQUE user_id+semana, limpia 8 pares duplicados reales) escrita — ⚠️ PENDIENTE de ejecutar a mano en el SQL Editor
- strava-sync invocable server-side (`syncUsuario()` exportado) y recalculando `volumen_real_min` (deuda resuelta)
- Bugs del informe de flujo de datos corregidos: `activeCycle.fecha_carrera` inexistente → fecha real desde profile.carreras; wellness del generador con fecha Madrid en vez de UTC
- 16 tests nuevos (185 totales)

**Fase 1 — Generación automática semanal (junio 2026)** ✅
- `auto-plans.js` scheduled: lunes 03:00 UTC (04:00/05:00 Madrid, fuera de la ventana de peligro DST)
- Elegibles: Pro + training_cycle activo + no borrado; por usuario: syncUsuario (adherencia fresca) → generate-plan interno sin forzar (idempotente — si ya existe plan, coste cero)
- Camino interno de generate-plan (`x-internal-secret` / env `INTERNAL_API_SECRET`): email Resend "Tu plan de esta semana está listo 🏃" + limpieza de la nota semanal tras consumirla
- Card "Notas para la próxima semana" en WeeklyPlan → `profiles.contexto_proxima_semana` (migración 004 aplicada ✅)
- Migraciones 003 y 004 ejecutadas y verificadas en producción; `INTERNAL_API_SECRET` creada en Netlify
- Prueba end-to-end verificada (10 jun): smoke `ya_existe` en prod + orquestador local → plan real generado + email entregado con HTML renderizando correcto en bandeja real
- `lib/fechas.js` CJS (lunes Madrid testeado en verano/invierno y bordes DST) + `lib/email.js` reutilizable
- 16 tests nuevos (201 totales)

**Bugs resueltos**
- BUG-01: getMondayOfCurrentWeek fallaba el domingo
- BUG-02: handleAjustar sin feedback de error
- BUG-03: planSiguiente no se sincronizaba por Realtime
- BUG-04: RPE previo persistía entre sesiones
- BUG-05: doble confirmación de ajuste enviaba mensaje al coach
- BUG-06: coach mencionaba Strava a usuarios sin datos
- BUG-07: token Strava expirado causaba error silencioso

---

## 🔴 PENDIENTES INMEDIATOS

**A — Strava Developer Program** 🟡
- Límite actual ampliado a 10 atletas conectados (suficiente para el lanzamiento cerrado)
- Para escalar más allá de 10: pendiente aprobación del Developer Program


---

## 📅 ROADMAP

### AHORA — Lanzamiento cerrado
- 25 usuarios iniciales, recoger feedback 2-3 semanas
- Revisar modelo de negocio con datos reales

### FASE 10.8 — Multi-deporte ✅
- Varios deportes y pruebas en el mismo perfil
- Coach compagina disciplinas según proximidad de cada carrera

### FASE 11.1 — Feedback automático post-entreno ✅
- `strava-feedback.js`: cuando se sincroniza actividad Strava, el coach genera feedback automático
- Análisis de la sesión vs plan, tono conversacional, solo Pro, fire-and-forget

### FASE 11.2 — Informe semanal automático por email ✅
- `weekly-report.js`: cada domingo 19h UTC, email con adherencia y resumen semanal
- Pro: informe completo con tabla sesión por sesión + mensaje del coach
- Free: resumen con % adherencia + bloque de upsell a Pro

### FASE 12 — Integraciones avanzadas
- Comentario automático del coach tras sincronizar sesión Strava (Pro)
- Intervals.icu sincronización (Pro) ✅
- Zonas FC y potencia avanzadas desde Strava

### FASE 13 — App móvil
- React Native + Expo, Login con Apple
- Notificaciones push, App Store + Google Play

### FASE 14 — Módulo de Eventos ⭐
**Validar con MTB junio antes de construir**
- Organizador paga 150-300€ + atletas 5-10€ plan personalizado
- GPX → análisis IA → página evento → planes → comunidad → clasificación Strava
- Tablas: events, event_participants, event_results, segments, segment_results

### FASE 15 — SEO avanzado
- Páginas de carreras populares: "Plan para Maratón de Valencia", "Plan para Media Maratón de Madrid"
- Generación automática desde GPX de eventos
- Calculadora de ritmo por carrera específica

### FASE 16 — Marketing y crecimiento
- Personajes animados por estilo de coach
- Modo voz, analytics avanzados, automatizaciones
- Notificación "Planifica la próxima semana" cada jueves
- Programa de referidos

---

## 🗄️ Schema Supabase

**profiles:** id, email, nombre, nombre_coach, deporte, nivel, objetivo, fecha_carrera,
carreras (jsonb), historial_deportivo, lesiones, disponibilidad, equipamiento (jsonb),
plan, stripe_customer_id, messages_today, last_message_date,
ajustes_hoy, ultima_fecha_ajuste, personalidad, contexto, onboarding_visto,
strava_token, strava_refresh_token, strava_token_expires_at,
intervals_athlete_id, intervals_api_key, created_at

**messages:** id, user_id, role, content, created_at
**plans:** id, user_id, semana, sesiones (jsonb), created_at

---

## 🔧 Stack técnico
- Frontend: React + Vite (JS, no TS)
- DB + Auth: Supabase (+ Realtime)
- Backend: Netlify Functions (CommonJS — siempre require/exports.handler)
- Modelo IA: claude-sonnet-4-20250514
- Pagos: Stripe live
- Email: Resend (coach@getricoach.com)
- Dominio: getricoach.com (Porkbun) → Netlify
- Analytics: Google Analytics GA4 (G-HKG9V6M7KF)
- Tests: Vitest (125) + Playwright E2E
- Claude Code v2.1.73 + everything-claude-code + UI UX Pro Max skill

---

## 📋 ESTRATEGIA DE ADQUISICIÓN

**SEO (principal canal a largo plazo)**
- 8 páginas live, indexadas en Google Search Console
- Maratón Valencia, Madrid y Barcelona ya publicadas y enlazadas desde landing
- Keywords objetivo: "entrenador triatlón online", "plan entrenamiento running IA", "coach Hyrox español"

**Comunidad (canal de validación)**
- Grupos Facebook: WooCommerce ES, running España, triatlón España
- Strava Clubs: presencia en clubs de running/triatlón hispanohablantes
- WhatsApp: grupos de corredores y triatletas locales

**Eventos (canal futuro)**
- Módulo de eventos como motor de crecimiento orgánico
- Cada carrera integrada = página SEO + comunidad de atletas
- Loop: evento → página → atletas → usuarios → más eventos
