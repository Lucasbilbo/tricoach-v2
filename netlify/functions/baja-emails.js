// Baja de emails de TriCoach. Enlace firmado (lib/baja.js), sin login.
// GET  → página con botón "Confirmar baja" (los escáneres de correo abren enlaces: GET no cambia nada).
// POST → aplica la baja (también el "un clic" de List-Unsubscribe-Post).
const { verificar } = require('./lib/baja');
const { supa } = require('./lib/supa');

function pagina(titulo, cuerpo) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="background:#080808;color:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:48px 24px;text-align:center;">
<div style="max-width:440px;margin:0 auto;"><p style="font-size:36px;font-weight:900;margin:0 0 24px;">T<span style="color:#FF6B2B;">·</span></p>${cuerpo}</div></body></html>`,
  };
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (!verificar(q.u, q.t)) {
    return { ...pagina('Enlace no válido', '<h1 style="font-size:22px;">Enlace no válido</h1><p style="color:#d0cbc2;">Escríbenos a coach@getricoach.com y te damos de baja a mano.</p>'), statusCode: 400 };
  }
  if (event.httpMethod === 'GET') {
    return pagina('Darme de baja', `<h1 style="font-size:22px;">¿Dejar de recibir emails de TriCoach AI?</h1>
<form method="POST"><button type="submit" style="background:#FF6B2B;color:#fff;padding:13px 28px;border:0;border-radius:24px;font-weight:700;font-size:15px;cursor:pointer;">Confirmar baja</button></form>`);
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const res = await supa('PATCH', `profiles?id=eq.${q.u}`, { emails_baja_at: new Date().toISOString(), recordatorios_email: false });
  if (!res.ok) {
    console.error('[baja-emails] no se pudo guardar la baja — status:', res.status);
    return { ...pagina('Error', '<h1 style="font-size:22px;">No hemos podido darte de baja</h1><p style="color:#d0cbc2;">Escríbenos a coach@getricoach.com y lo hacemos a mano.</p>'), statusCode: 500 };
  }
  return pagina('Baja confirmada', '<h1 style="font-size:22px;">Listo, no recibirás más emails</h1><p style="color:#d0cbc2;">Tu cuenta y tu plan siguen igual. Solo te escribiremos por temas de pago si los hubiera.</p>');
};
