// Plantillas de los emails a usuarios que no dependen de un plan semanal (CJS):
// bienvenida Pro, aviso de fin de prueba y recuperación de altas sin plan.
// El envío va por lib/email.js (respeta EMAILS_ENABLED).

const APP_URL = 'https://getricoach.com/app';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function layout({ titulo, parrafos, boton, pie }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="background:#080808;color:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;">
      <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#f5f0e8;">T<span style="color:#FF6B2B;">·</span></span>
          <p style="color:#888;font-size:13px;margin:4px 0 0;">TriCoach AI</p>
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">${titulo}</h1>
        ${parrafos.map(p => `<p style="color:#d0cbc2;font-size:15px;line-height:1.6;margin:0 0 14px;">${p}</p>`).join('\n        ')}
        <div style="text-align:center;margin:28px 0;">
          <a href="${APP_URL}" style="background:#FF6B2B;color:#fff;padding:13px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">${boton}</a>
        </div>
        <p style="color:#666;font-size:12px;line-height:1.5;text-align:center;">${pie}</p>
      </div>
    </body>
    </html>`;
}

const PIE_BAJA = 'Si no quieres recibir más correos de TriCoach AI, responde a este email y te damos de baja.';

function buildBienvenidaProHtml(nombre) {
  return layout({
    titulo: `Ya eres Pro, ${esc(nombre) || 'atleta'}`,
    parrafos: [
      'Tu cuenta <strong>TriCoach AI Pro</strong> está activa. Desde ahora tienes el coach avanzado, 20 mensajes al día, plan adaptativo cada semana y conexión con Strava.',
      'El primer paso que más se nota: conecta Strava desde tu perfil para que el coach trabaje con tus entrenamientos reales.',
      'Puedes gestionar o cancelar tu suscripción cuando quieras desde tu perfil.',
    ],
    boton: 'Abrir TriCoach AI →',
    pie: '¿Algún problema con el pago o la cuenta? Responde a este email.',
  });
}

function buildFinPruebaHtml(nombre, dias) {
  const quedan = dias <= 1 ? 'Te queda 1 día' : `Te quedan ${dias} días`;
  return layout({
    titulo: `${quedan} de prueba Pro`,
    parrafos: [
      `Hola, ${esc(nombre) || 'atleta'}. Tu prueba de TriCoach AI Pro está a punto de terminar.`,
      'Cuando acabe pasarás al plan gratuito: 10 mensajes al día y coach básico. Tu plan y tu historial se quedan donde están.',
      'Si quieres seguir con el coach avanzado, 20 mensajes al día y Strava, Pro cuesta 14,99 € al mes o 119 € al año, sin permanencia.',
    ],
    boton: 'Seguir en Pro →',
    pie: PIE_BAJA,
  });
}

function buildRecuperacionHtml(nombre) {
  return layout({
    titulo: `${esc(nombre) || 'Hola'}, tu coach ya responde`,
    parrafos: [
      'Te registraste en TriCoach AI y no llegaste a recibir tu plan de entrenamiento.',
      'Parte fue culpa nuestra: durante unos meses el coach tuvo un fallo y no respondía. Ya está arreglado.',
      'Para compensarlo te hemos activado <strong>7 días de Pro, sin tarjeta</strong>. Entra, pulsa "Generar mi plan" y tendrás tu semana en un par de minutos.',
    ],
    boton: 'Crear mi plan →',
    pie: `Te escribimos una sola vez por este motivo. ${PIE_BAJA}`,
  });
}

module.exports = { APP_URL, buildBienvenidaProHtml, buildFinPruebaHtml, buildRecuperacionHtml };
