# Análisis de flujo de datos — perfil / Strava / Intervals / plan / ciclos / coach

> Fecha: 9 junio 2026 · Solo análisis — sin cambios de código.
> Archivos trazados: `generate-plan.js`, `buildSystemPrompt.js`, `Chat.jsx`, `App.jsx`, `Dashboard.jsx`, `strava-sync.js`, `weekly-report.js`, `netlify.toml`, `src/lib/plans.js`.

---

## 1. GENERACIÓN DE PLAN — inputs exactos de `generate-plan.js`

### Del perfil (SELECT en línea 575)
`deporte, nivel, objetivo, fecha_carrera, contexto, strava_token, strava_refresh_token, strava_token_expires_at, plan, created_at, deportes, carreras, intervals_athlete_id, intervals_api_key`

- `profile.contexto` se inyecta **entero, sin truncar** (línea 823) — a diferencia del coach, que lo trunca a 500 chars. Sí incluye la advertencia de "ignora datos temporales".
- ⚠️ **NO selecciona** `fc_maxima`, `pace_5k`, `ftp_bici`, `peso`, `edad` — el generador no ve los datos de rendimiento del atleta salvo lo que esté escrito en `contexto` (ver §3).
- `carreras` (jsonb): ordena por fecha, usa la más próxima para calcular la fase (`calcularMetodo`), detecta carrera B/C a <14 días (mini-taper / sesión de calidad).

### Del ciclo activo (`training_cycles`, estado=active)
- `numero_semana` (desde `fecha_inicio`), `fase actual` (de `fases[]`), semana de descarga (`numero % 4 === 0`, salvo taper).
- Inyecta: bloque MACROCICLO con duraciones mínimas obligatorias por fase + `validarDuracion()` como safety-net post-generación.
- ⚠️ Bug menor: el prompt referencia `activeCycle.fecha_carrera` (línea 794) — esa columna **no existe** en el schema de `training_cycles` → siempre vacío.
- Sin ciclo activo: `numero_semana` se estima desde `profile.created_at`.

### De Strava (solo Pro + token)
- Fetch **directo a la API de Strava en el momento de generar** (`/athlete/activities?per_page=7`, usa 5), con refresh de token automático que persiste en profiles.
- Formato pobre: `"Run 8.2km en 45min, ..."` — sin FC, sin zonas, sin desnivel (el coach recibe mucho más, ver §3).
- NO lee de la DB las sesiones marcadas `via_strava`.

### De Intervals.icu (solo Pro + credenciales)
- Fetch directo del wellness de **hoy** con timeout 5s, no bloqueante.
- ⚠️ "Hoy" se calcula con `toISOString().slice(0,10)` (línea 614) = fecha **UTC**, no Madrid — de madrugada pide el wellness del día anterior. (El coach usa el mismo endpoint vía `intervals.js`.)
- Umbrales: ATL>50, TSB<-20, HRV<40 → instrucción de reducir volumen 15-20% y evitar intensidad.

### Del plan anterior y adherencia — NO genera "en frío"
- Carga los **3 planes más recientes**; `planAnteriorEfectivo` = el más reciente con `semana < weekStart` (o el `planAnterior` del body).
- `buildAnalisisSemanaAnterior()`: completadas/total, **RPE medio real** (rpe ?? rpe_usuario), sesiones saltadas, resumen de Strava, reglas de progresión (+5-10%, descarga cada 4ª, si RPE>7 o adherencia<60% → -15% carga).
- `adherenciaPct` sobre los 3 planes recientes — pero **solo se inyecta dentro del bloque macrociclo**; sin ciclo activo, la adherencia agregada no llega al prompt (el análisis de semana anterior sí).
- Caso especial: primer plan + <3 actividades Strava → **semana de diagnóstico** (tests por deporte, sin Claude "libre": agenda fija de tests).
- Input manual: `contexto_semana` (modal "Generar con contexto" del frontend) — tiene prioridad en el prompt.

**Conclusión §1:** usa adherencia y RPE reales de la semana anterior leídos de la DB — la calidad depende de que esas sesiones estén marcadas, que es el eslabón débil (§2).

---

## 2. FRESCURA DE DATOS — cuándo se sincroniza Strava

| Trigger | Dónde | Cuándo |
|---|---|---|
| `strava-sync` automático | `App.jsx:94-111` | **Una vez por sesión de app** (ref guard), al arrancar con plan + token |
| `strava-sync` manual | `Dashboard.handleStravaSync` | Botón del usuario |
| `strava-match-activity` | `ModalCompletarSesion` | Al abrir el modal de completar (pre-rellena datos) |
| `strava-feedback` | disparado por `strava-sync` | Fire-and-forget tras sincronizar (Pro) |

**Asimetría clave:**
- Las **actividades** que ve el generador están siempre frescas (fetch directo a la API de Strava al generar, aunque el usuario no haya abierto la app en días).
- La **adherencia** (sesiones `completada`/RPE del plan anterior) vive en la DB y **solo se actualiza cuando el usuario abre la app** (sync de App.jsx) o completa manualmente.

→ Si el usuario entrena pero no abre la app, `generate-plan` verá "0 completadas de N" y aplicará la regla de reducción de carga (-15%) **injustificadamente**, aunque el texto de Strava muestre actividades. Hoy esto casi nunca pasa porque la generación es manual (el usuario está en la app al generar, y el sync de App.jsx acaba de correr). Con generación automática se convierte en el riesgo nº 1 (§5a).

Wellness: siempre fresco (API directa en el momento), con el matiz UTC señalado.

---

## 3. COACH vs GENERADOR — qué sabe cada uno

El coach se monta en `Chat.jsx:154`: `buildSystemPrompt(profile, personalidad, stravaData, plan, planProximaSemana, historialPlanes, activeCycle, wellnessData)`. Sus datos llegan por fetch al montar el chat: `strava-activities` (con AbortController) e `intervals?action=wellness`.

### Solo lo tiene el COACH
| Dato | Detalle |
|---|---|
| **Datos de rendimiento** | `fc_maxima`, `pace_5k`, `ftp_bici`, `peso` (zonas FC, ritmos, nutrición) — el generador ni los selecciona |
| **Strava rico** | FC media, %FCmax, zona por actividad, alerta sobreentrenamiento Z2 (vía `strava-activities`) |
| Historial 4 semanas con tendencia | adherencia/RPE por semana + tendencia textual + alerta fatiga |
| Plan próxima semana | y advertencia de no mezclarlos |
| Personalidad + nombre del coach | el generador usa un system prompt genérico (razonable) |
| Estado de cada sesión | etiquetas "✓ completada (manual/Strava)", "[HOY]", "[pasado - no realizada]" |

### Solo lo tiene el GENERADOR
| Dato | Detalle |
|---|---|
| **Duraciones mínimas por fase** + `validarDuracion()` | El coach no las conoce → puede recomendar duraciones que el generador luego "corregiría" — fuente de incoherencia coach↔plan |
| Reglas de progresión cuantificadas | +5-10%, descarga cada 4ª semana, reglas RPE/adherencia |
| `contexto_semana` puntual | input del modal de generación |
| Detección carrera B/C a 14 días | el coach tiene "modo taper" genérico a 14 días de la carrera próxima, sin distinguir prioridad A/B/C |

### Duplicación / inconsistencias entre ambos caminos
1. **`profile.contexto`**: coach trunca a 500 chars (regla de CLAUDE.md); generador lo inyecta sin truncar.
2. **Wellness**: dos implementaciones del mismo fetch (generate-plan inline vs `intervals.js`); umbrales ATL/TSB/HRV duplicados en ambos prompts (hoy coinciden: 50/-20/40 — divergirán silenciosamente si alguien toca uno).
3. **Strava**: dos formatos distintos de las mismas actividades (rico vs pobre).
4. **Fase del ciclo**: el generador la calcula con `numeroSemana` sobre `weekStart`; el coach la recalcula por su cuenta sobre "hoy" (`buildSystemPrompt:384`) — en el límite de semana pueden discrepar.
5. **deporteInfo** y `DIA_OFFSET_MAP` copiados en ambos (la copia de buildSystemPrompt es deliberada — CLAUDE.md).

---

## 4. GENERACIÓN AUTOMÁTICA SEMANAL — qué haría falta (evaluación, sin implementar)

### Patrón existente en el proyecto
- Ya hay 2 scheduled functions en `netlify.toml`: `weekly-report` (`0 19 * * 0`) y `thursday-reminder` (`0 17 * * 4`). Patrón: handler sin secret (lo invoca Netlify), `for...of` **secuencial** sobre profiles, sin llamadas a Claude (emails templados con Resend).
- El frontend ya tiene auto-generación parcial: `WeeklyPlan.jsx:93-99` genera la semana siguiente si todas las sesiones están completadas y es jueves o más tarde — pero requiere que el usuario abra la app.

### Arquitectura: una invocación por usuario, no un loop
- `generate-plan` tarda hasta 30s por usuario (timeout interno de Claude). El límite de Netlify Functions síncronas es ~26s (lessons.md) — **un loop secuencial estilo weekly-report NO cabe** ni para 2 usuarios.
- Opciones:
  - **(a) Orquestador + fan-out**: scheduled function ligera que lista elegibles y dispara un POST a `/.netlify/functions/generate-plan` por usuario (con `x-tricoach-secret`), en lotes pequeños con await (no fire-and-forget, ver riesgo §5e). Reutiliza generate-plan sin tocarlo. Con pocos usuarios (lanzamiento cerrado, ≤25) bastan 2-3 lotes.
  - **(b) Background Function** (`generate-weekly-plans-background`): hasta 15 min de ejecución, podría hacer el loop secuencial completo. Más simple de razonar, pero pierde el paralelismo y es un patrón nuevo en el proyecto.
  - La opción (a) es la más alineada con lo que ya existe.

### Timezone — dónde está el riesgo de bug
- El cron de Netlify corre en **UTC**; `plan.semana` es el **lunes en Europe/Madrid**. Madrid = UTC+1 (invierno) / UTC+2 (verano) → la misma hora UTC cae una hora distinta de Madrid según la época.
- `getMondayOfCurrentWeek()` (generate-plan:17) ya es Madrid-aware y correcto **siempre que cuando corra el cron ya sea lunes en Madrid**.
- ⚠️ Zona de peligro: programar el cron en la ventana **domingo 22:00–23:59 UTC**: en verano ya es lunes en Madrid pero en invierno aún es domingo → `getMondayOfCurrentWeek()` devolvería el lunes ANTERIOR y se regeneraría la semana pasada. Lo seguro: lunes ≥02:00 UTC (es lunes en Madrid todo el año, p.ej. `0 4 * * 1`), o correr el domingo pasando `fechaInicio` = lunes siguiente explícito (como hace el frontend con `getNextWeekStart`).
- Segundo punto UTC: el wellness de generate-plan usa fecha UTC (§1) — a las 04:00 UTC del lunes pediría wellness del lunes (correcto); no agrava.

### Idempotencia — hoy NO existe en el server
- `generate-plan` hace `POST /plans` **sin comprobar si ya existe** plan para ese `user_id + semana`. Hoy lo mitiga el frontend (`handleGenerarSiguiente` consulta `getPlanForWeek` antes). Un cron con retry o doble disparo crearía **planes duplicados** — y `getPlanActual()` resolvería uno arbitrario (order semana desc, no created_at).
- Haría falta: check server-side "ya existe plan para weekStart → no-op" (y/o constraint UNIQUE `(user_id, semana)` en Supabase, que además protegería el flujo manual).

### Usuarios elegibles — decisión de producto pendiente
- Mínimo: `deleted_at is null` + tiene perfil completo (deporte/nivel).
- ¿Solo con ciclo activo? El plan se puede generar sin ciclo (usa `created_at` como fallback) — pero el ciclo da fase y duraciones; sin ciclo el plan es más pobre.
- ¿Pro y Free? El modelo Free incluye "1 plan/semana" → generación automática semanal es compatible con Free. Coste: ver abajo. Alternativa conservadora: automático solo Pro, Free sigue manual (palanca de upsell).
- Usuarios nuevos sin plan previo: entrarían por la rama de diagnóstico automáticamente (correcto), pero ojo con los que se registran a mitad de semana (el cron del lunes les generaría semana completa; hoy el flujo manual usa `startDate = hoy`).

### Coste por usuario y por semana
- **1 llamada a Claude por generación** (Sonnet, max_tokens 3000, prompt ~2-4K tokens) — la única del flujo.
- No hay llamadas extra: el diagnóstico es la misma llamada; `validarDuracion` es local; el sync de Intervals no usa Claude.
- Llamadas que hoy acompañan a la generación manual y NO ocurrirían en automático: `coach-intro` (mensaje de bienvenida del coach tras el primer plan — 1 llamada Claude, solo primer plan).
- Orden de magnitud: N usuarios elegibles × 1 llamada/semana. Con 25 usuarios: 25 llamadas Sonnet/semana — coste marginal.

---

## 5. RIESGOS — qué rompería con generación automática

**(a) Adherencia obsoleta → reducción de carga injustificada (el más grave).**
El análisis de la semana anterior lee `completada`/RPE de la DB, que solo se actualiza al abrir la app (§2). Generando en cron del lunes de madrugada, los usuarios que no abrieron la app el fin de semana aparecerán con adherencia baja → la regla "completadas < 60% → reducir carga 15%" degradaría sus planes sistemáticamente. Mitigación conceptual: el orquestador debería invocar `strava-sync` (ya existe, server-side) por usuario **antes** de generar — para usuarios con Strava; los manuales seguirían expuestos.

**(b) Sin idempotencia server-side** → planes duplicados ante retry/doble cron (§4). Hoy depende 100% del frontend.

**(c) Pasos interactivos que se pierden:**
- `contexto_semana` (modal "Generar con contexto") — no existe en automático; el usuario perdería la vía de avisar "esta semana viajo".
- `coach-intro` tras el primer plan — no se dispararía.
- El toast/banner de plan generado — el usuario descubriría el plan sin aviso (habría que apoyarse en `thursday-reminder`/email o push).

**(d) Fire-and-forget en serverless** — el sync de Intervals tras generar (`syncIntervalsCalendar` sin await) depende de que la lambda no se congele tras el `return`. En invocación HTTP ya es frágil; en un orquestador que dispara N generate-plan "fire-and-forget" el problema se multiplica: el orquestador debe **await** sus fetches (en lotes) o las generaciones pueden morir a medias.

**(e) Rate limit de Strava** — el cron concentra en minutos N × (refresh token + GET activities) (+ strava-sync previo si se añade). Límite de app Strava: 100 req/15min. Con ≤10 atletas conectados (límite actual) no es problema; al escalar habría que espaciar lotes.

**(f) Carrera de tokens Strava** — strava-sync y generate-plan refrescan el mismo token; ejecutados en secuencia inmediata por el orquestador pueden pisarse el refresh (Strava invalida el refresh token anterior al rotarlo). Mitigación: orden estricto sync → generate por usuario, no en paralelo para el mismo usuario.

**(g) Menores ya señalados:** `activeCycle.fecha_carrera` inexistente en schema (§1); wellness con fecha UTC (§1); divergencia de umbrales wellness duplicados coach/generador (§3); el cálculo de fase coach vs generador puede discrepar en el límite de semana (§3).

---

## Mapa-resumen

```
profiles ──────────────┬──> generate-plan.js ──> plans (POST, sin idempotencia)
  (sin fc_max/pace/ftp)│       ▲    ▲    ▲           │
training_cycles ───────┤       │    │    │           ├──> Intervals calendar (fire-and-forget)
Strava API (directo) ──┤    plan anterior │           └──> frontend (App.jsx onPlanUpdate)
Intervals wellness ────┘    (3 últimos,  contexto_semana
  (fecha UTC)                adherencia DB)  (manual)

profiles (completo) ───┬──> Chat.jsx ──> buildSystemPrompt ──> claude.js ──> coach
strava-activities ─────┤      (al montar el chat)
intervals?wellness ────┤
plan + próxima semana ─┤
historial 4 semanas ───┤
activeCycle ───────────┘

strava-sync: App.jsx (1×/sesión) | botón Dashboard | → strava-feedback (Pro)
            └──> marca completada/via_strava en plans (sin recalcular volumen_real_min)
```
