// Email ÚNICO de recuperación [SCHEDULED: 13-nov-2026, 09:30 y 10:30 UTC].
//
// A quién: cuentas creadas antes del 5-nov-2026 (cuando se arregló el coach) que hicieron
// el onboarding y nunca tuvieron un plan. Se excluyen Pro, cuentas borradas y los atletas
// del Coach Dashboard. Qué hace: manda el email y, solo si se envió, les activa 7 días de
// prueba Pro y marca profiles.recuperacion_enviada_at (migración 007).
//
// No se puede repetir: (1) la marca por cuenta, (2) la fecha de corte de alta y (3) la
// función deja de actuar pasado CADUCA. La segunda pasada (10:30) solo recoge lo que la
// primera no llegó a enviar. Pasada la fecha se puede borrar esta función y su cron.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildRecuperacionHtml } = require('./lib/emails-usuario');
const { supa } = require('./lib/supa');

const ALTA_ANTES_DE = '2026-11-05T00:00:00Z';
const CADUCA = Date.parse('2026-11-20T00:00:00Z');
const DIAS_PRUEBA = 7;
const MAX_ENVIOS = 60;
const PRESUPUESTO_MS = 22000; // la función programada tiene 30 s

// Pura — testeada en emails-usuario.test.js.
function seleccionarDestinatarios(profiles, idsConPlan, idsCoachDashboard) {
  const conPlan = new Set(idsConPlan || []);
  const dashboard = new Set(idsCoachDashboard || []);
  return (profiles || []).filter(p =>
    p && p.id && p.email && p.deporte && p.plan !== 'pro' && !p.deleted_at && !p.recuperacion_enviada_at
    && Date.parse(p.created_at) < Date.parse(ALTA_ANTES_DE)
    && !conPlan.has(p.id) && !dashboard.has(p.id)
  ).slice(0, MAX_ENVIOS);
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;
  if (Date.now() > CADUCA) return { statusCode: 200, body: JSON.stringify({ caducada: true }) };
  if (!emailsEnabled()) return { statusCode: 200, body: JSON.stringify({ pausado: true }) };

  const inicio = Date.now();
  const [perfiles, planes, atletas] = await Promise.all([
    supa('GET', `profiles?deleted_at=is.null&recuperacion_enviada_at=is.null&plan=neq.pro&deporte=not.is.null&created_at=lt.${encodeURIComponent(ALTA_ANTES_DE)}&select=id,email,nombre,deporte,plan,deleted_at,created_at,recuperacion_enviada_at&limit=500`),
    supa('GET', 'plans?select=user_id&limit=5000'),
    supa('GET', 'coach_athletes?select=athlete_id&limit=1000'),
  ]);
  // Si no se puede saber quién tiene plan o quién es del Coach Dashboard, no se envía nada.
  if (!perfiles.ok || !planes.ok || !atletas.ok || ![perfiles, planes, atletas].every(r => Array.isArray(r.data))) {
    console.error('[recuperacion] lectura incompleta — no se envía nada', perfiles.status, planes.status, atletas.status);
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase' }) };
  }

  const destinatarios = seleccionarDestinatarios(perfiles.data, planes.data.map(p => p.user_id), atletas.data.map(a => a.athlete_id));
  let enviados = 0, fallos = 0, pendientes = 0;
  for (const p of destinatarios) {
    if (Date.now() - inicio > PRESUPUESTO_MS) { pendientes++; continue; }
    const envio = await sendEmail(p.email, 'Tu coach de TriCoach AI ya responde (y tienes 7 días de Pro)', buildRecuperacionHtml(p.nombre));
    if (envio.status >= 200 && envio.status < 300) {
      const ahora = Date.now();
      await supa('PATCH', `profiles?id=eq.${p.id}`, {
        recuperacion_enviada_at: new Date(ahora).toISOString(),
        trial_ends_at: new Date(ahora + DIAS_PRUEBA * 24 * 60 * 60 * 1000).toISOString(),
      });
      enviados++;
    } else {
      fallos++;
      console.error('[recuperacion] fallo de envío — status:', envio.status);
    }
    await new Promise(r => setTimeout(r, 600)); // Resend: 2 peticiones/segundo
  }
  console.error(`[recuperacion] destinatarios=${destinatarios.length} enviados=${enviados} fallos=${fallos} pendientes=${pendientes}`);
  return { statusCode: 200, body: JSON.stringify({ destinatarios: destinatarios.length, enviados, fallos, pendientes }) };
};

exports.seleccionarDestinatarios = seleccionarDestinatarios;
