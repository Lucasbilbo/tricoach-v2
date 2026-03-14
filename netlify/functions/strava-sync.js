const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;

// Strava type → plan session tipo
const STRAVA_TIPO_MAP = {
  Run: 'Correr',
  VirtualRun: 'Correr',
  TrailRun: 'Correr',
  Ride: 'Bici',
  VirtualRide: 'Bici',
  MountainBikeRide: 'Bici',
  Swim: 'Nadar',
  WeightTraining: 'Fuerza',
  Workout: 'Fuerza',
  Crossfit: 'Fuerza',
};

function supabaseRequest(method, path, body, supabaseUrl, supabaseKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: new URL(supabaseUrl).hostname,
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'PATCH' ? 'return=representation' : 'return=representation',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function stravaGet(path, accessToken) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.strava.com',
      path: `/api/v3/${path}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

async function refreshStravaToken(profileData, supabaseUrl, supabaseKey, userId) {
  const postData = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: profileData.strava_refresh_token,
    grant_type: 'refresh_token'
  }).toString();

  const result = await new Promise((resolve) => {
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
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });

  if (result && result.access_token) {
    await supabaseRequest('PATCH', `profiles?id=eq.${userId}`, {
      strava_token: result.access_token,
      strava_refresh_token: result.refresh_token,
      strava_token_expires_at: result.expires_at,
    }, supabaseUrl, supabaseKey);
    return result.access_token;
  }
  return null;
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

  // Get profile with Strava tokens
  const profiles = await supabaseRequest('GET', `profiles?id=eq.${userId}&select=strava_token,strava_refresh_token,strava_token_expires_at`, null, supabaseUrl, supabaseKey);
  const profile = Array.isArray(profiles) ? profiles[0] : null;

  if (!profile || !profile.strava_token) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ sincronizadas: 0, sinStrava: true }) };
  }

  // Refresh token if needed
  let accessToken = profile.strava_token;
  const now = Math.floor(Date.now() / 1000);
  if (profile.strava_token_expires_at && profile.strava_token_expires_at < now) {
    const refreshed = await refreshStravaToken(profile, supabaseUrl, supabaseKey, userId);
    if (!refreshed) {
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ sincronizadas: 0, error: 'token_expired' }) };
    }
    accessToken = refreshed;
  }

  // Get active plan
  const plans = await supabaseRequest('GET', `plans?user_id=eq.${userId}&order=semana.desc&limit=1`, null, supabaseUrl, supabaseKey);
  const plan = Array.isArray(plans) ? plans[0] : null;

  if (!plan || !plan.sesiones) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ sincronizadas: 0, sinPlan: true }) };
  }

  // Get Strava activities from last 7 days
  const sevenDaysAgoTs = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const activities = await stravaGet(`athlete/activities?per_page=20&after=${sevenDaysAgoTs}`, accessToken);

  if (!Array.isArray(activities) || activities.length === 0) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ sincronizadas: 0 }) };
  }

  // Map activities by date+tipo
  const actividadesPorFecha = {};
  for (const act of activities) {
    const fecha = act.start_date_local ? act.start_date_local.split('T')[0] : null;
    const tipoNormalizado = STRAVA_TIPO_MAP[act.sport_type || act.type] || null;
    if (fecha && tipoNormalizado) {
      actividadesPorFecha[`${fecha}_${tipoNormalizado}`] = act;
    }
  }

  // Día mapping — plan sesiones have dia (weekday name), we need to find the date
  const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Use plan.semana as reference Monday
  const semanaDate = new Date(plan.semana + 'T00:00:00');

  const sesiones = plan.sesiones;
  let sincronizadas = 0;
  const updatedSesiones = sesiones.map(sesion => {
    if (sesion.completada || sesion.tipo?.toLowerCase() === 'descanso') return sesion;

    // Find the date of this sesion's dia within the plan week
    const diaSemana = DIAS_ES.indexOf(sesion.dia);
    if (diaSemana === -1) return sesion;

    // semana is a Monday (0=Sun,1=Mon,...). Week offset from Monday.
    const lunesOffset = diaSemana === 0 ? 6 : diaSemana - 1; // days from Monday
    const sesionDate = new Date(semanaDate);
    sesionDate.setDate(sesionDate.getDate() + lunesOffset);
    const sesionFecha = sesionDate.toISOString().split('T')[0];

    const key = `${sesionFecha}_${sesion.tipo}`;
    if (actividadesPorFecha[key]) {
      sincronizadas++;
      return { ...sesion, completada: true, via_strava: true, rpe: sesion.rpe || null };
    }

    return sesion;
  });

  if (sincronizadas === 0) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ sincronizadas: 0 }) };
  }

  // Update plan in Supabase
  await supabaseRequest('PATCH', `plans?id=eq.${plan.id}`, { sesiones: updatedSesiones }, supabaseUrl, supabaseKey);

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sincronizadas, plan_actualizado: true, sesiones: updatedSesiones })
  };
};
