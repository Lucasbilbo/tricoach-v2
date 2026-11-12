// Recordatorio el día de la sesión [SCHEDULED: todos los días 18:30 UTC].
//
// Objetivo: que el usuario vuelva a marcar la sesión y a subir la captura del entreno.
// A quién: cuentas (Free y Pro) no borradas, con email, con plan de la semana actual y con una
// sesión HOY (día en Europe/Madrid) que no sea descanso y no esté completada.
// Un email por cuenta y día como máximo: profiles.recordatorio_enviado_el (migración 009), que se
// marca solo si el envío sale bien. Baja: profiles.recordatorios_email = false (interruptor en EditProfile).
// Si los emails están pausados (EMAILS_ENABLED) no hace nada y no marca a nadie.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildRecordatorioSesionHtml, asuntoRecordatorioSesion } = require('./lib/emails-usuario');
const { getHoyMadrid, getMondayOfCurrentWeek } = require('./lib/fechas');
const { supa } = require('./lib/supa');

const PRESUPUESTO_MS = 22000; // la función programada tiene 30 s
const PAUSA_RESEND_MS = 600;  // Resend: 2 peticiones/segundo

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Nombre del día ('Lunes'...'Domingo') de una fecha ISO YYYY-MM-DD (ya en hora de Madrid).
// Pura — testeada en session-reminder.test.js.
function diaSemanaDe(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00Z`); // mediodía UTC: el día no cambia con el DST
  return DIAS[d.getUTCDay()];
}

function estaCompletada(sesion) {
  const c = sesion && sesion.completada;
  return c === true || c === 1 || c === 'true' || c === '1';
}

function esDescanso(sesion) {
  const tipo = sinTildes(sesion && sesion.tipo);
  return tipo === 'descanso' || tipo === 'rest' || sinTildes(sesion && sesion.intensidad) === 'descanso';
}

// La sesión pendiente de hoy (no descanso, no completada) o null. Pura.
function sesionPendienteDeHoy(sesiones, dia) {
  if (!Array.isArray(sesiones)) return null;
  const hoy = sinTildes(dia);
  return sesiones.find(s => s && sinTildes(s.dia) === hoy && !esDescanso(s) && !estaCompletada(s)) || null;
}

// Quién recibe el email hoy. Pura.
//   perfiles: filas de profiles; planes: filas de plans { user_id, semana, sesiones }
//   hoy: 'YYYY-MM-DD' (Madrid); lunes: lunes de la semana actual.
function seleccionarDestinatarios(perfiles, planes, { hoy, lunes }) {
  const dia = diaSemanaDe(hoy);
  const planDe = new Map();
  for (const pl of planes || []) {
    if (pl && pl.user_id && pl.semana === lunes && !planDe.has(pl.user_id)) planDe.set(pl.user_id, pl);
  }
  const vistos = new Set();
  const destinatarios = [];
  for (const p of perfiles || []) {
    if (!p || !p.id || !p.email || p.deleted_at || vistos.has(p.id)) continue;
    if (p.recordatorios_email === false) continue;          // baja
    if (p.recordatorio_enviado_el === hoy) continue;        // ya enviado hoy
    const plan = planDe.get(p.id);
    if (!plan) continue;
    const sesion = sesionPendienteDeHoy(plan.sesiones, dia);
    if (!sesion) continue;
    vistos.add(p.id);
    destinatarios.push({ perfil: p, sesion });
  }
  return destinatarios;
}

function consultaPerfiles(hoy) {
  return 'profiles?deleted_at=is.null&email=not.is.null&recordatorios_email=eq.true'
    + `&or=(recordatorio_enviado_el.is.null,recordatorio_enviado_el.lt.${hoy})`
    + '&select=id,email,nombre,recordatorios_email,recordatorio_enviado_el,deleted_at&limit=1000';
}

function consultaPlanes(lunes) {
  return `plans?semana=eq.${lunes}&select=user_id,semana,sesiones&limit=2000`;
}

// Núcleo con dependencias inyectadas (los tests no tocan red). Nunca registra emails.
async function procesar({ supa, enviar, hoy, lunes, esperar = ms => new Promise(r => setTimeout(r, ms)), reloj = Date.now, presupuestoMs = PRESUPUESTO_MS }) {
  const inicio = reloj();
  const [perfiles, planes] = await Promise.all([supa('GET', consultaPerfiles(hoy)), supa('GET', consultaPlanes(lunes))]);
  // Sin poder leer perfiles y planes no se envía nada.
  if (!perfiles.ok || !planes.ok || !Array.isArray(perfiles.data) || !Array.isArray(planes.data)) {
    console.error('[session-reminder] lectura incompleta — no se envía nada', perfiles.status, planes.status);
    return { error: true };
  }
  const destinatarios = seleccionarDestinatarios(perfiles.data, planes.data, { hoy, lunes });
  let enviados = 0, fallos = 0, pendientes = 0;
  for (const { perfil, sesion } of destinatarios) {
    if (reloj() - inicio > presupuestoMs) { pendientes++; continue; }
    const envio = await enviar(perfil.email, asuntoRecordatorioSesion(sesion), buildRecordatorioSesionHtml(perfil.nombre, sesion));
    if (envio.status >= 200 && envio.status < 300) {
      // Solo se marca si el envío salió bien; si falla, se reintentará en la siguiente ejecución del día.
      await supa('PATCH', `profiles?id=eq.${perfil.id}`, { recordatorio_enviado_el: hoy });
      enviados++;
    } else {
      fallos++;
      console.error('[session-reminder] fallo de envío — status:', envio.status);
    }
    await esperar(PAUSA_RESEND_MS);
  }
  if (fallos > 0 || pendientes > 0) console.error(`[session-reminder] destinatarios=${destinatarios.length} enviados=${enviados} fallos=${fallos} pendientes=${pendientes}`);
  return { destinatarios: destinatarios.length, enviados, fallos, pendientes };
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;
  if (!emailsEnabled()) return { statusCode: 200, body: JSON.stringify({ pausado: true }) };

  const resultado = await procesar({ supa, enviar: sendEmail, hoy: getHoyMadrid(), lunes: getMondayOfCurrentWeek() });
  if (resultado.error) return { statusCode: 500, body: JSON.stringify({ error: 'Supabase' }) };
  return { statusCode: 200, body: JSON.stringify(resultado) };
};

exports.diaSemanaDe = diaSemanaDe;
exports.sesionPendienteDeHoy = sesionPendienteDeHoy;
exports.seleccionarDestinatarios = seleccionarDestinatarios;
exports.consultaPerfiles = consultaPerfiles;
exports.procesar = procesar;
