const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
  }
  return entry.count > RATE_LIMIT_MAX;
}

const MAX_BODY_BYTES = 64 * 1024;
const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

// ── Modelo fijo en backend — nunca viene del frontend ──
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_MAX_TOKENS = 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = event.headers['x-tricoach-secret'];
  if (FUNCTION_SECRET && secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const rawBody = event.body || '';
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: 'Request demasiado grande' }) };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'messages requerido' }) };
  }

  if (parsed.messages.length > 60) {
    parsed.messages = parsed.messages.slice(-60);
  }

  // ── Validar límite Free en backend ──
  const { userId } = parsed;
  if (userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const profileData = await new Promise((res) => {
      const path = `/rest/v1/profiles?id=eq.${userId}&select=plan,messages_today,last_message_date`;
      const options = {
        hostname: new URL(supabaseUrl).hostname,
        path,
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      };
      const req = https.request(options, (r) => {
        let d = '';
        r.on('data', chunk => d += chunk);
        r.on('end', () => {
          try { res(JSON.parse(d)[0]); } catch { res(null); }
        });
      });
      req.on('error', () => res(null));
      req.end();
    });

    if (profileData && profileData.plan === 'free') {
      const today = new Date().toISOString().split('T')[0];
      if (profileData.last_message_date === today && profileData.messages_today >= 10) {
        return {
          statusCode: 429,
          headers: CORS,
          body: JSON.stringify({ error: 'Límite diario alcanzado. Actualiza a Pro.' })
        };
      }
    }
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  // Eliminar userId, model y max_tokens del body — los ponemos nosotros, no el frontend
  const { userId: _u, model: _m, max_tokens: _mt, ...parsedClean } = parsed;
  const body = JSON.stringify({
    ...parsedClean,
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: data
        });
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) });
    });

    req.write(body);
    req.end();
  });
};