/**
 * thursday-reminder.js — Recordatorio semanal para usuarios sin plan
 * Scheduled: jueves a las 17:00 UTC (0 17 * * 4)
 *
 * Lógica:
 * 1. Obtiene usuarios creados hace más de 3 días
 * 2. Para cada uno, comprueba si ya tiene plan para la semana actual
 * 3. Si no tiene plan, envía email recordándoles generarlo
 */
const https = require('https')

const SUPABASE_HOSTNAME = new URL(process.env.SUPABASE_URL || 'https://placeholder.supabase.co').hostname

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_HOSTNAME,
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
    const req = https.request(options, (res) => {
      let d = ''
      res.on('data', chunk => d += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    req.on('error', (e) => resolve({ status: 500, body: e.message }))
    req.write(bodyStr)
    req.end()
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

function buildEmailHtml(nombre) {
  const displayName = nombre ? nombre.split(' ')[0] : 'atleta'
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="background:#080808;color:#f5f0e8;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;">
      <div style="max-width:480px;margin:0 auto;padding:36px 24px;">

        <div style="text-align:center;margin-bottom:28px;">
          <span style="font-size:34px;font-weight:900;letter-spacing:-1px;color:#f5f0e8;">T<span style="color:#FF6B2B;">·</span></span>
          <p style="color:#666;font-size:12px;margin:4px 0 0;letter-spacing:.08em;text-transform:uppercase;">TriCoach AI</p>
        </div>

        <div style="background:#111;border:1px solid #222;border-radius:14px;padding:28px 24px;margin-bottom:20px;">
          <p style="font-size:20px;font-weight:700;margin:0 0 12px;line-height:1.3;">
            ¿Ya tienes tu plan para esta semana, ${displayName}?
          </p>
          <p style="color:#aaa;font-size:15px;line-height:1.65;margin:0 0 10px;">
            Tu semana empieza sin plan — y eso es lo único que separa un entrenamiento de un paseo.
          </p>
          <p style="color:#aaa;font-size:15px;line-height:1.65;margin:0 0 10px;">
            En 30 segundos tienes las sesiones de la semana adaptadas a tu nivel y objetivo. Solo entra y pulsa «Generar plan».
          </p>
          <p style="color:#aaa;font-size:15px;line-height:1.65;margin:0;">
            Tu siguiente carrera no se entrena sola. 💪
          </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="https://app.getricoach.com" style="background:#FF6B2B;color:#fff;padding:13px 32px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Ver mi plan →
          </a>
        </div>

        <p style="color:#444;font-size:12px;text-align:center;margin:0;">
          © TriCoach AI · <a href="https://getricoach.com/privacidad" style="color:#444;">Privacidad</a>
        </p>

      </div>
    </body>
    </html>
  `
}

exports.handler = async () => {
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_KEY || !process.env.SUPABASE_URL) {
    console.error('[thursday-reminder] Missing env vars')
    return { statusCode: 500, body: 'Missing env vars' }
  }

  const monday = getMondayOfCurrentWeek()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  console.log(`[thursday-reminder] Semana ${monday} — buscando usuarios sin plan`)

  // 1. Obtener usuarios creados hace más de 3 días
  let profiles
  try {
    profiles = await supabaseGet(
      `profiles?created_at=lt.${encodeURIComponent(threeDaysAgo)}&deleted_at=is.null&select=id,email,nombre`
    )
  } catch (e) {
    console.error('[thursday-reminder] Error obteniendo perfiles:', e.message)
    return { statusCode: 500, body: 'Error fetching profiles' }
  }

  if (!Array.isArray(profiles) || profiles.length === 0) {
    console.log('[thursday-reminder] No hay usuarios elegibles')
    return { statusCode: 200, body: 'No eligible users' }
  }

  let enviados = 0
  let saltados = 0
  let errores = 0

  for (const profile of profiles) {
    if (!profile.email) continue

    try {
      // 2. Comprobar si ya tiene plan para esta semana
      const plans = await supabaseGet(
        `plans?user_id=eq.${profile.id}&semana=eq.${monday}&select=id`
      )
      if (Array.isArray(plans) && plans.length > 0) {
        saltados++
        continue
      }

      // 3. Enviar email
      const nombre = profile.nombre || ''
      const asunto = `¿Ya tienes tu plan para esta semana${nombre ? `, ${nombre.split(' ')[0]}` : ''}?`
      const html = buildEmailHtml(nombre)
      const result = await sendEmail(profile.email, asunto, html)

      if (result.status >= 200 && result.status < 300) {
        enviados++
        console.log(`[thursday-reminder] Email enviado a ${profile.email}`)
      } else {
        errores++
        console.error(`[thursday-reminder] Error enviando a ${profile.email}: ${result.body}`)
      }
    } catch (e) {
      errores++
      console.error(`[thursday-reminder] Excepción para ${profile.email}: ${e.message}`)
    }
  }

  console.log(`[thursday-reminder] Completado — enviados: ${enviados}, saltados: ${saltados}, errores: ${errores}`)
  return { statusCode: 200, body: JSON.stringify({ enviados, saltados, errores }) }
}
