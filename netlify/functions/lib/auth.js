// Autenticación común de las functions (CommonJS).
//
// Antes (hasta nov-2026) las functions se protegían con un secreto compartido
// (VITE_TRICOACH_SECRET) que viajaba dentro del JavaScript del navegador, y se
// fiaban del userId que llegaba en el body. Cualquiera con el secreto (público)
// y el id de otro usuario podía actuar en su nombre.
//
// Ahora:
//   1. Navegador → la function recibe `Authorization: Bearer <access_token de Supabase>`.
//      Se valida contra Supabase Auth y el userId SALE DEL TOKEN, nunca del body.
//   2. Server-to-server (cron auto-plans → generate-plan) → header `x-internal-secret`
//      igual a INTERNAL_API_SECRET (solo existe en Netlify, nunca en el navegador).

const https = require('https');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Orígenes permitidos para CORS. Se puede ampliar con ALLOWED_ORIGINS (coma-separado).
const DEFAULT_ORIGINS = [
  'https://getricoach.com',
  'https://www.getricoach.com',
  'https://app.getricoach.com',
  'https://tricoach-v2.netlify.app',
  'http://localhost:8888',
  'http://localhost:5173',
];

function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  // Deploy previews y branch deploys de este sitio en Netlify
  return /^https:\/\/[a-z0-9-]+--tricoach-v2\.netlify\.app$/.test(origin);
}

function corsHeaders(event, methods = 'POST, OPTIONS') {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://getricoach.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': methods,
    'Vary': 'Origin',
  };
}

function header(event, name) {
  const h = event?.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())] || '';
}

function isInternalCall(event) {
  const secret = process.env.INTERNAL_API_SECRET;
  return Boolean(secret) && header(event, 'x-internal-secret') === secret;
}

function getBearerToken(event) {
  const auth = header(event, 'authorization');
  const m = /^Bearer\s+(.+)$/i.exec(auth || '');
  return m ? m[1].trim() : null;
}

// Pregunta a Supabase Auth de quién es el token. Devuelve el user o null.
function fetchSupabaseUser(token) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !apiKey || !token) return Promise.resolve(null);
  const hostname = new URL(supabaseUrl).hostname;

  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: '/auth/v1/user',
      method: 'GET',
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function unauthorized(cors) {
  return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'No autorizado' }) };
}

/**
 * Autentica la petición.
 * @param {object} event  evento de Netlify
 * @param {object} opts   { cors, allowInternal = false, bodyUserId }
 *   - allowInternal: acepta x-internal-secret (en ese caso el userId viene del body)
 *   - bodyUserId: userId que manda el cliente; si no coincide con el del token → 403
 * @returns {Promise<{ok:true, userId:string, internal:boolean, user?:object} | {ok:false, response:object}>}
 */
async function authenticate(event, { cors, allowInternal = false, bodyUserId } = {}) {
  const headers = cors || corsHeaders(event);

  if (allowInternal && isInternalCall(event)) {
    if (!bodyUserId || !UUID_REGEX.test(bodyUserId)) {
      return { ok: false, response: { statusCode: 400, headers, body: JSON.stringify({ error: 'userId inválido' }) } };
    }
    return { ok: true, userId: bodyUserId, internal: true };
  }

  const token = getBearerToken(event);
  if (!token) return { ok: false, response: unauthorized(headers) };

  const user = await fetchSupabaseUser(token);
  if (!user?.id || !UUID_REGEX.test(user.id)) return { ok: false, response: unauthorized(headers) };

  if (bodyUserId && bodyUserId !== user.id) {
    return { ok: false, response: { statusCode: 403, headers, body: JSON.stringify({ error: 'Prohibido' }) } };
  }
  return { ok: true, userId: user.id, internal: false, user };
}

module.exports = {
  UUID_REGEX,
  authenticate,
  corsHeaders,
  isAllowedOrigin,
  isInternalCall,
  getBearerToken,
  fetchSupabaseUser,
};

// Guard para las functions programadas (weekly-report, thursday-reminder, auto-plans,
// health-check). Con los crons pausados son URLs públicas: sin esto cualquiera podía
// dispararlas. Se permiten:
//   - llamadas con x-internal-secret (pruebas manuales / netlify functions:invoke)
//   - ejecuciones del scheduler de Netlify (body con next_run), solo si el cron de esa
//     función está activo en netlify.toml y se marca con CRONS_ENABLED=true.
//     Netlify no deja invocar por URL una función programada en producción.
function isScheduledInvocation(event) {
  if (process.env.CRONS_ENABLED !== 'true') return false;
  try { return Boolean(JSON.parse(event?.body || '{}').next_run); } catch { return false; }
}

function guardScheduled(event) {
  if (isInternalCall(event) || isScheduledInvocation(event)) return null;
  return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
}

module.exports.guardScheduled = guardScheduled;
module.exports.isScheduledInvocation = isScheduledInvocation;
