// Email del día 3 de la prueba Pro [SCHEDULED: todos los días 09:12 UTC].
//
// Manda UN email a cada cuenta en prueba cuando lleva entre 3 y 4 días (le quedan entre 3 y 4
// de los 7). La marca profiles.trial_dia3_enviado_at (migración 010) impide repetirlo.
// Con EMAILS_ENABLED=false no hace nada y no marca a nadie. No registra emails ni nombres.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildDia3PruebaHtml } = require('./lib/emails-usuario');
const { supa } = require('./lib/supa');
const { getMondayOfCurrentWeek } = require('./lib/fechas');

const HORA_MS = 60 * 60 * 1000;
const PRESUPUESTO_MS = 22000;
const PAUSA_RESEND_MS = 600;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cuentas en prueba a las que les quedan entre 3 y 4 días. Pura — testeada.
function consultaPerfiles(ahora = Date.now()) {
  const desde = encodeURIComponent(new Date(ahora + 72 * HORA_MS).toISOString());
  const hasta = encodeURIComponent(new Date(ahora + 96 * HORA_MS).toISOString());
  return `profiles?plan=neq.pro&deleted_at=is.null&trial_dia3_enviado_at=is.null&emails_baja_at=is.null&email=not.is.null`
    + `&trial_ends_at=gt.${desde}&trial_ends_at=lt.${hasta}&select=id,email,nombre&limit=200`;
}

function consultaPlanes(ids, lunes) {
  const validos = ids.filter(id => UUID_REGEX.test(id));
  return `plans?user_id=in.(${validos.join(',')})&semana=eq.${lunes}&select=user_id,sesiones`;
}

// Sesiones marcadas (no descanso) de un plan. Acepta completada true/1/'true'/'1'.
function contarMarcadas(sesiones) {
  if (!Array.isArray(sesiones)) return 0;
  return sesiones.filter(s => {
    const marcada = s && [true, 1, 'true', '1'].includes(s.completada);
    const descanso = s && (String(s.tipo || '').toLowerCase() === 'descanso' || String(s.intensidad || '').toLowerCase() === 'descanso');
    return marcada && !descanso;
  }).length;
}

async function procesar({ supa: db, enviar, ahora = Date.now(), lunes, esperar = ms => new Promise(r => setTimeout(r, ms)), reloj = Date.now, presupuestoMs = PRESUPUESTO_MS }) {
  const inicio = reloj();
  const res = await db('GET', consultaPerfiles(ahora));
  if (!res.ok || !Array.isArray(res.data)) return { error: true, status: res.status };
  const perfiles = res.data.filter(p => UUID_REGEX.test(p.id));
  const planPorUsuario = {};
  if (perfiles.length > 0) {
    const pl = await db('GET', consultaPlanes(perfiles.map(p => p.id), lunes));
    if (pl.ok && Array.isArray(pl.data)) for (const p of pl.data) planPorUsuario[p.user_id] = p;
  }
  let enviados = 0, fallos = 0, pendientes = 0;
  for (let i = 0; i < perfiles.length; i++) {
    if (reloj() - inicio > presupuestoMs) { pendientes = perfiles.length - i; break; }
    const p = perfiles[i];
    const plan = planPorUsuario[p.id];
    const html = buildDia3PruebaHtml(p.nombre, { tienePlan: !!plan, sesionesMarcadas: plan ? contarMarcadas(plan.sesiones) : 0 });
    const envio = await enviar(p.email, 'Llevas 3 días de prueba Pro en TriCoach AI', html, { bajaUserId: p.id });
    if (envio.status >= 200 && envio.status < 300) {
      await db('PATCH', `profiles?id=eq.${p.id}`, { trial_dia3_enviado_at: new Date(ahora).toISOString() });
      enviados++;
    } else {
      fallos++;
      console.error('[trial-dia3] fallo de envío — status:', envio.status);
    }
    await esperar(PAUSA_RESEND_MS);
  }
  if (fallos > 0 || pendientes > 0) console.error(`[trial-dia3] candidatos=${perfiles.length} enviados=${enviados} fallos=${fallos} pendientes=${pendientes}`);
  return { candidatos: perfiles.length, enviados, fallos, pendientes };
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;
  if (!emailsEnabled()) return { statusCode: 200, body: JSON.stringify({ pausado: true }) };
  const r = await procesar({ supa, enviar: sendEmail, lunes: getMondayOfCurrentWeek() });
  if (r.error) {
    console.error('[trial-dia3] no se pudo leer profiles — status:', r.status);
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase' }) };
  }
  return { statusCode: 200, body: JSON.stringify(r) };
};

exports.consultaPerfiles = consultaPerfiles;
exports.consultaPlanes = consultaPlanes;
exports.contarMarcadas = contarMarcadas;
exports.procesar = procesar;
