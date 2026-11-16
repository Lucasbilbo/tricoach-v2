// ¿Qué cuentas han dado señales de vida? (CJS) — regla común de los emails automáticos.
//
// Los emails de la secuencia de prueba y los recordatorios solo van a cuentas con actividad
// en los últimos DIAS_ACTIVIDAD días: alta reciente, haber escrito al coach, o alguna sesión
// marcada como hecha en el plan de esta semana o de la anterior.
// Tener plan NO cuenta: lo genera el cron. Tener prueba Pro tampoco: se puede conceder a una
// cuenta que no ha vuelto (16-nov-2026: 27 cuentas dormidas en toda la secuencia).

const { getMondayOfCurrentWeek } = require('./fechas');

const DIAS_ACTIVIDAD = 14;
const DIA_MS = 24 * 60 * 60 * 1000;
const TROZO = 50; // ids por consulta, para no pasarse de longitud de URL
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lunesAnterior(lunes) {
  return new Date(Date.parse(`${lunes}T12:00:00Z`) - 7 * DIA_MS).toISOString().slice(0, 10);
}

function tieneSesionHecha(sesiones) {
  if (!Array.isArray(sesiones)) return false;
  return sesiones.some(s => {
    if (!s || ![true, 1, 'true', '1'].includes(s.completada)) return false;
    const txt = v => String(v || '').toLowerCase();
    return txt(s.tipo) !== 'descanso' && txt(s.tipo) !== 'rest' && txt(s.intensidad) !== 'descanso';
  });
}

function altaReciente(perfil, ahora) {
  const alta = Date.parse(perfil && perfil.created_at);
  return Number.isFinite(alta) && alta >= ahora - DIAS_ACTIVIDAD * DIA_MS;
}

function consultaMensajes(ids, ahora) {
  const desde = encodeURIComponent(new Date(ahora - DIAS_ACTIVIDAD * DIA_MS).toISOString());
  return `messages?role=eq.user&user_id=in.(${ids.join(',')})&created_at=gt.${desde}&select=user_id&limit=5000`;
}

function consultaPlanes(ids, lunes) {
  return `plans?user_id=in.(${ids.join(',')})&semana=in.(${lunes},${lunesAnterior(lunes)})&select=user_id,sesiones&limit=1000`;
}

// Devuelve { ok, status, ids: Set } con las cuentas activas de `perfiles` (filas con id y created_at).
// Si alguna lectura falla, ok = false: quien llama NO debe enviar nada.
async function cuentasActivas(db, perfiles, { ahora = Date.now(), lunes = getMondayOfCurrentWeek() } = {}) {
  const ids = new Set();
  const porComprobar = [];
  for (const p of perfiles || []) {
    if (!p || !UUID_REGEX.test(p.id)) continue;
    if (altaReciente(p, ahora)) ids.add(p.id); else porComprobar.push(p.id);
  }
  for (let i = 0; i < porComprobar.length; i += TROZO) {
    const trozo = porComprobar.slice(i, i + TROZO);
    const [mensajes, planes] = await Promise.all([db('GET', consultaMensajes(trozo, ahora)), db('GET', consultaPlanes(trozo, lunes))]);
    if (!mensajes.ok || !planes.ok || !Array.isArray(mensajes.data) || !Array.isArray(planes.data)) {
      return { ok: false, status: mensajes.ok ? planes.status : mensajes.status, ids: new Set() };
    }
    for (const m of mensajes.data) if (m && m.user_id) ids.add(m.user_id);
    for (const pl of planes.data) if (pl && pl.user_id && tieneSesionHecha(pl.sesiones)) ids.add(pl.user_id);
  }
  return { ok: true, status: 200, ids };
}

module.exports = { DIAS_ACTIVIDAD, cuentasActivas, altaReciente, tieneSesionHecha, lunesAnterior, consultaMensajes, consultaPlanes };
