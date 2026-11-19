// Envío de sesiones de TriCoach al calendario de Intervals.icu SIN duplicar.
// Los eventos de TriCoach llevan `external_id` = `tricoach-<planId>-<dia>`; antes de enviar
// se borran los que TriCoach ya había puesto esos días. Los de otras fuentes (p. ej. las
// sesiones del Coach Dashboard) no se tocan nunca.
// Tests: src/test/intervals-sync.test.js
const https = require('https')

const PREFIJO_EXTERNAL_ID = 'tricoach-'
// Formato de nombre que usaba TriCoach antes de external_id: "Fuerza general y core — 50min"
// o "Correr — TriCoach" (botón manual). El Coach Dashboard usa " · " y no coincide.
const NOMBRE_LEGACY = /\s—\s(\d+min|TriCoach)$/

function externalIdSesion(planId, dia) {
  return `${PREFIJO_EXTERNAL_ID}${planId || 'sin-plan'}-${String(dia || '').toLowerCase()}`
}

/** ¿Es un evento que puso TriCoach (y por tanto se puede reemplazar)? */
function esEventoTriCoach(ev) {
  if (!ev || typeof ev !== 'object') return false
  if (typeof ev.external_id === 'string' && ev.external_id.startsWith(PREFIJO_EXTERNAL_ID)) return true
  if (ev.category !== 'WORKOUT') return false
  return typeof ev.name === 'string' && NOMBRE_LEGACY.test(ev.name)
}

function intervalsRequest(method, path, apiKey, body, timeoutMs = 4000) {
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const bodyStr = body ? JSON.stringify(body) : null
  return new Promise((resolve) => {
    let hecho = false
    const fin = (r) => { if (!hecho) { hecho = true; resolve(r) } }
    const req = https.request({
      hostname: 'intervals.icu',
      path,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { fin({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { fin({ status: res.statusCode, data: null }) }
      })
    })
    req.on('error', () => fin({ status: 500, data: null }))
    setTimeout(() => { fin({ status: 504, data: null }); req.destroy() }, timeoutMs)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/**
 * Borra de Intervals los eventos de TriCoach entre dos fechas (YYYY-MM-DD, ambas incluidas).
 * @returns {{ ok: boolean, borrados: number }} ok=false si no se pudo listar el calendario
 */
async function borrarEventosTriCoach(athleteId, apiKey, desde, hasta) {
  const lista = await intervalsRequest('GET', `/api/v1/athlete/${athleteId}/events?oldest=${desde}&newest=${hasta}`, apiKey)
  if (lista.status < 200 || lista.status >= 300 || !Array.isArray(lista.data)) {
    return { ok: false, borrados: 0 }
  }
  const objetivo = lista.data.filter(esEventoTriCoach)
  const resultados = await Promise.all(
    objetivo.map(ev => intervalsRequest('DELETE', `/api/v1/athlete/${athleteId}/events/${ev.id}`, apiKey))
  )
  return { ok: true, borrados: resultados.filter(r => r.status >= 200 && r.status < 300).length }
}

module.exports = {
  PREFIJO_EXTERNAL_ID,
  externalIdSesion,
  esEventoTriCoach,
  intervalsRequest,
  borrarEventosTriCoach,
}
