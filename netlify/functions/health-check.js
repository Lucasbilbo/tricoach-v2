// Health-check diario del coach (programado en netlify.toml, todos los días 07:13 UTC).
//
// Por qué: el 15-jun-2026 Anthropic retiró el modelo que usaba TriCoach y el coach
// estuvo casi 5 meses respondiendo "Error al responder" sin que nadie se enterara.
// Esta función hace una llamada mínima a cada modelo configurado (Free y Pro) y, si
// alguna falla, manda un email a ALERT_EMAIL. Coste: dos respuestas de pocos tokens al día.
//
// Prueba manual: Netlify no deja invocar por URL una función programada; usar
// claude-status (POST con x-internal-secret), que hace la misma prueba sin email.

const { isInternalCall } = require('./lib/auth');
const { probarModelos } = require('./lib/salud');
const { sendAlertEmail } = require('./lib/email');

function esProgramada(event) {
  try { return Boolean(JSON.parse(event?.body || '{}').next_run); } catch { return false; }
}

exports.handler = async (event) => {
  // Netlify no permite invocar por URL una función programada en producción;
  // fuera de eso solo se acepta la llamada interna.
  if (!esProgramada(event) && !isInternalCall(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  const resultados = await probarModelos();
  const fallos = resultados.filter(r => !r.ok);

  if (fallos.length > 0) {
    console.error('[health-check] FALLO', JSON.stringify(fallos));
    const filas = fallos.map(f => `<li><b>${f.model}</b>: ${f.status} — ${String(f.error).replace(/</g, '&lt;')}</li>`).join('');
    await sendAlertEmail(
      '⚠️ TriCoach: el coach no responde',
      `<p>El chequeo diario de TriCoach ha fallado. Los usuarios no están recibiendo respuestas del coach.</p>
       <ul>${filas}</ul>
       <p>Si el modelo se ha retirado, cambia <code>CLAUDE_MODEL_FREE</code> / <code>CLAUDE_MODEL_PRO</code> en las variables de entorno de Netlify (o el valor por defecto en <code>netlify/functions/lib/claude.js</code>). Si es la clave o el saldo, revisa console.anthropic.com.</p>`
    );
  }

  return {
    statusCode: fallos.length ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: fallos.length === 0, resultados }),
  };
};
