// Cliente REST mínimo de Supabase para functions nuevas (CJS, https nativo, service key).
// Nunca lanza: devuelve { ok, status, data }.
const https = require('https');

// devolver: true → se pide el cuerpo de la respuesta también en POST/PATCH (p. ej. una RPC).
function supa(method, path, body, { devolver = false } = {}) {
  const hostname = new URL(process.env.SUPABASE_URL).hostname;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const bodyStr = body ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (method !== 'GET' && !devolver) headers.Prefer = 'return=minimal';
    const req = https.request({ hostname, path: `/rest/v1/${path}`, method, headers }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        let data = null;
        try { data = d ? JSON.parse(d) : null; } catch { /* sin cuerpo JSON */ }
        resolve({ ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, data });
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, status: 0, data: null }); });
    req.on('error', () => resolve({ ok: false, status: 0, data: null }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = { supa };
