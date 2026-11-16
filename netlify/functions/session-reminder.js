// Recordatorio el día de la sesión [SCHEDULED: todos los días 18:30 UTC].
//
// Objetivo: que el usuario vuelva a marcar la sesión y a subir la captura del entreno.
// A quién: cuentas (Free y Pro) no borradas, con email, con plan de la semana actual y con una
// sesión HOY (día en Europe/Madrid) que no sea descanso y no esté completada.
// Un email por cuenta y día como máximo: profiles.recordatorio_enviado_el (migración 009), que se
// marca solo si el envío sale bien. Baja: profiles.recordatorios_email = false (interruptor en EditProfile).
// Solo a cuentas con actividad reciente (ver cuentaActiva): quien no entra en la app no recibe un
// email cada día. Sin esta regla, el plan automático del lunes convertía en destinatarias a cuentas
// en prueba que nunca habían vuelto (16-nov-2026: 24 cuentas dormidas).
// Si los emails están pausados (EMAILS_ENABLED) no hace nada y no marca a nadie.

const { guardScheduled } = require('./lib/auth');
const { sendEmail, emailsEnabled } = require('./lib/email');
const { buildRecordatorioSesionHtml, asuntoRecordatorioSesion } = require('./lib/emails-usuario');
const { getHoyMadrid, getMondayOfCurrentWeek } = require('./lib/fechas');
const { supa } = require('./lib/supa');

const PRESUPUESTO_MS = 22000; // la función programada tiene 30 s
const PAUSA_RESEND_MS = 600;  // Resend: 2 peticiones/segundo

const DIAS_ACTIVIDAD = 14;    // ventana de "actividad reciente"
const DIA_MS = 24 * 60 * 60 * 1000;

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

// Lunes de la semana anterior a `lunes` (YYYY-MM-DD). Pura.
function lunesAnterior(lunes) {
  return new Date(Date.parse(`${lunes}T12:00:00Z`) - 7 * DIA_MS).toISOString().slice(0, 10);
}

// Inicio de la ventana de actividad, como instante ISO. Pura.
function desdeActividad(hoy) {
  return new Date(Date.parse(`${hoy}T12:00:00Z`) - DIAS_ACTIVIDAD * DIA_MS).toISOString();
}

// ¿Ha dado señales de vida la cuenta en los últimos DIAS_ACTIVIDAD días? Pura.
// Cuenta como actividad: alta reciente, haber escrito al coach, o tener alguna sesión marcada
// como hecha en el plan de esta semana o de la anterior. Tener un plan NO cuenta: lo genera el cron.
function cuentaActiva(perfil, { hoy, conMensajes, conSesionHecha }) {
  if (conMensajes.has(perfil.id) || conSesionHecha.has(perfil.id)) return true;
  const alta = Date.parse(perfil.created_at);
  return Number.isFinite(alta) && alta >= Date.parse(desdeActividad(hoy));
}

// Quién recibe el email hoy. Pura.
//   perfiles: filas de profiles; planes: filas de plans { user_id, semana, sesiones } de esta
//   semana y la anterior; hoy: 'YYYY-MM-DD' (Madrid); lunes: lunes de la semana actual;
//   conMensajes: ids de cuentas que han escrito al coach en la ventana de actividad.
function seleccionarDestinatarios(perfiles, planes, { hoy, lunes, conMensajes = new Set() }) {
  const dia = diaSemanaDe(hoy);
  const planDe = new Map();
  const conSesionHecha = new Set();
  for (const pl of planes || []) {
    if (!pl || !pl.user_id) continue;
    if (pl.semana === lunes && !planDe.has(pl.user_id)) planDe.set(pl.user_id, pl);
    if (Array.isArray(pl.sesiones) && pl.sesiones.some(s => s && !esDescanso(s) && estaCompletada(s))) conSesionHecha.add(pl.user_id);
  }
  const vistos = new Set();
  const destinatarios = [];
  for (const p of perfiles || []) {
    if (!p || !p.id || !p.email || p.deleted_at || vistos.has(p.id)) continue;
    if (p.recordatorios_email === false) continue;          // baja
    if (p.recordatorio_enviado_el === hoy) continue;        // ya enviado hoy
    if (!cuentaActiva(p, { hoy, conMensajes, conSesionHecha })) continue; // no entra en la app
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
  return 'profiles?deleted_at=is.null&email=not.is.null&recordatorios_email=eq.true&emails_baja_at=is.null'
    + `&or=(recordatorio_enviado_el.is.null,recordatorio_enviado_el.lt.${hoy})`
    + '&select=id,email,nombre,recordatorios_email,recordatorio_enviado_el,deleted_at,created_at&limit=1000';
}

// Planes de esta semana (para la sesión de hoy) y de la anterior (para saber si la cuenta está activa).
function consultaPlanes(lunes) {
  return `plans?semana=in.(${lunes},${lunesAnterior(lunes)})&select=user_id,semana,sesiones&limit=4000`;
}

// Cuentas que han escrito al coach en la ventana de actividad.
function consultaMensajes(hoy) {
  return `messages?role=eq.user&created_at=gt.${encodeURIComponent(desdeActividad(hoy))}&select=user_id&limit=10000`;
}

// Núcleo con dependencias inyectadas (los tests no tocan red). Nunca registra emails.
async function procesar({ supa, enviar, hoy, lunes, esperar = ms => new Promise(r => setTimeout(r, ms)), reloj = Date.now, presupuestoMs = PRESUPUESTO_MS }) {
  const inicio = reloj();
  const [perfiles, planes, mensajes] = await Promise.all([
    supa('GET', consultaPerfiles(hoy)), supa('GET', consultaPlanes(lunes)), supa('GET', consultaMensajes(hoy)),
  ]);
  // Sin poder leer perfiles, planes y actividad no se envía nada.
  if (![perfiles, planes, mensajes].every(r => r.ok && Array.isArray(r.data))) {
    console.error('[session-reminder] lectura incompleta — no se envía nada', perfiles.status, planes.status, mensajes.status);
    return { error: true };
  }
  const conMensajes = new Set(mensajes.data.map(m => m && m.user_id).filter(Boolean));
  const destinatarios = seleccionarDestinatarios(perfiles.data, planes.data, { hoy, lunes, conMensajes });
  let enviados = 0, fallos = 0, pendientes = 0;
  for (const { perfil, sesion } of destinatarios) {
    if (reloj() - inicio > presupuestoMs) { pendientes++; continue; }
    const envio = await enviar(perfil.email, asuntoRecordatorioSesion(sesion), buildRecordatorioSesionHtml(perfil.nombre, sesion), { bajaUserId: perfil.id });
    if (envio.status >= 200 && envio.status < 300) {
      // Solo se marca si el envío salió bien. El cron corre una vez al día: si falla, hoy no hay recordatorio.
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
exports.consultaPlanes = consultaPlanes;
exports.consultaMensajes = consultaMensajes;
exports.cuentaActiva = cuentaActiva;
exports.lunesAnterior = lunesAnterior;
exports.procesar = procesar;
