// Captura de email antes del registro (motor B). Enlaces firmados con HMAC de INTERNAL_API_SECRET:
// el token nunca se guarda en base de datos y no viaja al navegador hasta que llega en el email.
const crypto = require('crypto');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[a-z]{2,}$/i;
const BASE = 'https://getricoach.com/.netlify/functions';
const ACCIONES = ['confirmar', 'baja'];

function firmar(accion, id) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || !ACCIONES.includes(accion)) return null;
  return crypto.createHmac('sha256', secret).update(`sub:${accion}:${id}`).digest('hex').slice(0, 32);
}

function verificar(accion, id, token) {
  if (!UUID_REGEX.test(id || '') || typeof token !== 'string') return false;
  const esperado = firmar(accion, id);
  if (!esperado || token.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
}

function urlAccion(accion, id) {
  if (!UUID_REGEX.test(id || '')) return null;
  const t = firmar(accion, id);
  return t ? `${BASE}/suscripcion?a=${accion}&u=${id}&t=${t}` : null;
}

function normalizarEmail(e) {
  const s = String(e || '').trim().toLowerCase();
  return s.length <= 254 && EMAIL_REGEX.test(s) ? s : null;
}

// Solo slugs de nuestras propias páginas (letras, números y guiones).
function normalizarOrigen(o) {
  const s = String(o || '').trim().toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(s) ? s : 'web';
}

module.exports = { firmar, verificar, urlAccion, normalizarEmail, normalizarOrigen, UUID_REGEX };
