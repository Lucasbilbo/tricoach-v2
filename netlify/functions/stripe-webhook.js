const https = require('https');
const { emailsEnabled, sendAlertEmail } = require('./lib/email');
const { verificarFirma, decidirAccion, quedaSuscripcionViva } = require('./lib/stripe-eventos');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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

function suscripcionesDeCliente(customerId) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.stripe.com',
      path: `/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`,
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { const j = JSON.parse(d); resolve(r.statusCode === 200 && Array.isArray(j.data) ? j.data : null); } catch { resolve(null); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
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
        <li>✅ 20 mensajes al día con tu coach IA (Sonnet)</li>
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

  if (!verificarFirma(event.body || '', signature, WEBHOOK_SECRET)) {
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

  console.log('[Stripe] Evento recibido:', stripeEvent.type);

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data?.object;
    const userId = session?.metadata?.userId;
    const customerId = session?.customer;
    const customerEmail = session?.customer_email || session?.customer_details?.email;

    if (userId) {
      const patchResult = await supabasePatch(
        hostname,
        `/rest/v1/profiles?id=eq.${userId}`,
        supabaseKey,
        { plan: 'pro', stripe_customer_id: customerId || null }
      );
      if (patchResult) {
        console.log('[Stripe] Pro activado para userId:', userId);
      } else {
        console.error('[Stripe] FALLO activación Pro para userId:', userId);
      }

      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (RESEND_KEY && customerEmail && emailsEnabled()) {
        try {
          const profiles = await supabaseGet(
            hostname,
            `/rest/v1/profiles?id=eq.${userId}&select=nombre`,
            supabaseKey
          );
          const nombre = Array.isArray(profiles) ? profiles[0]?.nombre : null;

          const emailResult = await sendWelcomeEmail(RESEND_KEY, customerEmail, nombre);
          if (emailResult.status < 300) {
            console.log('[Stripe] Email enviado a:', customerEmail);
          } else {
            console.error('[Stripe] FALLO email — status:', emailResult.status, '| body:', emailResult.body);
          }
        } catch (emailErr) {
          console.error('[Stripe] FALLO email — excepción:', emailErr.message);
          // El error de email NO bloquea la activación Pro
        }
      } else {
        console.warn('[stripe-webhook] Email omitido — RESEND_KEY:', !!RESEND_KEY, '| customerEmail:', customerEmail, '| emailsActivos:', emailsEnabled());
      }
    }
  }

  const decision = decidirAccion(stripeEvent);
  const idCliente = decision.customerId ? encodeURIComponent(decision.customerId) : null;

  if (decision.accion === 'reactivar' && idCliente) {
    await supabasePatch(hostname, `/rest/v1/profiles?stripe_customer_id=eq.${idCliente}`, supabaseKey, { plan: 'pro' });
  }

  if (decision.accion === 'revisar_baja' && idCliente) {
    // Un cliente puede tener varias suscripciones: solo se baja a Free si no queda ninguna viva.
    // Si Stripe no responde, NO se baja (mejor un Pro de más que quitar un servicio pagado) y se avisa.
    const subs = await suscripcionesDeCliente(decision.customerId);
    if (subs === null) {
      console.error('[Stripe] No se pudo comprobar las suscripciones de', decision.customerId);
      await sendAlertEmail('⚠️ TriCoach: baja de suscripción sin verificar', `<p>Stripe notificó el fin de una suscripción del cliente <code>${decision.customerId}</code>, pero no se pudo consultar su estado. No se ha cambiado su plan. Revísalo a mano.</p>`);
    } else if (!quedaSuscripcionViva(subs)) {
      await supabasePatch(hostname, `/rest/v1/profiles?stripe_customer_id=eq.${idCliente}`, supabaseKey, { plan: 'free' });
    }
  }

  if (decision.accion === 'avisar_pago') {
    console.error('[Stripe] Cobro fallido — cliente:', decision.customerId, '| intento:', decision.intento);
    await sendAlertEmail(
      '⚠️ TriCoach: ha fallado un cobro',
      `<p>Ha fallado el cobro de una suscripción${decision.importe !== null ? ` (${decision.importe.toFixed(2)} €)` : ''}${decision.email ? ` de <b>${String(decision.email).replace(/</g, '&lt;')}</b>` : ''}. Intento nº ${decision.intento || '?'}.</p>
       <p>Stripe reintentará según tu configuración. Su plan no se cambia hasta que la suscripción termine. Cliente: <code>${decision.customerId}</code>.</p>`
    );
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true })
  };
};
