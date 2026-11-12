// Lee la captura de un entreno y devuelve los datos para rellenar "completar sesión".
//
// POST { userId, imagen (base64 sin prefijo), mediaType, sesion? } → { duracion_min, distancia_km, fc_media, ritmo, deporte, comentario }
// - Cada captura cuenta como un mensaje del día (misma RPC atómica que el chat).
// - La imagen no se guarda ni se registra: se manda a Claude y se descarta.
// - El modelo se elige en lib/claude.js según el plan efectivo.

const { authenticate, corsHeaders, UUID_REGEX } = require('./lib/auth');
const { callClaude, extractText, modelFor } = require('./lib/claude');
const { planEfectivo } = require('./lib/plan-efectivo');
const { supa } = require('./lib/supa');
const { SYSTEM, validarImagen, construirMensajes, interpretar } = require('./lib/captura');

const DAILY_LIMIT = { free: 10, pro: 20 }; // = DAILY_LIMIT de claude.js (test de paridad)

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  const json = (statusCode, body) => ({ statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido' }); }
  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  if (!UUID_REGEX.test(userId)) return json(400, { error: 'userId inválido' });

  const errorImagen = validarImagen(parsed.imagen, parsed.mediaType);
  if (errorImagen) return json(400, { error: errorImagen });

  const perfil = await supa('GET', `profiles?id=eq.${userId}&select=plan,trial_ends_at,deleted_at`);
  const profile = Array.isArray(perfil.data) ? perfil.data[0] : null;
  if (!profile) return json(404, { error: 'Perfil no encontrado' });
  if (profile.deleted_at) return json(403, { error: 'Cuenta eliminada' });
  const plan = planEfectivo(profile);

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const cuenta = await supa('POST', 'rpc/increment_messages_today', { p_user_id: userId, p_limit: DAILY_LIMIT[plan], p_today: today }, { devolver: true });
  if (cuenta.data === -1) return json(429, { error: 'Has alcanzado el límite de hoy. Mañana podrás subir más capturas.', limite: DAILY_LIMIT[plan], plan });
  // cuenta.ok === false → Supabase falló: se deja pasar, igual que en el chat

  const r = await callClaude({
    model: modelFor(plan),
    system: SYSTEM,
    messages: construirMensajes(parsed.imagen, parsed.mediaType, parsed.sesion),
    maxTokens: 500,
    timeoutMs: 22000,
  });
  if (!r.ok) {
    console.error('[analizar-captura] Claude falló — status:', r.status);
    return json(502, { error: 'No se ha podido leer la captura. Inténtalo de nuevo.' });
  }

  const datos = interpretar(extractText(r.data));
  if (!datos) return json(502, { error: 'No se ha podido leer la captura. Inténtalo de nuevo.' });
  if (!datos.es_entreno) {
    return json(422, { error: datos.comentario || 'No he encontrado datos de un entreno en la imagen. Sube la pantalla de resumen de la actividad.' });
  }
  delete datos.es_entreno;
  return json(200, datos);
};

exports.DAILY_LIMIT = DAILY_LIMIT;
