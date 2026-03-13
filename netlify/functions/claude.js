const https = require('https');

const MAX_BODY_BYTES = 64 * 1024;
const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_MAX_TOKENS = 1000;

const DAILY_LIMIT = { free: 25, pro: 150 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function supabaseGet(hostname, path, key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'GET',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)[0]); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function supabasePatch(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'PATCH',
      headers: {
        'apikey': key, 'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (r) => {
      r.on('data', () => {});
      r.on('end', () => resolve(r.statusCode));
    });
    req.on('error', () => resolve(500));
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = event.headers['x-tricoach-secret'];
  if (FUNCTION_SECRET && secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
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

  // ── Rate limiting via Supabase ──
  const { userId } = parsed;
  if (userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const hostname = new URL(supabaseUrl).hostname;

    const profile = await supabaseGet(
      hostname,
      `/rest/v1/profiles?id=eq.${userId}&select=plan,messages_today,last_message_date`,
      supabaseKey
    );

    if (profile) {
      const today = new Date().toISOString().split('T')[0]; // UTC date
      const plan = profile.plan || 'free';
      const limit = DAILY_LIMIT[plan] ?? DAILY_LIMIT.free;

      // Reset counter if date has changed
      const currentCount = profile.last_message_date === today ? (profile.messages_today || 0) : 0;

      if (currentCount >= limit) {
        return {
          statusCode: 429,
          headers: CORS,
          body: JSON.stringify({ error: 'Has alcanzado el límite de mensajes de hoy' })
        };
      }

      // Increment counter in Supabase BEFORE calling Claude
      await supabasePatch(
        hostname,
        `/rest/v1/profiles?id=eq.${userId}`,
        supabaseKey,
        { messages_today: currentCount + 1, last_message_date: today }
      );
    }
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

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
