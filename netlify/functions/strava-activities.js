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

function getZonaFc(pct) {
  if (pct < 60) return 'Z1 (recuperación)'
  if (pct < 70) return 'Z2 (base aeróbica)'
  if (pct < 80) return 'Z3 (tempo)'
  if (pct < 90) return 'Z4 (umbral)'
  return 'Z5 (máximo)'
}

function formatActivities(raw, fcMaximaAtleta = null) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRaw = raw.filter(a => a.start_date_local && new Date(a.start_date_local).getTime() >= sevenDaysAgo);

  const usandoUltimaSemana = recentRaw.length > 0;
  const rawToUse = usandoUltimaSemana ? recentRaw : raw.slice(0, 3);

  const actividades = rawToUse.map(a => {
    const fc_media = a.average_heartrate || null
    let intensidad_pct = null
    let zona_fc = null
    if (fc_media && fcMaximaAtleta) {
      intensidad_pct = Math.round((fc_media / fcMaximaAtleta) * 100)
      zona_fc = getZonaFc(intensidad_pct)
    }
    return {
      tipo: a.type,
      tipo_deporte: a.sport_type || a.type,
      distancia_km: Math.round((a.distance / 1000) * 10) / 10,
      duracion_min: Math.round(a.moving_time / 60),
      fecha: a.start_date_local ? a.start_date_local.split('T')[0] : null,
      ritmo_min_km: formatPace(a.distance, a.moving_time),
      fc_media,
      fc_maxima: a.max_heartrate || null,
      potencia_media: a.average_watts || null,
      cadencia_media: a.average_cadence || null,
      desnivel: Math.round(a.total_elevation_gain) || null,
      intensidad_pct,
      zona_fc,
    }
  });

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

  const fcMediaGlobal = actividades.filter(a => a.fc_media).map(a => a.fc_media);
  if (fcMediaGlobal.length > 0) {
    const fc = Math.round(fcMediaGlobal.reduce((s, v) => s + v, 0) / fcMediaGlobal.length);
    resumenParts.push(`FC media ${fc} bpm`);
  }

  const desnivel = actividades.reduce((s, a) => s + (a.desnivel || 0), 0);
  if (desnivel > 0) resumenParts.push(`${desnivel}m desnivel`);

  const potencias = actividades.filter(a => a.potencia_media).map(a => a.potencia_media);
  if (potencias.length > 0) {
    const potMedia = Math.round(potencias.reduce((s, v) => s + v, 0) / potencias.length);
    resumenParts.push(`potencia media ${potMedia}W`);
  }

  return {
    resumen: resumenParts.join(', '),
    actividades
  };
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

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Fetch user's Strava tokens from Supabase
  const profileData = await new Promise((resolve) => {
    const path = `/rest/v1/profiles?id=eq.${userId}&select=strava_token,strava_refresh_token,strava_token_expires_at,fc_maxima,edad`;
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

    if (!refreshResult?.access_token) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sinStrava: true })
      };
    }

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
      body: JSON.stringify({ sinStrava: false, resumen: 'Sin actividades recientes', actividades: [], sinDatos: true })
    };
  }

  const fcMaximaEfectiva = profileData.fc_maxima || (profileData.edad ? 220 - profileData.edad : null)
  const formatted = formatActivities(activitiesResult, fcMaximaEfectiva);

  // Fire and forget: feedback del coach para la actividad más reciente (solo si es de los últimos 7 días)
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (formatted.actividades.length > 0 && formatted.actividades[0].fecha >= sevenDaysAgoStr) {
    const feedbackUrl = `${process.env.URL || 'http://localhost:8888'}/.netlify/functions/strava-feedback`;
    fetch(feedbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tricoach-secret': FUNCTION_SECRET },
      body: JSON.stringify({ userId, actividad: formatted.actividades[0] })
    }).catch(() => {});
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(formatted)
  };
};
