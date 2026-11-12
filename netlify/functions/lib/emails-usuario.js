// Plantillas de los emails a usuarios que no dependen de un plan semanal (CJS):
// bienvenida Pro, aviso de fin de prueba, recuperación de altas sin plan y recordatorio de sesión.
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
      'Tu cuenta <strong>TriCoach AI Pro</strong> está activa. Desde ahora el coach lee todos tus entrenos, sin tope semanal de capturas, y ajusta el plan con ellos. Además: plan nuevo cada lunes, revisión semanal los domingos, el modelo más avanzado y 20 mensajes al día.',
      'Lo que más se nota: al terminar cada sesión, sube la captura del resumen de tu reloj. El coach lee los datos y ajusta el plan con lo que has hecho de verdad.',
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
      'Cuando acabe pasarás al plan gratuito: 10 mensajes al día, coach básico y 2 capturas de entreno por semana. Tu plan y tu historial se quedan donde están.',
      'Si quieres que el coach siga leyendo todos tus entrenos, con plan nuevo cada lunes y revisión semanal, Pro cuesta 14,99 € al mes o 119 € al año, sin permanencia.',
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

// Recordatorio del día de la sesión. `sesion` sale del plan (tipo, subtipo, duracion_min).
function descripcionSesion(sesion) {
  const partes = [sesion && sesion.tipo, sesion && sesion.subtipo]
    .map(x => String(x == null ? '' : x).trim())
    .filter((x, i, a) => x && a.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i);
  const dur = Number(sesion && sesion.duracion_min);
  const base = partes.join(', ') || 'Entrenamiento';
  return Number.isFinite(dur) && dur > 0 ? `${base} (${Math.round(dur)} min)` : base;
}

function asuntoRecordatorioSesion(sesion) {
  return `Hoy te toca: ${descripcionSesion(sesion)}`.replace(/[\r\n]+/g, ' ').slice(0, 120);
}

const PIE_RECORDATORIO = 'Si no quieres estos recordatorios, desactívalos en tu perfil (Recordatorios por email) o responde a este email y te damos de baja.';

function buildRecordatorioSesionHtml(nombre, sesion) {
  return layout({
    titulo: `Hoy toca entrenar, ${esc(nombre) || 'atleta'}`,
    parrafos: [
      `Tu sesión de hoy: <strong>${esc(descripcionSesion(sesion))}</strong>.`,
      'Cuando termines, márcala como hecha y sube la captura del resumen de tu reloj. El coach lee los datos y ajusta tu plan con lo que has hecho de verdad.',
    ],
    boton: 'Abrir mi sesión de hoy →',
    pie: PIE_RECORDATORIO,
  });
}

module.exports = { APP_URL, buildBienvenidaProHtml, buildFinPruebaHtml, buildRecuperacionHtml, buildRecordatorioSesionHtml, asuntoRecordatorioSesion, descripcionSesion };
