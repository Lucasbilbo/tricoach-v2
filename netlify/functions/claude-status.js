// Estado de los modelos de Claude (prueba manual, sin email).
// POST con header x-internal-secret = INTERNAL_API_SECRET.
const { isInternalCall } = require('./lib/auth');
const { probarModelos, probarCompleto } = require('./lib/salud');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' || !isInternalCall(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }
  const completo = (event.queryStringParameters || {}).modo === 'completo';
  const resultados = completo
    ? [await probarCompleto((event.queryStringParameters || {}).plan === 'pro' ? 'pro' : 'free')]
    : await probarModelos();
  const ok = resultados.every(r => (r.chat ? r.chat.ok && r.plan.ok : r.ok));
  return { statusCode: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok, resultados }) };
};
