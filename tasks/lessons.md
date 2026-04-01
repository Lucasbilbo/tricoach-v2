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
