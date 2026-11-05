const { authenticate, corsHeaders } = require('./lib/auth');
const https = require('https');

let CORS = corsHeaders();

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  if (!userId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  const baseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };
  const rest = (method, path, body) => httpsRequest({
    hostname, path, method,
    headers: body ? { ...baseHeaders, 'Content-Length': Buffer.byteLength(body) } : baseHeaders,
  }, body);
  const getJson = async (path) => {
    const r = await rest('GET', path);
    try { return JSON.parse(r.body); } catch { return null; }
  };

  // 1. Protección del Coach Dashboard (comparte esta base de datos): entrenadores y
  //    atletas vinculados a un entrenador no se borran desde aquí, porque se perderían
  //    sus sesiones, temporada y disponibilidad del panel.
  const [esCoach, esAtletaDePanel] = await Promise.all([
    getJson(`/rest/v1/coaches?id=eq.${userId}&select=id`),
    getJson(`/rest/v1/coach_athletes?athlete_id=eq.${userId}&select=id`),
  ]);
  if ((Array.isArray(esCoach) && esCoach.length) || (Array.isArray(esAtletaDePanel) && esAtletaDePanel.length)) {
    return {
      statusCode: 409,
      headers: CORS,
      body: JSON.stringify({ error: 'Tu cuenta está vinculada al panel de tu entrenador. Escríbenos a coach@getricoach.com y la damos de baja.' }),
    };
  }

  const perfiles = await getJson(`/rest/v1/profiles?id=eq.${userId}&select=strava_token,stripe_customer_id`);
  const perfil = Array.isArray(perfiles) ? perfiles[0] : null;

  // 2. Stripe: cancelar suscripciones y borrar el cliente (las facturas se conservan en Stripe)
  if (perfil?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripe = (method, path) => httpsRequest({
      hostname: 'api.stripe.com', path, method,
      headers: { Authorization: `Bearer ${stripeKey}` },
    }).catch(e => ({ status: 500, body: e.message }));
    const subs = await stripe('GET', `/v1/subscriptions?customer=${encodeURIComponent(perfil.stripe_customer_id)}&status=all&limit=20`);
    let lista = [];
    try { lista = JSON.parse(subs.body).data || []; } catch { /* sin suscripciones */ }
    for (const sub of lista.filter(x => !['canceled', 'incomplete_expired'].includes(x.status))) {
      const r = await stripe('DELETE', `/v1/subscriptions/${sub.id}`);
      if (r.status >= 300) console.error('delete-account: no se pudo cancelar la suscripción', sub.id, r.status);
    }
    const del = await stripe('DELETE', `/v1/customers/${encodeURIComponent(perfil.stripe_customer_id)}`);
    if (del.status >= 300) console.error('delete-account: no se pudo borrar el cliente de Stripe', del.status);
  }

  // 3. Strava: revocar el acceso (libera una de las 10 plazas de la app)
  if (perfil?.strava_token) {
    const body = `access_token=${encodeURIComponent(perfil.strava_token)}`;
    await httpsRequest({
      hostname: 'www.strava.com', path: '/oauth/deauthorize', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, body).catch(() => null);
  }

  // 4. Datos de la app. plans y training_cycles también caen en cascada al borrar el perfil.
  const borrados = [
    ['messages', `/rest/v1/messages?user_id=eq.${userId}`],
    ['plans', `/rest/v1/plans?user_id=eq.${userId}`],
  ];
  for (const [nombre, path] of borrados) {
    const r = await rest('DELETE', path);
    if (r.status >= 300) {
      console.error(`delete-account: error borrando ${nombre}`, r.body);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al eliminar la cuenta' }) };
    }
  }
  const noCiclo = JSON.stringify({ active_cycle_id: null });
  await rest('PATCH', `/rest/v1/profiles?id=eq.${userId}`, noCiclo);
  const ciclos = await rest('DELETE', `/rest/v1/training_cycles?user_id=eq.${userId}`);
  if (ciclos.status >= 300) console.error('delete-account: error borrando training_cycles', ciclos.body);

  const perfilBorrado = await rest('DELETE', `/rest/v1/profiles?id=eq.${userId}`);
  if (perfilBorrado.status >= 300) {
    console.error('delete-account: error borrando profile', perfilBorrado.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al eliminar la cuenta' }) };
  }

  // 5. Usuario de autenticación (email y acceso)
  const authDel = await rest('DELETE', `/auth/v1/admin/users/${userId}`);
  if (authDel.status >= 300) {
    console.error('delete-account: error borrando el usuario de auth', authDel.status, authDel.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Se borraron tus datos pero no el acceso. Escríbenos a coach@getricoach.com.' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
};
