const { authenticate, corsHeaders, isAllowedOrigin } = require('./lib/auth');
const https = require('https');

let CORS = corsHeaders();



function supabaseGet(hostname, path, key) {
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function stripePost(path, params, secretKey) {
  const bodyStr = new URLSearchParams(params).toString();
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
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

  // El navegador manda `plan` ('monthly' | 'annual') y el precio se decide aquí.
  // `priceId` se sigue aceptando por compatibilidad con clientes en caché.
  const PRECIOS = { monthly: process.env.STRIPE_PRICE_MONTHLY, annual: process.env.STRIPE_PRICE_ANNUAL };
  const priceId = PRECIOS[parsed.plan] || parsed.priceId;
  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  if (!userId || !priceId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta el plan o el precio no está configurado' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  // Solo se aceptan los precios configurados en Netlify (el cliente no puede elegir otro)
  const preciosValidos = [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL].filter(Boolean);
  if (!preciosValidos.includes(priceId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Precio no válido' }) };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Stripe no configurado' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  const users = await supabaseGet(
    hostname,
    `/auth/v1/admin/users/${userId}`,
    supabaseKey
  );
  const email = users?.email || null;

  // Volver a la APP (no a la landing, que vive en la raíz) y al mismo origen desde el que
  // se inició el pago: la sesión de Supabase se guarda por origen.
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const appUrl = `${isAllowedOrigin(origin) ? origin : 'https://getricoach.com'}/app`;

  const params = {
    mode: 'subscription',
    'success_url': `${appUrl}?upgrade=success`,
    'cancel_url': appUrl,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'metadata[userId]': userId,
    allow_promotion_codes: 'true',

  };
  if (email) params['customer_email'] = email;

  const session = await stripePost('/v1/checkout/sessions', params, STRIPE_SECRET_KEY);

  if (!session?.url) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al crear sesión de pago' }) };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url })
  };
};
