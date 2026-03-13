const https = require('https');
const { URL } = require('url');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function supabaseGet(hostname, path, key) {
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const { code, userId } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'code requerido' }) };

  // Validar que el usuario es Pro
  if (userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && supabaseKey) {
      const hostname = new URL(supabaseUrl).hostname;
      const profiles = await supabaseGet(
        hostname,
        `/rest/v1/profiles?id=eq.${userId}&select=plan`,
        supabaseKey
      );
      const profile = Array.isArray(profiles) ? profiles[0] : null;
      if (profile && profile.plan !== 'pro') {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: 'Strava está disponible solo para usuarios Pro' })
        };
      }
    }
  }

  const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  const postData = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: process.env.STRAVA_REDIRECT_URI
  }).toString();

  // Exchange code for Strava token
  const stravaData = await new Promise((resolve) => {
    const options = {
      hostname: 'www.strava.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', (e) => resolve({ status: 500, body: { error: e.message } }));
    req.write(postData);
    req.end();
  });

  if (!stravaData.body.access_token) {
    console.error('STRAVA_AUTH: Strava no devolvió access_token', JSON.stringify(stravaData));
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No se obtuvo token de Strava', detail: stravaData.body }) };
  }

  // Save token to Supabase using service key (bypasses RLS)
  if (userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const hostname = new URL(supabaseUrl).hostname;

    const patchPayload = {
      strava_token: stravaData.body.access_token,
      strava_refresh_token: stravaData.body.refresh_token,
      strava_token_expires_at: stravaData.body.expires_at,
    };

    console.log('STRAVA_AUTH PATCH payload', JSON.stringify({
      userId,
      tokenInicio: patchPayload.strava_token?.substring(0, 8),
      refresh: patchPayload.strava_refresh_token?.substring(0, 8),
      expiresAt: patchPayload.strava_token_expires_at,
    }));

    const patchBody = JSON.stringify(patchPayload);
    const patchResult = await new Promise((resolve) => {
      const options = {
        hostname,
        path: `/rest/v1/profiles?id=eq.${userId}`,
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(patchBody),
          'Prefer': 'return=minimal',
        }
      };
      const req = https.request(options, (r) => {
        let d = '';
        r.on('data', chunk => d += chunk);
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      });
      req.on('error', (e) => resolve({ status: 500, body: e.message }));
      req.write(patchBody);
      req.end();
    });

    console.log('STRAVA_AUTH PATCH result', JSON.stringify({ status: patchResult.status, body: patchResult.body }));

    if (patchResult.status >= 300) {
      console.error('STRAVA_AUTH: PATCH fallido', JSON.stringify(patchResult));
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error guardando token en Supabase', detail: patchResult.body }) };
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, athlete: stravaData.body.athlete }),
  };
};
