// Aviso de fin de prueba Pro [SCHEDULED: todos los días 08:23 UTC].
//
// Manda UN email a cada cuenta en prueba cuando le quedan menos de 48 h, con lo que
// cambia al pasar a Free y el enlace para seguir en Pro. La marca
// profiles.trial_aviso_enviado_at (migración 007) impide repetirlo.
// Si los emails están pausados (EMAILS_ENABLED) no hace nada y no marca a nadie.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildFinPruebaHtml } = require('./lib/emails-usuario');
const { supa } = require('./lib/supa');

const HORAS_AVISO = 48;
const DIA_MS = 24 * 60 * 60 * 1000;

// Consulta de las cuentas a avisar. Pura — testeada en emails-usuario.test.js.
function consultaAvisos(ahora = Date.now()) {
  const desde = encodeURIComponent(new Date(ahora).toISOString());
  const hasta = encodeURIComponent(new Date(ahora + HORAS_AVISO * 60 * 60 * 1000).toISOString());
  return `profiles?plan=neq.pro&deleted_at=is.null&trial_aviso_enviado_at=is.null&emails_baja_at=is.null&email=not.is.null`
    + `&trial_ends_at=gt.${desde}&trial_ends_at=lt.${hasta}&select=id,email,nombre,trial_ends_at&limit=200`;
}

function diasRestantes(trialEndsAt, ahora = Date.now()) {
  return Math.max(1, Math.ceil((Date.parse(trialEndsAt) - ahora) / DIA_MS));
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;
  if (!emailsEnabled()) return { statusCode: 200, body: JSON.stringify({ pausado: true }) };

  const ahora = Date.now();
  const res = await supa('GET', consultaAvisos(ahora));
  if (!res.ok || !Array.isArray(res.data)) {
    console.error('[trial-reminder] no se pudo leer profiles — status:', res.status);
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase' }) };
  }

  let enviados = 0, fallos = 0;
  for (const p of res.data) {
    const dias = diasRestantes(p.trial_ends_at, ahora);
    const envio = await sendEmail(p.email, `${dias <= 1 ? 'Te queda 1 día' : `Te quedan ${dias} días`} de prueba Pro en TriCoach AI`, buildFinPruebaHtml(p.nombre, dias), { bajaUserId: p.id });
    if (envio.status >= 200 && envio.status < 300) {
      await supa('PATCH', `profiles?id=eq.${p.id}`, { trial_aviso_enviado_at: new Date().toISOString() });
      enviados++;
    } else {
      fallos++;
      console.error('[trial-reminder] fallo de envío — status:', envio.status);
    }
    await new Promise(r => setTimeout(r, 600)); // Resend: 2 peticiones/segundo
  }
  if (fallos > 0) console.error(`[trial-reminder] candidatos=${res.data.length} enviados=${enviados} fallos=${fallos}`);
  return { statusCode: 200, body: JSON.stringify({ candidatos: res.data.length, enviados, fallos }) };
};

exports.consultaAvisos = consultaAvisos;
exports.diasRestantes = diasRestantes;
