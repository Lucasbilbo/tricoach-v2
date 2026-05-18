const https = require('https');

const MAX_BODY_BYTES = 64 * 1024;
const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_MAX_TOKENS = 2048;

const DAILY_LIMIT = { free: 25, pro: 150 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function withTimeout(promise, ms, errorMsg) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timer]);
}

function callClaude(apiKey, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

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

// Atomic rate-limit increment via Postgres RPC.
// Required SQL (run once in Supabase SQL Editor):
//   CREATE OR REPLACE FUNCTION increment_messages_today(p_user_id uuid, p_limit int, p_today text)
//   RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
//   DECLARE new_count int;
//   BEGIN
//     UPDATE profiles
//     SET messages_today = CASE WHEN last_message_date::text = p_today THEN messages_today + 1 ELSE 1 END,
//         last_message_date = p_today::date
//     WHERE id = p_user_id AND (last_message_date::text != p_today OR messages_today < p_limit)
//     RETURNING messages_today INTO new_count;
//     RETURN COALESCE(new_count, -1);
//   END; $$;
//   GRANT EXECUTE ON FUNCTION increment_messages_today TO service_role;
function supabaseRpc(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: {
        'apikey': key, 'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = event.headers['x-tricoach-secret'];
  if (!FUNCTION_SECRET) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }
  if (secret !== FUNCTION_SECRET) {
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

  // ── Rate limiting via atomic Supabase RPC ──
  const { userId } = parsed;
  if (userId) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(userId)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const hostname = new URL(supabaseUrl).hostname;

    // Read plan to determine the right limit, then atomically increment
    // Both Supabase calls are wrapped with a 5s timeout — if Supabase is slow the handler
    // must not hang until Netlify's 26s function timeout kills the request.
    const profile = await withTimeout(
      supabaseGet(hostname, `/rest/v1/profiles?id=eq.${userId}&select=plan`, supabaseKey),
      5000,
      'Supabase profile timeout'
    ).catch(() => null);

    if (profile) {
      const today = new Date().toISOString().split('T')[0];
      const plan = profile.plan || 'free';
      const limit = DAILY_LIMIT[plan] ?? DAILY_LIMIT.free;

      // Single atomic operation: increment if under limit, reset if new day, return -1 if blocked
      const newCount = await withTimeout(
        supabaseRpc(hostname, '/rest/v1/rpc/increment_messages_today', supabaseKey, { p_user_id: userId, p_limit: limit, p_today: today }),
        5000,
        'Supabase RPC timeout'
      ).catch(() => null);

      if (newCount === -1) {
        return {
          statusCode: 429,
          headers: CORS,
          body: JSON.stringify({ error: 'Has alcanzado el límite de mensajes de hoy' })
        };
      }
      // newCount === null means Supabase failed/timed out — allow the message rather than blocking
    }
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const cleanMessages = parsed.messages
    .filter(m => m.content !== null && m.content !== undefined && m.content !== '')
    .filter(m => m.role === 'user' || m.role === 'assistant')

  const firstUser = cleanMessages.findIndex(m => m.role === 'user')
  const finalMessages = firstUser > 0 ? cleanMessages.slice(firstUser) : cleanMessages

  if (finalMessages.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No hay mensajes válidos' }) }
  }

  const { userId: _u, model: _m, max_tokens: _mt, messages: _msgs, ...parsedClean } = parsed;
  const body = JSON.stringify({
    ...parsedClean,
    messages: finalMessages,
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
  });

  try {
    return await withTimeout(callClaude(ANTHROPIC_KEY, body), 25000, 'Claude timeout');
  } catch (e) {
    if (e.message === 'Claude timeout') {
      return { statusCode: 408, headers: CORS, body: JSON.stringify({ error: 'El coach tardó demasiado en responder. Inténtalo de nuevo.' }) };
    }
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
