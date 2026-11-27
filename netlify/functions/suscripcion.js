// Confirmación y baja de la lista "recibe este plan en tu email". Enlaces firmados (lib/suscripcion.js).
// GET → página con botón (los escáneres de correo abren enlaces: GET no cambia nada).
// POST → aplica (también el "un clic" de List-Unsubscribe-Post).
const { verificar } = require('./lib/suscripcion');
const { supa } = require('./lib/supa');

function pagina(titulo, cuerpo, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="background:#080808;color:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:48px 24px;text-align:center;">
<div style="max-width:440px;margin:0 auto;"><p style="font-size:36px;font-weight:900;margin:0 0 24px;">T<span style="color:#FF6B2B;">·</span></p>${cuerpo}</div></body></html>`,
  };
}
const boton = (t) => `<form method="POST"><button type="submit" style="background:#FF6B2B;color:#fff;padding:13px 28px;border:0;border-radius:24px;font-weight:700;font-size:15px;cursor:pointer;">${t}</button></form>`;

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (!verificar(q.a, q.u, q.t)) {
    return pagina('Enlace no válido', '<h1 style="font-size:22px;">Enlace no válido</h1><p style="color:#d0cbc2;">Escríbenos a coach@getricoach.com y lo resolvemos a mano.</p>', 400);
  }
  const baja = q.a === 'baja';
  if (event.httpMethod === 'GET') {
    return baja
      ? pagina('Darme de baja', `<h1 style="font-size:22px;">¿Dejar de recibir emails de TriCoach AI?</h1>${boton('Confirmar baja')}`)
      : pagina('Confirmar email', `<h1 style="font-size:22px;">Confirma tu email</h1><p style="color:#d0cbc2;">Un clic y listo.</p>${boton('Confirmar')}`);
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const ahora = new Date().toISOString();
  // Confirmar solo vale desde 'pendiente': quien se dio de baja no se reactiva con un enlace viejo.
  const res = baja
    ? await supa('PATCH', `suscriptores_plan?id=eq.${q.u}`, { estado: 'baja', baja_at: ahora })
    : await supa('PATCH', `suscriptores_plan?id=eq.${q.u}&estado=eq.pendiente`, { estado: 'confirmado', confirmado_at: ahora });
  if (!res.ok) {
    console.error('[suscripcion] no se pudo guardar — acción:', q.a, 'status:', res.status);
    return pagina('Error', '<h1 style="font-size:22px;">No hemos podido completarlo</h1><p style="color:#d0cbc2;">Escríbenos a coach@getricoach.com y lo hacemos a mano.</p>', 500);
  }
  return baja
    ? pagina('Baja confirmada', '<h1 style="font-size:22px;">Listo, no recibirás más emails</h1>')
    : pagina('Email confirmado', '<h1 style="font-size:22px;">Email confirmado</h1><p style="color:#d0cbc2;">Gracias. Te enviaremos guías de entrenamiento y cómo probar el coach. Mientras tanto, puedes probar el coach gratis en <a href="https://getricoach.com/app" style="color:#FF6B2B;">getricoach.com/app</a>.</p>');
};
