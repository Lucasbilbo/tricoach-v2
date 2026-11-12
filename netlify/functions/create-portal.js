// Portal de cliente de Stripe: el usuario Pro gestiona tarjeta, facturas y cancelación.
// Devuelve { url } de una sesión del portal para su stripe_customer_id.
// Requisito: tener activado el portal en Stripe (Ajustes → Facturación → Portal de clientes).

const https = require('https');
const { authenticate, corsHeaders, isAllowedOrigin, UUID_REGEX } = require('./lib/auth');
const { supa } = require('./lib/supa');

function stripePost(path, params, secretKey) {
  const bodyStr = new URLSearchParams(params).toString();
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.stripe.com', path, method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

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

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) return json(500, { error: 'Stripe no configurado' });

  const perfil = await supa('GET', `profiles?id=eq.${userId}&select=stripe_customer_id`);
  const customerId = Array.isArray(perfil.data) ? perfil.data[0]?.stripe_customer_id : null;
  if (!customerId) return json(404, { error: 'No hay ninguna suscripción asociada a esta cuenta' });

  const origin = event.headers?.origin || event.headers?.Origin || '';
  const returnUrl = `${isAllowedOrigin(origin) ? origin : 'https://getricoach.com'}/app`;
  const session = await stripePost('/v1/billing_portal/sessions', { customer: customerId, return_url: returnUrl }, STRIPE_SECRET_KEY);
  if (!session?.url) {
    console.error('[create-portal] Stripe no devolvió sesión:', session?.error?.message || 'sin respuesta');
    return json(502, { error: 'No se pudo abrir el portal de suscripción' });
  }
  return json(200, { url: session.url });
};
