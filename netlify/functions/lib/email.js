// Email vía Resend para Netlify Functions (CJS).
// Patrón de envío idéntico a weekly-report.js (consolidación futura anotada en CLAUDE.md).

const https = require('https');
const { urlBaja } = require('./baja');

// PAUSA (29-oct-2026): los emails están desactivados por defecto.
// Para reactivarlos, crear en Netlify la variable EMAILS_ENABLED=true.
function emailsEnabled() {
  return process.env.EMAILS_ENABLED === 'true';
}

const MAILTO_BAJA = 'mailto:coach@getricoach.com?subject=Baja';

// bajaUserId → el pie lleva el enlace de baja firmado y el email lleva las cabeceras List-Unsubscribe.
// Sin él (o sin INTERNAL_API_SECRET) el enlace cae a un mailto, nunca queda el marcador sin sustituir.
function sendEmail(to, subject, html, { force = false, bajaUserId = null } = {}) {
  if (!force && !emailsEnabled()) return Promise.resolve({ status: 200, body: 'emails pausados' });
  const url = bajaUserId ? urlBaja(bajaUserId) : null;
  const payload = {
    from: 'TriCoach <coach@getricoach.com>',
    to: [to],
    subject,
    html: String(html).split('{{BAJA_URL}}').join(url || MAILTO_BAJA),
  };
  if (url) payload.headers = { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  const bodyStr = JSON.stringify(payload);
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 500, body: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Email "Tu plan de esta semana está listo" — generación automática del lunes.
 * Estilo dark de los emails existentes (logo T·, acento #FF6B2B).
 */
function buildPlanListoHtml(nombre, sesiones, volumenMin) {
  const activas = (sesiones || []).filter(s => s.tipo?.toLowerCase() !== 'descanso' && s.tipo?.toLowerCase() !== 'rest');
  const horas = Math.floor((volumenMin || 0) / 60);
  const mins = (volumenMin || 0) % 60;
  const volumenStr = horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;

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

        <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">Tu plan está listo, ${nombre || 'atleta'}</h1>
        <p style="color:#888;font-size:14px;margin-bottom:24px;">Tu coach ha preparado la semana mientras dormías</p>

        <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🏃</div>
          <div style="font-size:32px;font-weight:700;color:#FF6B2B;">${activas.length} sesiones</div>
          <div style="color:#888;font-size:13px;">${volumenStr} de entrenamiento esta semana</div>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="https://app.getricoach.com" style="background:#FF6B2B;color:#fff;padding:13px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Ver mi plan →
          </a>
        </div>

        <p style="color:#666;font-size:12px;text-align:center;line-height:1.5;">
          Abres la app y sabes exactamente qué entrenar hoy.<br/>
          — Tu coach de TriCoach AI
        </p>
        <p style="color:#555;font-size:12px;text-align:center;">
          <a href="{{BAJA_URL}}" style="color:#555;">Date de baja de estos emails</a>
        </p>
      </div>
    </body>
    </html>`;
}

// Alertas técnicas para el dueño del proyecto (health-check). No dependen de
// EMAILS_ENABLED: aunque los emails a usuarios estén pausados, un fallo del coach
// tiene que avisar. Destinatario: variable ALERT_EMAIL en Netlify.
function sendAlertEmail(subject, html) {
  const to = process.env.ALERT_EMAIL;
  if (!to) {
    console.error(`[alerta] ALERT_EMAIL no configurada — alerta no enviada: ${subject}`);
    return Promise.resolve({ status: 0, body: 'sin ALERT_EMAIL' });
  }
  return sendEmail(to, subject, html, { force: true });
}

module.exports = {
  MAILTO_BAJA, sendEmail, sendAlertEmail, buildPlanListoHtml, emailsEnabled };
