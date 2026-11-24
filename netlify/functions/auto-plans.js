const { guardScheduled } = require('./lib/auth');
// Orquestador de generación automática semanal de planes.
// SCHEDULED: lunes 03:00 UTC (= 04:00/05:00 Madrid — fuera de la ventana de
// peligro DST; ver tasks/analisis-flujo-datos.md §4). Config en netlify.toml.
//
// Flujo por usuario elegible (Pro de pago o en prueba Pro + ciclo activo + no borrado):
//   1. syncUsuario() de strava-sync — adherencia fresca ANTES de generar
//   2. POST a generate-plan (camino interno, SIN forzar → idempotente):
//      el email y la limpieza de contexto_proxima_semana van dentro de generate-plan
// El fallo de un usuario nunca rompe el resto. Nunca se loguean tokens ni secrets.

const https = require('https');
const http = require('http');
const { getMondayOfCurrentWeek } = require('./lib/fechas');
const { syncUsuario } = require('./strava-sync');
const { supa } = require('./lib/supa');
const { cuentasActivas } = require('./lib/actividad');

const BATCH_SIZE = 3;
const DEADLINE_MS = 20000; // margen frente al límite ~26s de Netlify

function supabaseGet(hostname, path, key) {
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Quién recibe plan automático: Pro de pago y cuentas dentro de su prueba Pro
 * (desde nov-2026; antes solo Pro). Pura — testeada en auto-plans.test.js.
 */
function filtroPlan(ahora = Date.now()) {
  return `or=(plan.eq.pro,trial_ends_at.gt.${encodeURIComponent(new Date(ahora).toISOString())})`;
}

/** Intersección Pro + ciclo activo. Pura — testeada en auto-plans.test.js. */
function filtrarElegibles(profiles, cycleUserIds) {
  const conCiclo = new Set(cycleUserIds || []);
  return (profiles || []).filter(p => p?.id && conCiclo.has(p.id));
}

/**
 * Pro de pago: siempre. Cuenta solo en prueba (plan distinto de 'pro'): únicamente si está
 * activa (cuentasActivas, decisión 24-nov-2026: una generación con el modelo caro por cuenta
 * dormida no se paga). Pura — testeada en auto-plans.test.js.
 */
function filtrarPorActividad(elegibles, activasIds) {
  const activas = activasIds instanceof Set ? activasIds : new Set(activasIds || []);
  return (elegibles || []).filter(p => p.plan === 'pro' || activas.has(p.id));
}

/**
 * Body del POST interno a generate-plan. NUNCA incluye `forzar` — si el plan de
 * la semana ya existe (p. ej. generado a mano el domingo), generate-plan responde
 * { ya_existe: true } sin coste. `limpiar_contexto` solo viaja si hay nota.
 */
function construirBodyGeneracion(userId, fechaInicio, nota) {
  const body = { userId, fechaInicio, notificar: true };
  if (nota && String(nota).trim()) {
    body.contexto_semana = String(nota).trim();
    body.limpiar_contexto = true;
  }
  return body;
}

/**
 * POST a generate-plan con espera acotada: la petición queda entregada en cuanto
 * se hace flush del body (la generación sobrevive aunque el orquestador termine);
 * si la respuesta no llega en timeoutMs, se resuelve 'pendiente' sin abortar.
 */
function postGeneracion(body, timeoutMs) {
  return new Promise((resolve) => {
    const base = new URL(process.env.URL || 'http://localhost:8888');
    const mod = base.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    let settled = false;
    const done = (outcome) => { if (!settled) { settled = true; resolve(outcome); } };

    const req = mod.request({
      hostname: base.hostname,
      port: base.port || undefined,
      path: '/.netlify/functions/generate-plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.ya_existe) return done('ya_existe');
          if (json.id || json.sesiones) return done('generado');
          done('error');
        } catch { done('error'); }
      });
    });
    req.on('error', () => done('error'));
    // Petición entregada + sin respuesta a tiempo → pendiente (no se aborta el socket)
    setTimeout(() => done('pendiente'), timeoutMs);
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const bloqueo = guardScheduled(event);
  if (bloqueo) return bloqueo;

  const inicio = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[auto-plans] SUPABASE_URL/SERVICE_KEY no configuradas');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }
  const hostname = new URL(supabaseUrl).hostname;

  // Lunes de ESTA semana en Europe/Madrid — siempre explícito, nunca inferido por generate-plan
  const fechaInicio = getMondayOfCurrentWeek();

  // Elegibles: Pro + no borrado + ciclo activo
  const cycles = await supabaseGet(hostname, '/rest/v1/training_cycles?estado=eq.active&select=user_id', supabaseKey);
  const cycleUserIds = Array.isArray(cycles) ? cycles.map(c => c.user_id) : [];

  let profiles = await supabaseGet(hostname, `/rest/v1/profiles?${filtroPlan()}&deleted_at=is.null&select=id,email,nombre,plan,created_at,contexto_proxima_semana`, supabaseKey);
  if (profiles && profiles.code === '42703') {
    // Migración 004 aún no ejecutada — funcionar sin la columna de notas
    console.error('[auto-plans] columna contexto_proxima_semana no existe (migración 004 pendiente) — continuando sin notas');
    profiles = await supabaseGet(hostname, `/rest/v1/profiles?${filtroPlan()}&deleted_at=is.null&select=id,email,nombre,plan,created_at`, supabaseKey);
  }

  const conCiclo = filtrarElegibles(Array.isArray(profiles) ? profiles : [], cycleUserIds);
  // Cuentas solo en prueba: únicamente si están activas. Si no se puede leer la actividad, se
  // generan solo las Pro de pago (nunca se gasta modelo caro a ciegas).
  const soloPrueba = conCiclo.filter(p => p.plan !== 'pro');
  let activasIds = new Set();
  if (soloPrueba.length) {
    const act = await cuentasActivas(supa, soloPrueba, { lunes: fechaInicio });
    if (act.ok) activasIds = act.ids;
    else console.error(`[auto-plans] no se pudo leer la actividad (status ${act.status}); solo Pro de pago`);
  }
  const elegibles = filtrarPorActividad(conCiclo, activasIds);
  const omitidasDormidas = conCiclo.length - elegibles.length;
  const resumen = { generados: 0, ya_existian: 0, fallos: 0, pendientes: 0, syncs_fallidos: 0 };

  for (let i = 0; i < elegibles.length; i += BATCH_SIZE) {
    const lote = elegibles.slice(i, i + BATCH_SIZE);
    await Promise.all(lote.map(async (p) => {
      try {
        // 1. Adherencia fresca: sin esto, el generador vería sesiones sin marcar
        //    y reduciría carga injustificadamente (informe §5a)
        try {
          await syncUsuario(p.id);
        } catch (e) {
          resumen.syncs_fallidos++;
          console.error(`[auto-plans] sync falló para ${p.id}: ${e.message}`);
        }
        // 2. Generación idempotente, con espera acotada al presupuesto restante
        const restante = DEADLINE_MS - (Date.now() - inicio);
        const timeoutMs = Math.max(2500, Math.min(15000, restante));
        const outcome = await postGeneracion(construirBodyGeneracion(p.id, fechaInicio, p.contexto_proxima_semana), timeoutMs);
        if (outcome === 'generado') resumen.generados++;
        else if (outcome === 'ya_existe') resumen.ya_existian++;
        else if (outcome === 'pendiente') resumen.pendientes++;
        else resumen.fallos++;
      } catch (e) {
        resumen.fallos++;
        console.error(`[auto-plans] usuario ${p.id} falló: ${e.message}`);
      }
    }));
  }

  console.log(`[auto-plans] semana=${fechaInicio} elegibles=${elegibles.length} dormidas_omitidas=${omitidasDormidas} generados=${resumen.generados} ya_existian=${resumen.ya_existian} pendientes=${resumen.pendientes} fallos=${resumen.fallos} syncs_fallidos=${resumen.syncs_fallidos} duracion=${Date.now() - inicio}ms`);

  return {
    statusCode: 200,
    body: JSON.stringify({ fechaInicio, elegibles: elegibles.length, ...resumen })
  };
};

exports.filtrarElegibles = filtrarElegibles;
exports.filtroPlan = filtroPlan;
exports.filtrarPorActividad = filtrarPorActividad;
exports.construirBodyGeneracion = construirBodyGeneracion;
