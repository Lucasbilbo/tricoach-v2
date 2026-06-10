# Lecciones aprendidas

## 2026-04-01 — Auditoría de calidad completa

### BUG CRÍTICO — strava-auth.js no validaba x-tricoach-secret
**Problema:** Todas las Netlify Functions validan `x-tricoach-secret`, pero `strava-auth.js` había omitido esta comprobación desde su creación. Cualquier llamada externa podía triggear el OAuth de Strava.
**Fix:** Añadido bloque de validación del secreto al inicio del handler, igual que en todas las demás funciones.
**Lección:** Al crear una nueva función, usar siempre el template estándar que incluye validación de secreto como primer bloque.

### BUG — strava-activities.js tenía doble `if` redundante (dead code)
**Problema:** Después de `if (!refreshResult?.access_token) { return sinStrava }`, había otro `if (refreshResult && refreshResult.access_token)` que siempre era verdadero — nunca podía ser falso porque el return anterior ya lo descartaba. Era código confuso sin efecto real.
**Fix:** Eliminado el segundo `if`, el código se ejecuta directamente tras el early return.
**Lección:** Revisar que los early returns no dejen ramas siempre-verdaderas más abajo.

### BUG — adjust-plan.js: deporte `natacion` no estaba en deporteInfo
**Problema:** El mapa `deporteInfo` en `adjust-plan.js` tenía claves para `triatlon`, `running` y `hyrox`, pero no para `natacion`. Los usuarios nadadores recibían el prompt con "deporte de resistencia" en lugar de "natación" al ajustar su plan.
**Fix:** Añadido `natacion: 'natación'` al objeto `deporteInfo`.
**Lección:** Cuando se añada un deporte nuevo (o se copie código entre funciones), verificar que los mapas estáticos cubren todos los deportes soportados.

### CALIDAD — Console.logs de debug expuestos en producción
**Problema:** `Chat.jsx` tenía 3 console.logs de desarrollo, y `strava-activities.js` tenía un `STRAVA_DEBUG` log que imprimía el timestamp del token y si estaba expirado. `strava-auth.js` logueaba los primeros 8 caracteres del token de Strava.
**Fix:** Eliminados todos. El único log que queda en funciones backend es `console.error` en casos de error real.
**Lección:** Los console.log de depuración deben eliminarse antes de commit. Usar `console.error` solo para errores reales.

### CALIDAD — context.js enviaba campo `model` ignorado por el backend
**Problema:** `context.js` enviaba `model: 'claude-sonnet-4-20250514'` en el body del fetch a `claude.js`. El backend filtra y elimina ese campo (`const { model: _m, ... } = parsed`), así que nunca llegaba a Anthropic. Código muerto que generaba confusión.
**Fix:** Eliminado el campo `model` del body de `context.js`.
**Lección:** El modelo en `claude.js` es deliberadamente fijo — el frontend no puede sobreescribirlo.

### CALIDAD — useEffect de Strava en Chat.jsx sin cleanup
**Problema:** El `useEffect` que llama a `strava-activities` no tenía AbortController. Si el usuario navegaba a otra pantalla antes de que terminara el fetch, React intentaba actualizar estado en un componente desmontado.
**Fix:** Añadido `AbortController` y `return () => controller.abort()` como cleanup.
**Lección:** Todo fetch en un useEffect debe tener cleanup con AbortController, especialmente en componentes que se montan/desmontan frecuentemente.

### CALIDAD — context.js actualizaba Supabase sin manejo de errores
**Problema:** La llamada `supabase.from('profiles').update(...)` no chequeaba el campo `.error` del resultado. Si Supabase fallaba, el error se perdía silenciosamente.
**Fix:** Capturado el `{ error }` y añadido `console.error` si falla.
**Lección:** Toda llamada a Supabase debe chequear el error devuelto, aunque la operación no sea crítica.

---

## 2026-04-30 — Fechas en páginas SEO

**Error:** Se incluyeron años pasados (2025, 2026) en H1 de páginas SEO de carreras de primavera
(Madrid abril, Barcelona marzo) cuando ya habían pasado.
**Fix:** Páginas de carreras de primavera → evergreen sin año en H1.
Solo añadir año si la edición es futura y concreta (Valencia diciembre 2026).
**Lección:** Antes de crear contenido con fechas, verificar si la carrera ya pasó este año.

---

## 2026-05-04 — Bugs críticos de fechas UTC vs local

- `getMondayOfCurrentWeek()` en Netlify Functions debe usar UTC+2 (Madrid), no UTC puro — `getUTCDay()` en madrugada devuelve el día anterior y genera el plan para la semana equivocada.
- `getPlanActual()` en el frontend debe usar `formatLocalDate()`, no `toISOString()` — la query `.lte('semana', today)` falla en UTC+2 porque `toISOString()` da la fecha de ayer por la noche.
- El contexto del perfil acumula datos temporales de semanas anteriores — añadir advertencia explícita en `generate-plan.js` y `buildSystemPrompt.js` para que Claude los ignore.
- El `useEffect` de auto-generación del plan siguiente no debe dispararse antes del jueves (`dayOfWeek < 4`) aunque todas las sesiones estén completadas — evita generar planes prematuramente.
- El sync con Intervals.icu debe ser fire-and-forget real (sin `await` antes del `return`) — si se awaita, puede sumar 8-17s al tiempo de respuesta y causar timeout en Netlify (límite ~26s).

---

## 2026-06-09 — Migración aplicada ≠ código implementado

**Lección:** Una migración aplicada en Supabase no implica que el código que la usa exista — verificar siempre el código real, no el contexto de conversaciones.
**Caso:** migración 002 Strava (columnas `strava_client_id`/`strava_client_secret`) aplicada en Supabase sin que ninguna función ni componente la usara (junio 2026). La documentación daba el modelo per-user por implementado. Finalmente el modelo per-user se descartó (límite Strava ampliado a 10 atletas) y las columnas quedaron obsoletas.

---

## 2026-06-09 — Deuda resuelta: unificación de completar sesión

**Resuelto:** Las dos funciones de completar sesión (`markSessionComplete` en plans.js y `patchSesionCompleta` local de ModalCompletarSesion) se unificaron en **`completarSesion(planId, dia, campos)`** en `src/lib/plans.js`. Ambas implementaciones antiguas eliminadas; todos los call sites migrados.
**Bugs encontrados durante la unificación:**
- `markSessionComplete` no recalculaba `volumen_real_min` — completar desde Dashboard o SessionDetail dejaba el volumen obsoleto.
- `WeeklyPlan.handleCompletar` era código muerto que además referenciaba `markSessionComplete` sin importarlo (habría lanzado ReferenceError).
- WeeklyPlan abría `ModalCompletarSesion` sin adjuntar `fecha` a la sesión → el auto-import de Strava del modal (que exige `sesion.fecha`) nunca se ejecutaba.
- `getTodayStr()` de WeeklyPlan usaba `toISOString()` (UTC) — en la madrugada marcaba como "pasadas" sesiones del día actual. Reemplazado por `getHoyMadrid()`.
**Lección:** Cuando coexisten dos implementaciones de lo mismo, no solo divergen — cada call site hereda los bugs de su variante. Unificar pronto y eliminar la obsoleta (no dejarla "por si acaso"). El patrón de fechas vive ahora en `src/lib/fechas.js` — no reimplementar.

---

## 2026-06-10 — Fase 0: espejo + paridad, y duplicados reales

### Patrón espejo + test de paridad para código compartido frontend↔functions
`src/lib` (ESM/Vite) y `netlify/functions` (CJS/zisi) no pueden importar el mismo archivo. Cuando una lógica debe vivir en ambos lados (umbrales wellness, criterio de volumen), se duplica deliberadamente con un **test de paridad** que importa ambos módulos y compara salidas sobre la misma matriz de inputs — la divergencia rompe el build en vez de pasar en silencio. Ver sección "Código compartido frontend ↔ functions" en CLAUDE.md.

### La idempotencia solo en el cliente no basta
La auditoría encontró **8 pares (user_id, semana) con planes duplicados** en producción (uno con 9 filas) pese a que el frontend comprobaba existencia antes de generar. Cualquier invariante de datos importante necesita aplicarse en el servidor (check en la función) y en la base (constraint UNIQUE — migración 003). El cliente solo es la primera línea.

### Las "verdades" de la documentación caducan
tricoach_plan.md decía que strava-feedback se disparaba desde strava-sync; en el código se dispara desde strava-activities. Pequeño, pero al diseñar la Fase 1 sobre esa suposición se habría colado un bug. Verificar el call site real antes de construir encima.

---

## 2026-06-10 — Fase 1: degradación con gracia en flujos automáticos

**Patrón:** un cron que depende de configuración manual (env vars, migraciones) no debe fallar en bloque si esa configuración falta — debe degradar. auto-plans envía `x-internal-secret` Y `x-tricoach-secret` (sin INTERNAL_API_SECRET los planes se generan igual, solo se pierden email y limpieza de nota), y si la columna `contexto_proxima_semana` no existe (42703), reintenta el SELECT sin ella.
**Patrón:** "disparo con espera acotada" — en serverless, fire-and-forget puro puede morir con la lambda; esperar la respuesta completa puede pasarse del límite de 26s. El término medio: resolver al flush de la petición (entrega garantizada) y esperar la respuesta solo hasta un deadline; el resumen de logs degrada de "generado/ya_existía" a "pendiente" en vez de perderse.
**Lección:** los flujos sin usuario delante necesitan que CADA dependencia tenga modo degradado y quede visible en logs — no hay nadie mirando un toast de error un lunes a las 5 de la mañana.

---

## Patrones de código estándar para Netlify Functions

```javascript
// Template para nueva función — incluir SIEMPRE:
const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = event.headers['x-tricoach-secret'];
  if (FUNCTION_SECRET && secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }
  // ...
};
```
