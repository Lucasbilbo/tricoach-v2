# TriCoach AI — Estado del Proyecto
_Actualizado: 28 de abril 2026_

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

---

## 🔴 Pendiente prioritario

### 1. Duraciones de sesiones — URGENTE
Las sesiones generadas siguen saliendo con 45min (el mínimo). El prompt a Claude
tiene las duraciones mínimas pero no las está respetando correctamente.
Hay que reforzar el prompt con ejemplos concretos y validación post-generación.

**Prompt para Claude Code:**
```
En generate-plan.js, las sesiones se están generando con duraciones de 45min
cuando deberían ser más largas según la fase.

1. Añadir validación post-generación: después de parsear el JSON de Claude,
   comprobar que cada sesión activa (no descanso) cumple la duración mínima
   según fase y tipo. Si no la cumple, corregirla al mínimo.

2. Reforzar el prompt añadiendo ejemplos concretos:
   "Ejemplos de duraciones correctas para fase BASE:
   - Rodaje Z2: 55-70min (NO 45min)
   - Rodaje largo: 80-110min
   - Bici Z2: 80-120min
   - Intervalos: 60-75min (incluye calentamiento y vuelta a la calma)"

3. Función de validación:
   function validarDuracion(sesion, fase) {
     const minimos = {
       base: { 'Correr': 55, 'Bici': 80, 'Nadar': 45, 'Fuerza': 50 },
       build: { 'Correr': 65, 'Bici': 90, 'Nadar': 55, 'Fuerza': 55 },
       peak: { 'Correr': 70, 'Bici': 100, 'Nadar': 60, 'Fuerza': 55 },
       taper: { 'Correr': 35, 'Bici': 50, 'Nadar': 35, 'Fuerza': 40 },
     }
     const min = minimos[fase]?.[sesion.tipo] || 45
     return Math.max(sesion.duracion_min, min)
   }

npm test && npm run build && git add . && git commit -m "fix: enforce minimum session durations by phase" && git push origin main
```

### 2. Sistema A/B/C de carreras
Añadir campo `prioridad: 'A' | 'B' | 'C'` al array de carreras del perfil.
- Carrera A: taper completo 2 semanas
- Carrera B: mini-taper 4-5 días
- Carrera C: sin taper, sesión de calidad

Afecta a: onboarding paso 4, editar perfil, generate-plan.js

### 3. Recalcular ciclo si cambia la carrera objetivo
Si el usuario edita la fecha de su carrera A en el perfil:
- Detectar el cambio
- Recalcular las fases del ciclo activo desde la semana actual
- Actualizar training_cycles en Supabase
- Notificar al usuario: "He actualizado tu plan de temporada"

### 4. Ciclo genérico completado → renovar
Cuando un ciclo sin carrera llega a la semana 16:
- Mostrar mensaje: "Tu ciclo de 16 semanas ha terminado. ¿Empezamos otro?"
- Botón "Nuevo ciclo" → crear nuevo ciclo desde hoy
- No renovar automáticamente sin confirmación

### 5. Strava pendiente de aprobación
Email enviado el 28 de abril. Esperar respuesta (3-10 días laborables).
Si no responden antes del 12 de mayo → reenviar con vídeo demo.

---

## 🟡 Mejoras menores pendientes

- El bloque principal de las sesiones no muestra el contenido expandido en algunos casos (solo título)
- El "Buscando en Strava..." del modal no tiene timeout — si Strava tarda >5s, el usuario espera sin feedback
- La pantalla de Progreso muestra "5% consistencia" con datos de test — revisar el cálculo cuando haya datos reales
- Añadir pace_5k y FTP como campos opcionales en el onboarding paso 4 (ahora solo están en Perfil)

---

## 📋 Próximos sprints

**Sprint actual** → fix duraciones (urgente)
**Sprint 2** → Sistema A/B/C de carreras
**Sprint 3** → Recalcular ciclo al cambiar carrera + ciclo completado
**Sprint 4** → Strava integración completa (cuando se apruebe)
