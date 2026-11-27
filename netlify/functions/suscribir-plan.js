// Alta en la lista "recibe este plan en tu email" desde guías y herramientas (público, sin login).
// Doble confirmación: solo se escribe a quien pulsa el enlace del email de confirmación.
// Respuesta siempre igual (ok) para no revelar qué emails ya están en la lista.
const { corsHeaders } = require('./lib/auth');
const { supa } = require('./lib/supa');
const { sendEmail } = require('./lib/email');
const { urlAccion, normalizarEmail, normalizarOrigen } = require('./lib/suscripcion');

const REENVIO_MS = 10 * 60 * 1000;

function html(nombreGuia, urlConfirmar) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background:#080808;color:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;">
<p style="font-size:36px;font-weight:900;margin:0 0 16px;text-align:center;">T<span style="color:#FF6B2B;">·</span></p>
<h1 style="font-size:22px;margin:0 0 12px;">Confirma tu email</h1>
<p style="color:#d0cbc2;font-size:15px;line-height:1.6;">Pediste recibir contenido de entrenamiento de TriCoach AI desde la página «${nombreGuia}». Para empezar, confirma que este email es tuyo.</p>
<p style="text-align:center;margin:28px 0;"><a href="${urlConfirmar}" style="background:#FF6B2B;color:#fff;padding:13px 28px;border-radius:24px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">Confirmar mi email</a></p>
<p style="color:#888;font-size:12px;line-height:1.5;">Si no lo pediste tú, ignora este mensaje: no te escribiremos más.</p>
</div></body></html>`;
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  const ok = { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  let p;
  try { p = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  if (p.website) return ok; // campo trampa para bots: se acepta en silencio sin hacer nada
  const email = normalizarEmail(p.email);
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Email no válido' }) };
  const origen = normalizarOrigen(p.origen);

  const prev = await supa('GET', `suscriptores_plan?select=id,estado,confirmacion_enviada_at&email=ilike.${encodeURIComponent(email)}&limit=1`);
  if (!prev.ok) {
    console.error('[suscribir-plan] no se pudo leer la lista — status:', prev.status);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'No hemos podido guardar tu email' }) };
  }
  let fila = prev.data && prev.data[0];
  if (fila && fila.estado !== 'pendiente') return ok; // ya confirmado o de baja: no se reenvía nada
  if (fila && fila.confirmacion_enviada_at && Date.now() - new Date(fila.confirmacion_enviada_at).getTime() < REENVIO_MS) return ok;

  if (!fila) {
    const ins = await supa('POST', 'suscriptores_plan', { email, origen }, { devolver: true });
    if (!ins.ok) {
      console.error('[suscribir-plan] no se pudo guardar el alta — status:', ins.status);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'No hemos podido guardar tu email' }) };
    }
    fila = Array.isArray(ins.data) ? ins.data[0] : ins.data;
  }
  const url = fila && urlAccion('confirmar', fila.id);
  if (!url) { console.error('[suscribir-plan] falta INTERNAL_API_SECRET o id: no se envía confirmación'); return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'No hemos podido guardar tu email' }) }; }

  const r = await sendEmail(email, 'Confirma tu email — TriCoach AI', html(origen.replace(/-/g, ' '), url), { force: true });
  if (r.status >= 200 && r.status < 300) {
    await supa('PATCH', `suscriptores_plan?id=eq.${fila.id}`, { confirmacion_enviada_at: new Date().toISOString() });
  } else {
    console.error('[suscribir-plan] Resend no aceptó la confirmación — status:', r.status);
  }
  return ok;
};
