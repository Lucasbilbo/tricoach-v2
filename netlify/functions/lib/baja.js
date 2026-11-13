// Enlace de baja de emails: firma HMAC del userId con INTERNAL_API_SECRET (nunca viaja al navegador).
// El enlace no caduca: una baja debe poder hacerse desde un email antiguo.
const crypto = require('crypto');

const BASE = 'https://getricoach.com/.netlify/functions/baja-emails';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firmar(userId) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`baja:${userId}`).digest('hex').slice(0, 32);
}

function verificar(userId, token) {
  if (!UUID_REGEX.test(userId || '') || typeof token !== 'string') return false;
  const esperado = firmar(userId);
  if (!esperado || token.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
}

// Sin secreto o sin userId válido → null (quien llama usa el mailto de respaldo).
function urlBaja(userId) {
  if (!UUID_REGEX.test(userId || '')) return null;
  const t = firmar(userId);
  return t ? `${BASE}?u=${userId}&t=${t}` : null;
}

module.exports = { firmar, verificar, urlBaja, UUID_REGEX };
