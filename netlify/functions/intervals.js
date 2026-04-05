const https = require('https')

const FUNCTION_SECRET = process.env.TRICOACH_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

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
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  const secret = event.headers['x-tricoach-secret']
  if (FUNCTION_SECRET && secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Supabase no configurado' }) }
  }

  const params = new URLSearchParams(event.queryStringParameters || {})
  const action = params.get('action')

  // GET — wellness o list
  if (event.httpMethod === 'GET') {
    const userId = params.get('userId')
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) }

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
    let parsed
    try { parsed = JSON.parse(event.body || '{}') }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) } }

    const { userId, ...eventData } = parsed
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) }

    const creds = await getIntervalsCredentials(userId)
    if (!creds) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Intervals no configurado' }) }

    const result = await intervalsRequest('POST', `/api/v1/athlete/${creds.athleteId}/events`, creds.apiKey, eventData)
    return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
  }

  // DELETE — borrar evento
  if (event.httpMethod === 'DELETE') {
    const userId = params.get('userId')
    const id = params.get('id')
    if (!userId || !id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId e id requeridos' }) }

    const creds = await getIntervalsCredentials(userId)
    if (!creds) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Intervals no configurado' }) }

    const result = await intervalsRequest('DELETE', `/api/v1/athlete/${creds.athleteId}/events/${id}`, creds.apiKey)
    return { statusCode: result.statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(result.body) }
  }

  return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' }
}
