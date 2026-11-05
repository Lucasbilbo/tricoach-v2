const { authenticate, corsHeaders } = require('./lib/auth')
const https = require('https')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

let CORS = corsHeaders()

function supabaseGet(path) {
  const hostname = new URL(SUPABASE_URL).hostname
  return new Promise((resolve) => {
    https.get({
      hostname,
      path: `/rest/v1/${path}`,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve(null) } })
    }).on('error', () => resolve(null))
  })
}

async function getIntervalsCredentials(userId) {
  const rows = await supabaseGet(`profiles?id=eq.${userId}&select=intervals_athlete_id,intervals_api_key`)
  if (!Array.isArray(rows) || rows.length === 0) return null
  const { intervals_athlete_id, intervals_api_key } = rows[0]
  if (!intervals_athlete_id || !intervals_api_key) return null
  return { athleteId: intervals_athlete_id, apiKey: intervals_api_key }
}

function intervalsRequest(method, path, apiKey, body) {
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const bodyStr = body ? JSON.stringify(body) : null
  return new Promise((resolve) => {
    const options = {
      hostname: 'intervals.icu',
      path,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ statusCode: res.statusCode, body: data }) }
      })
    })
    req.on('error', (e) => resolve({ statusCode: 500, body: { error: e.message } }))
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

exports.handler = async (event) => {
  CORS = corsHeaders(event, 'GET, POST, DELETE, OPTIONS')
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  // El usuario sale del token; el userId de la query/body solo se compara
  let bodyParsed = null
  if (event.httpMethod === 'POST') {
    try { bodyParsed = JSON.parse(event.body || '{}') }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) } }
  }
  const claimedUserId = bodyParsed?.userId || (event.queryStringParameters || {}).userId
  const auth = await authenticate(event, { cors: CORS, bodyUserId: claimedUserId })
  if (!auth.ok) return auth.response

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Supabase no configurado' }) }
  }

  const params = new URLSearchParams(event.queryStringParameters || {})
  const action = params.get('action')

  // GET — wellness o list
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (event.httpMethod === 'GET') {
    const userId = auth.userId
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) }
    if (!UUID_REGEX.test(userId)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) }

    const creds = await getIntervalsCredentials(userId)
    if (!creds) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Intervals no configurado' }) }

    if (action === 'wellness') {
      const today = new Date().toISOString().slice(0, 10)
      const result = await intervalsRequest('GET', `/api/v1/athlete/${creds.athleteId}/wellness?oldest=${today}&newest=${today}`, creds.apiKey)
      return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
    }

    if (action === 'list') {
      const start = params.get('start') || new Date().toISOString().slice(0, 10)
      const end = params.get('end') || new Date().toISOString().slice(0, 10)
      const result = await intervalsRequest('GET', `/api/v1/athlete/${creds.athleteId}/events?oldest=${start}&newest=${end}`, creds.apiKey)
      return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Acción no reconocida' }) }
  }

  // POST — crear evento
  if (event.httpMethod === 'POST') {
    const { userId: _ignorado, ...eventData } = bodyParsed
    const userId = auth.userId
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) }
    if (!UUID_REGEX.test(userId)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) }

    const creds = await getIntervalsCredentials(userId)
    if (!creds) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Intervals no configurado' }) }

    const result = await intervalsRequest('POST', `/api/v1/athlete/${creds.athleteId}/events`, creds.apiKey, eventData)
    return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
  }

  // DELETE — borrar evento
  if (event.httpMethod === 'DELETE') {
    const userId = auth.userId
    const id = params.get('id')
    if (!userId || !id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId e id requeridos' }) }
    if (!UUID_REGEX.test(userId)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) }

    const creds = await getIntervalsCredentials(userId)
    if (!creds) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Intervals no configurado' }) }

    const result = await intervalsRequest('DELETE', `/api/v1/athlete/${creds.athleteId}/events/${id}`, creds.apiKey)
    return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
  }

  return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' }
}
