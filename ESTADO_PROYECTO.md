# TriCoach AI — Estado del Proyecto
_Actualizado: 6 de mayo 2026_

---

## ✅ Completado

### Infraestructura macrociclo
- Tabla `training_cycles` en Supabase (migración aplicada en producción)
- Columnas nuevas en `plans` (cycle_id, numero_semana, fase, objetivo_semana, volúmenes)
- Columnas nuevas en `profiles` (fc_maxima, pace_5k, pace_10k, ftp_bici, ritmo_natacion_100m, active_cycle_id)
- `src/lib/cycles.js` — calcularFases, getFaseActual, esSemanaDescarga, getNumeroSemana
- `netlify/functions/create-cycle.js` — idempotente, soporta ciclo con y sin carrera
- `App.jsx` — crea o carga ciclo activo al arrancar, pasa `activeCycle` a Dashboard, Chat y Progreso

### Sesiones con estructura real
- `generate-plan.js` — nuevo schema (calentamiento, principal, vuelta a la calma, zona_objetivo, distancia_km, rpe_objetivo)
- `generate-plan.js` — guarda cycle_id, numero_semana, fase, objetivo_semana, volumen_planificado_min
- `generate-plan.js` — contexto de macrociclo inyectado en el prompt a Claude
- `adjust-plan.js` — migra sesiones antiguas al nuevo formato antes de ajustar
- `WeeklyPlan.jsx` — cards expandibles con 3 bloques de estructura
- `ModalCompletarSesion.jsx` — RPE visual, tiempo real, distancia, FC, notas
- Auto-regeneración de planes en formato antiguo al cargar la app

### Coach con contexto completo
- `buildSystemPrompt.js` — sección MACROCICLO con fase, semana X/Y, adherencia, RPE medio, volumen anterior
- `buildSystemPrompt.js` — zonas calculadas desde fc_maxima, pace_5k, ftp_bici del perfil
- `claude.js` — pasa activeCycle al buildSystemPrompt

### UI actualizada
- Dashboard — barra "Semana X de Y · FASE BASE" con barra de progreso
- Progreso — timeline horizontal BASE → BUILD → PEAK → TAPER con indicador "← aquí"
- WeeklyPlan — cabecera con objetivo de la semana (SEM 1 · BASE)
- Perfil — sección "⚡ Datos de rendimiento" con FC, paces, FTP, natación

### Flujo de usuario
- Onboarding → Chat con mensaje de bienvenida del coach → genera plan automáticamente
- Auto-relleno del modal de completar sesión con datos de Strava (strava-match-activity.js)
- Bug corregido: scroll negro en Perfil en Safari (transform GPU + sticky)

### Calidad
- 100 tests pasando
- CLAUDE.md actualizado con regla de git push obligatorio tras cada commit
- SPEC.md y PROMPTS_CLAUDE_CODE.md en el repo

### Strava
- Email enviado a developers@strava.com con 3 capturas (28 abril 2026)

### Duraciones mínimas por fase
- `validarDuracion(sesion, fase)` implementada en `generate-plan.js` línea 424
- Aplicada post-generación sobre todas las sesiones (línea 924-928)
- Minimos: base Correr 55min, Bici 80min / build Correr 65min, Bici 90min / etc.

### Sistema A/B/C de carreras
- Campo `prioridad: 'A' | 'B' | 'C'` soportado en el array `carreras` del perfil
- `create-cycle.js` — selecciona carrera A como objetivo del ciclo
- `generate-plan.js` — detecta carrera B/C en <14 días y aplica mini-taper / sesión de calidad
- Tests en `src/test/race-priority.test.js`

### Recalcular ciclo al cambiar carrera
- `netlify/functions/recalculate-cycle.js` — recalcula fases desde la semana actual
- Tests en `src/test/recalculate-cycle.test.js`

### Ciclo genérico completado → renovar
- `esCicloCompletado()` en `src/lib/cycles.js`
- Llamada en `App.jsx` al cargar el ciclo activo
- UI: `src/components/CicloCompletadoBanner.jsx` con botón "Empezar nuevo ciclo"
- Tests en `src/test/ciclo-completado.test.js`

---

## 🔴 Pendiente prioritario

### Strava pendiente de aprobación
Email enviado el 28 de abril. Esperar respuesta (3-10 días laborables).
Si no responden antes del 12 de mayo → reenviar con vídeo demo.

---

## 🟡 Mejoras menores pendientes

- **Strava modal sin timeout** — `ModalCompletarSesion.jsx`: el fetch a `strava-match-activity` no tiene límite de tiempo. Si Strava tarda >5s, el spinner "Buscando en Strava..." no se detiene. Solución: añadir `setTimeout` de 5s que llame a `controller.abort()`.
- **Pantalla Progreso — consistencia** — muestra "5% consistencia" con datos de test. Revisar el cálculo cuando haya datos reales de usuarios.
- **pace_5k y FTP en onboarding** — ahora solo aparecen en la pantalla de Perfil. Valorar añadirlos como campos opcionales en el onboarding paso 4.

---

## 📋 Próximos sprints

**Sprint actual** → Strava aprobación + mejoras menores
**Sprint 2** → Strava integración completa (cuando se apruebe)

## 🔎 SEO y captación — estado a 6-nov-2026 (informe completo: `tasks/seo-informe-2026-11-06.md`)

**Hecho (en producción):** guías de maratón rescatadas del 404 (estaban bajo /app/), redirects canónicos, robots.txt, sitemap con lastmod (14 URLs), llms.txt, IndexNow (14 URLs enviadas), verificación de Bing (`static/BingSiteAuth.xml`), schema (Article, BreadcrumbList, FAQPage), imagen OG, 5 guías nuevas (5K, 10K, primer maratón, calculadora de ritmo, natación), landing con precios reales (14,99 €/119 €, prueba 7 días, 20 msg Pro). Search Console: sitemap enviado y indexación solicitada. GA4: `sign_up`, `onboarding_complete`, `first_plan_generated` marcados como eventos clave. Bing: sitio verificado y sitemap enviado.

**Pendiente (por orden de impacto):**
1. **Login.jsx**: mostrar "7 días de prueba Pro sin tarjeta" y 3 puntos de valor bajo el botón de Google (hoy solo hay un botón). Cambio de mayor impacto esperado en conversión; toca la app.
2. **GA4**: marcar `begin_checkout`, `upgrade_success` (y `strava_connected`) como eventos clave cuando salten por primera vez (pestaña "Eventos recientes").
3. **Revisar resultados** ~13-16 nov: Search Console (Páginas indexadas, consultas nuevas) y Bing; si alguna URL no se indexa, mirar el motivo.
4. **Ads y redes** (material en el informe): 10 posts, 3 campañas (Google búsqueda, Meta, retargeting/marca). Presupuesto sugerido ≈ 150-200 € + 70-110 € + 90 €/mes. Lanzar solo con `sign_up` medido en GA4.
5. **Stripe Customer Portal** enlazado desde el perfil (hoy la cancelación es por email a coach@getricoach.com; la FAQ lo dice).
6. Más guías de intención alta: Hyrox por estaciones, recuperación, bici para triatlón, zonas de FC, página /precios.
7. Reescribir las guías de maratón con fechas verificadas (la de Valencia habla de dic-2026 y un plan de 16 semanas que ya no cabe).
8. Fuentes/LCP y enlaces entrantes (directorios, foros, clubs de Strava).
9. Comprobar que `app.getricoach.com` (callback de Strava) no crea cadenas de redirects hacia `getricoach.com/app`.

**Cómo añadir una guía:** crear `<slug>.html` en la raíz (build-static.js la copia sola), y añadirla a `sitemap.xml`, `netlify.toml` (par de redirects) y `static/llms.txt`.

## 💶 Ventas — estado a 11-nov-2026 (plan completo: `tasks/plan-ventas.md`)

**Hecho (rama `ventas/embudo-pago`):** vuelta a la app tras pagar (antes iba a la landing y no se medía la venta), error visible si el checkout falla, oferta de Pro también durante la prueba, aviso de fin de prueba, login con propuesta de valor, textos falsos corregidos ("150 mensajes"), formulario obsoleto de credenciales de Strava eliminado. Con esto queda hecho el pendiente SEO nº 1 (Login.jsx).

**Hecho (rama `ventas/emails-portal-cron`, 12-nov):** portal de Stripe en el perfil, emails de bienvenida Pro y fin de prueba, cron de planes semanales (Pro y prueba Pro), email único de recuperación a las 27 altas con onboarding y sin plan (13-nov), `trial_ends_at` protegido en base de datos.

**Para que funcione hace falta (Lucas):** aplicar la migración 007 en Supabase, crear `EMAILS_ENABLED=true` y `CRONS_ENABLED=true` en Netlify, activar el portal de clientes en Stripe.

**Pendiente:** ampliación del límite de Strava (5 de 10 plazas ocupadas), lanzar campañas y posts del informe SEO, borrar `recuperacion-altas` después del 20-nov.

## 📸 Producto sin Strava — 12-nov-2026 (rama `producto/captura-sin-strava`)

Strava prohíbe usar sus datos con IA (API Policy §5.3, jun-2026). Decisión: mantener a los conectados, cerrar conexiones nuevas y dejar de venderlo. El sustituto es la **captura del entreno** en "completar sesión" (el coach lee duración, distancia y pulso y comenta frente al plan). Landing, guías, modal Pro, avisos y emails reescritos sin Strava.

**Pendiente:** probar la lectura con capturas reales de Garmin/COROS/Apple; recordatorio el día de la sesión (email o WhatsApp); app nativa con Apple Health / Health Connect como fuente automática.

## ⭐ Pro con beneficios — 12-nov-2026 (rama `producto/pro-con-beneficios`)

Free: 2 capturas de entreno por semana. Pro (y prueba): capturas sin tope semanal, plan nuevo cada lunes, revisión semanal los domingos, modelo avanzado y 20 mensajes. Requiere aplicar la migración 008 en Supabase.

**Pendiente:** revisar el número de capturas de Free cuando haya volumen; recordatorio el día de la sesión.
