/**
 * weekly-report.js — Informe semanal por email para usuarios Pro
 * Scheduled: domingos a las 19:00 UTC
 */
const https = require('https')

const SUPABASE_URL = 'luqpjgzpydquqturgjmt.supabase.co'

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Accept': 'application/json',
      }
    }
    https.get(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve([]) }
      })
    }).on('error', reject)
  })
}

function getMondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  return monday.toISOString().split('T')[0]
}

function sendEmail(to, subject, html) {
  const bodyStr = JSON.stringify({
    from: 'TriCoach <coach@getricoach.com>',
    to: [to],
    subject,
    html,
  })
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
    }
    const req = https.request(options, (r) => {
      let d = ''
      r.on('data', chunk => d += chunk)
      r.on('end', () => resolve({ status: r.statusCode, body: d }))
    })
    req.on('error', (e) => resolve({ status: 500, body: e.message }))
    req.write(bodyStr)
    req.end()
  })
}

function buildEmailHtmlFree(nombre, sesiones) {
  const activas = sesiones.filter(s => s.tipo?.toLowerCase() !== 'descanso' && s.tipo?.toLowerCase() !== 'rest')
  const completadas = activas.filter(s => s.completada)
  const pct = activas.length > 0 ? Math.round((completadas.length / activas.length) * 100) : 0
  const emoji = pct === 100 ? '🏆' : pct >= 70 ? '💪' : pct >= 40 ? '📈' : '💡'

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

        <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">Tu resumen semanal, ${nombre || 'atleta'}</h1>
        <p style="color:#888;font-size:14px;margin-bottom:24px;">Esto es lo que conseguiste esta semana</p>

        <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">${emoji}</div>
          <div style="font-size:32px;font-weight:700;color:${pct === 100 ? '#4ade80' : '#FF6B2B'};">${pct}%</div>
          <div style="color:#888;font-size:13px;margin-bottom:12px;">${completadas.length} de ${activas.length} sesiones completadas</div>
          <div style="background:#1a1a1a;border-radius:99px;height:8px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${pct === 100 ? '#4ade80' : '#FF6B2B'};border-radius:99px;"></div>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://app.getricoach.com" style="background:#FF6B2B;color:#fff;padding:13px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Ver plan de la próxima semana →
          </a>
        </div>

        <div style="background:#111;border:1px solid #333;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 10px;font-size:14px;color:#aaa;line-height:1.6;">
            ¿Quieres ver el análisis completo cada semana — sesión por sesión, RPE, adherencia y mensaje del coach?
          </p>
          <a href="https://app.getricoach.com" style="color:#FF6B2B;font-weight:700;font-size:14px;text-decoration:none;">
            Hazte Pro por 9,99€/mes →
          </a>
        </div>

        <p style="color:#555;font-size:12px;text-align:center;">
          © TriCoach AI · <a href="https://app.getricoach.com/privacidad" style="color:#555;">Privacidad</a>
        </p>
      </div>
    </body>
    </html>
  `
}

function buildEmailHtml(nombre, sesiones) {
  const activas = sesiones.filter(s => s.tipo?.toLowerCase() !== 'descanso' && s.tipo?.toLowerCase() !== 'rest')
  const completadas = activas.filter(s => s.completada)
  const pct = activas.length > 0 ? Math.round((completadas.length / activas.length) * 100) : 0

  const ICONOS = { Correr: '🏃', Bici: '🚴', Nadar: '🏊', Fuerza: '💪', Brick: '🧱', Descanso: '😴' }

  const filas = sesiones.map(s => {
    const icono = ICONOS[s.tipo] || '🏋️'
    const estado = s.completada
      ? `<span style="color:#4ade80;font-weight:600;">✓ Completada${s.rpe ? ` (RPE ${s.rpe})` : ''}</span>`
      : `<span style="color:#888;">Pendiente</span>`
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #222;">${icono} <strong>${s.dia}</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #222;">${s.tipo}</td>
      <td style="padding:8px 0;border-bottom:1px solid #222;">${estado}</td>
    </tr>`
  }).join('')

  const emoji = pct === 100 ? '🏆' : pct >= 70 ? '💪' : pct >= 40 ? '📈' : '💡'
  const mensaje = pct === 100
    ? '¡Semana perfecta! Completaste todo el plan. Eso es lo que diferencia a los campeones.'
    : pct >= 70
      ? 'Buena semana. Mantén la consistencia y verás los resultados.'
      : pct >= 40
        ? 'Semana parcial — la próxima semana puedes mejorar. Cada sesión cuenta.'
        : 'Semana difícil, pero sigues aquí. Empieza la próxima semana con fuerza.'

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

        <h1 style="font-size:24px;font-weight:700;margin-bottom:4px;">Tu resumen semanal, ${nombre || 'atleta'}</h1>
        <p style="color:#888;font-size:14px;margin-bottom:24px;">Esto es lo que conseguiste esta semana</p>

        <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">${emoji}</div>
          <div style="font-size:32px;font-weight:700;color:${pct === 100 ? '#4ade80' : '#FF6B2B'};">${pct}%</div>
          <div style="color:#888;font-size:13px;margin-bottom:12px;">${completadas.length} de ${activas.length} sesiones completadas</div>
          <div style="background:#1a1a1a;border-radius:99px;height:8px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${pct === 100 ? '#4ade80' : '#FF6B2B'};border-radius:99px;"></div>
          </div>
        </div>

        <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #333;color:#888;font-weight:500;">Día</th>
                <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #333;color:#888;font-weight:500;">Sesión</th>
                <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #333;color:#888;font-weight:500;">Estado</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>

        <div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#ccc;">${mensaje}</p>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="https://app.getricoach.com" style="background:#FF6B2B;color:#fff;padding:13px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Ver plan de la próxima semana →
          </a>
        </div>

        <p style="color:#555;font-size:12px;text-align:center;">
          © TriCoach AI · <a href="https://app.getricoach.com/privacidad" style="color:#555;">Privacidad</a>
        </p>
      </div>
    </body>
    </html>
  `
}

exports.handler = async () => {
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[weekly-report] Missing env vars')
    return { statusCode: 500, body: 'Missing env vars' }
  }

  const monday = getMondayOfCurrentWeek()
  console.log(`[weekly-report] Generando informes para semana ${monday}`)

  // Obtener todos los usuarios (Pro y Free)
  let profiles
  try {
    profiles = await supabaseGet(`profiles?deleted_at=is.null&select=id,email,nombre,plan`)
  } catch (e) {
    console.error('[weekly-report] Error obteniendo perfiles:', e.message)
    return { statusCode: 500, body: 'Error fetching profiles' }
  }

  if (!Array.isArray(profiles) || profiles.length === 0) {
    console.log('[weekly-report] No hay usuarios')
    return { statusCode: 200, body: 'No users' }
  }

  let enviados = 0
  let errores = 0

  for (const profile of profiles) {
    if (!profile.email) continue
    try {
      // Obtener el plan de esta semana para el usuario
      const plans = await supabaseGet(
        `plans?user_id=eq.${profile.id}&semana=eq.${monday}&select=sesiones`
      )
      const plan = Array.isArray(plans) && plans[0]
      if (!plan?.sesiones || plan.sesiones.length === 0) continue

      const esPro = profile.plan === 'pro'
      const html = esPro
        ? buildEmailHtml(profile.nombre, plan.sesiones)
        : buildEmailHtmlFree(profile.nombre, plan.sesiones)
      const result = await sendEmail(
        profile.email,
        '📊 Tu resumen semanal de TriCoach',
        html
      )

      if (result.status >= 200 && result.status < 300) {
        enviados++
        console.log(`[weekly-report] Email enviado a ${profile.email}`)
      } else {
        errores++
        console.error(`[weekly-report] Error enviando a ${profile.email}:`, result.body)
      }
    } catch (e) {
      errores++
      console.error(`[weekly-report] Excepción para ${profile.email}:`, e.message)
    }
  }

  console.log(`[weekly-report] Completado — enviados: ${enviados}, errores: ${errores}`)
  return { statusCode: 200, body: JSON.stringify({ enviados, errores }) }
}
