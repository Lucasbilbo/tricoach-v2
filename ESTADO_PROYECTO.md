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
