const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

const TIPO_MAP = {
  'Correr': ['Run', 'TrailRun', 'VirtualRun'],
  'Bici':   ['Ride', 'VirtualRide', 'MountainBikeRide'],
  'Nadar':  ['Swim'],
  'Fuerza': ['WeightTraining', 'Workout'],
};

function httpsRequest(options, body) {
  return new Promise((resolve) => {
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    if (body) req.write(body);
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

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { userId, sessionDate, sessionTipo } = parsed;
  if (!userId || !sessionDate || !sessionTipo) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId, sessionDate y sessionTipo son requeridos' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Fetch Strava tokens from profile
  const profile = await httpsRequest({
    hostname: new URL(supabaseUrl).hostname,
    path: `/rest/v1/profiles?id=eq.${userId}&select=strava_token,strava_refresh_token,strava_token_expires_at`,
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  const profileData = Array.isArray(profile) ? profile[0] : null;

  if (!profileData?.strava_token) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: false }),
    };
  }

  let accessToken = profileData.strava_token;
  const now = Math.floor(Date.now() / 1000);

  // Refresh token if expired
  if (profileData.strava_token_expires_at && profileData.strava_token_expires_at < now) {
    const postData = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: profileData.strava_refresh_token,
      grant_type: 'refresh_token',
    }).toString();

    const refreshResult = await httpsRequest({
      hostname: 'www.strava.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, postData);

    if (!refreshResult?.access_token) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ found: false }),
      };
    }

    accessToken = refreshResult.access_token;

    // Persist refreshed token
    const updateBody = JSON.stringify({
      strava_token: refreshResult.access_token,
      strava_refresh_token: refreshResult.refresh_token,
      strava_token_expires_at: refreshResult.expires_at,
    });

    await httpsRequest({
      hostname: new URL(supabaseUrl).hostname,
      path: `/rest/v1/profiles?id=eq.${userId}`,
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateBody),
      },
    }, updateBody);
  }

  // Compute ±12h window around noon UTC of sessionDate
  const dayNoonSec = Math.floor(new Date(sessionDate + 'T12:00:00Z').getTime() / 1000);
  const after  = dayNoonSec - 12 * 3600;
  const before = dayNoonSec + 12 * 3600;

  const activities = await httpsRequest({
    hostname: 'www.strava.com',
    path: `/api/v3/athlete/activities?after=${after}&before=${before}&per_page=30`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!Array.isArray(activities) || activities.length === 0) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: false }),
    };
  }

  const tiposStrava = TIPO_MAP[sessionTipo] || [];
  const match = activities.find(a => tiposStrava.includes(a.type) || tiposStrava.includes(a.sport_type));

  if (!match) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ found: false }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      found: true,
      activityId: match.id,
      nombre: match.name,
      duracion_min: Math.round(match.elapsed_time / 60),
      distancia_km: Math.round(match.distance / 100) / 10,
      fc_media: match.average_heartrate || null,
      descripcion: match.name,
    }),
  };
};
