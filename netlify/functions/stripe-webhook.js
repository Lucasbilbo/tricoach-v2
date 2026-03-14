const https = require('https');
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function verifyStripeSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const parts = signature.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Part = parts.find(p => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;
  const t = tPart.slice(2);
  const v1 = v1Part.slice(3);
  const payload = `${t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

function supabasePatch(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Prefer': 'return=representation'
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

function sendWelcomeEmail(resendKey, to, nombre) {
  const nombreDisplay = nombre || 'atleta';
  const bodyStr = JSON.stringify({
    from: 'TriCoach <coach@getricoach.com>',
    to: [to],
    subject: '¡Ya eres Pro en TriCoach AI! 🎉',
    html: `
      <h2>¡Hola, ${nombreDisplay}!</h2>
      <p>Tu cuenta <strong>TriCoach AI Pro</strong> ya está activa. 🎉</p>
      <p>A partir de ahora tienes:</p>
      <ul>
        <li>✅ Mensajes ilimitados con tu coach IA</li>
        <li>✅ Planes adaptativos semanales</li>
        <li>✅ Análisis de actividades de Strava</li>
      </ul>
      <p><a href="https://tricoach-v2.netlify.app" style="background:#e8a838;color:#1a1209;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:8px;">Ir a TriCoach AI →</a></p>
      <p style="color:#888;font-size:13px;margin-top:24px;">¡A entrenar!</p>
    `
  });
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 500, body: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers['stripe-signature'];

  if (!verifyStripeSignature(event.body || '', signature, WEBHOOK_SECRET)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Firma inválida' }) };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data?.object;
    const userId = session?.metadata?.userId;
    const customerId = session?.customer;
    const customerEmail = session?.customer_email || session?.customer_details?.email;

    if (userId) {
      await supabasePatch(
        hostname,
        `/rest/v1/profiles?id=eq.${userId}`,
        supabaseKey,
        { plan: 'pro', stripe_customer_id: customerId || null }
      );

      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (RESEND_KEY && customerEmail) {
        try {
          const profiles = await supabaseGet(
            hostname,
            `/rest/v1/profiles?id=eq.${userId}&select=nombre`,
            supabaseKey
          );
          const nombre = Array.isArray(profiles) ? profiles[0]?.nombre : null;

          console.log('[stripe-webhook] Enviando email de bienvenida Pro a:', customerEmail, '| nombre:', nombre);
          const emailResult = await sendWelcomeEmail(RESEND_KEY, customerEmail, nombre);
          console.log('[stripe-webhook] Resultado email Resend:', JSON.stringify(emailResult));

          if (emailResult.status >= 300) {
            console.error('[stripe-webhook] Email fallido — status:', emailResult.status, '| body:', emailResult.body);
          }
        } catch (emailErr) {
          console.error('[stripe-webhook] Excepción al enviar email:', emailErr.message);
          // El error de email NO bloquea la activación Pro
        }
      } else {
        console.warn('[stripe-webhook] Email omitido — RESEND_KEY:', !!RESEND_KEY, '| customerEmail:', customerEmail);
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data?.object;
    const customerId = subscription?.customer;

    if (customerId) {
      await supabasePatch(
        hostname,
        `/rest/v1/profiles?stripe_customer_id=eq.${customerId}`,
        supabaseKey,
        { plan: 'free' }
      );
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true })
  };
};
