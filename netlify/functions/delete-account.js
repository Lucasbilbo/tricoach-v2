const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
  const secret = event.headers['x-tricoach-secret'];
  if (!FUNCTION_SECRET) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }
  if (secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { userId } = parsed;
  if (!userId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  const baseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Delete messages
  const messagesResult = await httpsRequest({
    hostname,
    path: `/rest/v1/messages?user_id=eq.${userId}`,
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (messagesResult.status >= 300) {
    console.error('delete-account: error borrando messages', messagesResult.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al borrar mensajes' }) };
  }

  // Delete plans
  const plansResult = await httpsRequest({
    hostname,
    path: `/rest/v1/plans?user_id=eq.${userId}`,
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (plansResult.status >= 300) {
    console.error('delete-account: error borrando plans', plansResult.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al borrar planes' }) };
  }

  // Delete profile
  const profileResult = await httpsRequest({
    hostname,
    path: `/rest/v1/profiles?id=eq.${userId}`,
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (profileResult.status >= 300) {
    console.error('delete-account: error borrando profile', profileResult.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al borrar perfil' }) };
  }

  // Delete auth user via Supabase Admin API
  const authResult = await httpsRequest({
    hostname,
    path: `/auth/v1/admin/users/${userId}`,
    method: 'DELETE',
    headers: baseHeaders,
  });
  if (authResult.status >= 300) {
    console.error('delete-account: error borrando auth user', authResult.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al borrar usuario' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
};
