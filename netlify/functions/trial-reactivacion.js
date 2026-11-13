// Email de reactivación tras caducar la prueba Pro [SCHEDULED: todos los días 09:42 UTC].
//
// Manda UN email a cada cuenta cuya prueba terminó hace entre 3 y 4 días y que no es Pro de pago.
// La marca profiles.trial_reactivacion_enviada_at (migración 011) impide repetirlo.
// Con EMAILS_ENABLED=false no hace nada y no marca a nadie. No registra emails ni nombres.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildReactivacionPruebaHtml } = require('./lib/emails-usuario');
const { supa } = require('./lib/supa');

const HORA_MS = 60 * 60 * 1000;
const PRESUPUESTO_MS = 22000;
const PAUSA_RESEND_MS = 600;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cuentas no Pro cuya prueba acabó hace entre 3 y 4 días. Pura — testeada.
function consultaPerfiles(ahora = Date.now()) {
  const desde = encodeURIComponent(new Date(ahora - 96 * HORA_MS).toISOString());
  const hasta = encodeURIComponent(new Date(ahora - 72 * HORA_MS).toISOString());
  return `profiles?plan=neq.pro&deleted_at=is.null&trial_reactivacion_enviada_at=is.null&emails_baja_at=is.null&email=not.is.null`
    + `&trial_ends_at=gt.${desde}&trial_ends_at=lt.${hasta}&select=id,email,nombre&limit=200`;
}

async function procesar({ supa: db, enviar, ahora = Date.now(), esperar = ms => new Promise(r => setTimeout(r, ms)), reloj = Date.now, presupuestoMs = PRESUPUESTO_MS }) {
  const inicio = reloj();
  const res = await db('GET', consultaPerfiles(ahora));
  if (!res.ok || !Array.isArray(res.data)) return { error: true, status: res.status };
  const perfiles = res.data.filter(p => UUID_REGEX.test(p.id));
  let enviados = 0, fallos = 0, pendientes = 0;
  for (let i = 0; i < perfiles.length; i++) {
    if (reloj() - inicio > presupuestoMs) { pendientes = perfiles.length - i; break; }
    const p = perfiles[i];
    const envio = await enviar(p.email, 'Tu prueba Pro de TriCoach AI terminó', buildReactivacionPruebaHtml(p.nombre), { bajaUserId: p.id });
    if (envio.status >= 200 && envio.status < 300) {
      await db('PATCH', `profiles?id=eq.${p.id}`, { trial_reactivacion_enviada_at: new Date(ahora).toISOString() });
      enviados++;
    } else {
      fallos++;
      console.error('[trial-reactivacion] fallo de envío — status:', envio.status);
    }
    await esperar(PAUSA_RESEND_MS);
  }
  if (fallos > 0 || pendientes > 0) console.error(`[trial-reactivacion] candidatos=${perfiles.length} enviados=${enviados} fallos=${fallos} pendientes=${pendientes}`);
  return { candidatos: perfiles.length, enviados, fallos, pendientes };
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;
  if (!emailsEnabled()) return { statusCode: 200, body: JSON.stringify({ pausado: true }) };
  const r = await procesar({ supa, enviar: sendEmail });
  if (r.error) {
    console.error('[trial-reactivacion] no se pudo leer profiles — status:', r.status);
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase' }) };
  }
  return { statusCode: 200, body: JSON.stringify(r) };
};

exports.consultaPerfiles = consultaPerfiles;
exports.procesar = procesar;
