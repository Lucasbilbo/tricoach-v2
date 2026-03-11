const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

function formatPace(distanceM, movingTimeSec) {
  if (!distanceM || distanceM === 0) return null;
  const paceSecPerKm = movingTimeSec / (distanceM / 1000);
  const min = Math.floor(paceSecPerKm / 60);
  const sec = Math.round(paceSecPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatActivities(raw) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRaw = raw.filter(a => a.start_date_local && new Date(a.start_date_local).getTime() >= sevenDaysAgo);

  const usandoUltimaSemana = recentRaw.length > 0;
  const rawToUse = usandoUltimaSemana ? recentRaw : raw.slice(0, 3);

  const actividades = rawToUse.map(a => ({
    tipo: a.type,
    distancia_km: Math.round((a.distance / 1000) * 10) / 10,
    duracion_min: Math.round(a.moving_time / 60),
    fecha: a.start_date_local ? a.start_date_local.split('T')[0] : null,
    ritmo_min_km: formatPace(a.distance, a.moving_time)
  }));

  const total_km = actividades.reduce((sum, a) => sum + a.distancia_km, 0);
  const n = actividades.length;

  const runActivities = rawToUse.filter(a => a.type === 'Run' || a.type === 'VirtualRun');
  let ritmoMedio = null;
  if (runActivities.length > 0) {
    const totalSec = runActivities.reduce((s, a) => s + a.moving_time, 0);
    const totalDist = runActivities.reduce((s, a) => s + a.distance, 0);
    ritmoMedio = formatPace(totalDist, totalSec);
  }

  let resumenParts;
  if (usandoUltimaSemana) {
    resumenParts = [`Última semana: ${n} salidas, ${Math.round(total_km * 10) / 10}km totales`];
  } else {
    resumenParts = [`Últimas actividades: ${n} salidas, ${Math.round(total_km * 10) / 10}km totales`];
  }
  if (ritmoMedio) resumenParts.push(`ritmo medio ${ritmoMedio}/km`);

  return {
    resumen: resumenParts.join(', '),
    actividades
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = event.headers['x-tricoach-secret'];
  if (FUNCTION_SECRET && secret !== FUNCTION_SECRET) {
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

  // Fetch user's Strava tokens from Supabase
  const profileData = await new Promise((resolve) => {
    const path = `/rest/v1/profiles?id=eq.${userId}&select=strava_token,strava_refresh_token,strava_token_expires_at`;
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
        try { resolve(JSON.parse(d)[0]); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });

  if (!profileData || !profileData.strava_token) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinStrava: true })
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
      grant_type: 'refresh_token'
    }).toString();

    const refreshResult = await new Promise((resolve) => {
      const options = {
        hostname: 'www.strava.com',
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
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
      req.write(postData);
      req.end();
    });

    if (refreshResult && refreshResult.access_token) {
      accessToken = refreshResult.access_token;

      // Save new token to Supabase
      const updateBody = JSON.stringify({
        strava_token: refreshResult.access_token,
        strava_refresh_token: refreshResult.refresh_token,
        strava_token_expires_at: refreshResult.expires_at
      });

      await new Promise((resolve) => {
        const path = `/rest/v1/profiles?id=eq.${userId}`;
        const options = {
          hostname: new URL(supabaseUrl).hostname,
          path,
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateBody)
          }
        };
        const req = https.request(options, (r) => {
          r.on('data', () => {});
          r.on('end', resolve);
        });
        req.on('error', resolve);
        req.write(updateBody);
        req.end();
      });
    }
  }

  // Fetch activities from Strava
  const activitiesResult = await new Promise((resolve) => {
    const options = {
      hostname: 'www.strava.com',
      path: '/api/v3/athlete/activities?per_page=10',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });

  if (!Array.isArray(activitiesResult) || activitiesResult.length === 0) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumen: 'Sin actividades recientes', actividades: [] })
    };
  }

  const formatted = formatActivities(activitiesResult);

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(formatted)
  };
};
