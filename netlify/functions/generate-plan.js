const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

function getDiasDesdeDate(startStr, mondayStr) {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const start = new Date(startStr + 'T12:00:00');
  const monday = new Date(mondayStr + 'T12:00:00');
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const days = [];
  const current = new Date(start);
  while (current <= sunday) {
    days.push(DIAS[current.getDay()]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

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

function supabasePost(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Prefer': 'return=representation'
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
    req.write(bodyStr);
    req.end();
  });
}

function withTimeout(promise, ms, errorMsg) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timer]);
}

function callClaude(apiKey, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  return new Promise((resolve) => {
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
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function refreshStravaToken(userId, stravaToken, stravaRefreshToken, stravaExpiresAt, hostname, supabaseKey) {
  const now = Math.floor(Date.now() / 1000);
  if (!stravaExpiresAt || stravaExpiresAt > now) return stravaToken;
  if (!stravaRefreshToken) return null;

  const postData = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: stravaRefreshToken,
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
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });

  if (!refreshResult?.access_token) return null;

  const updateBody = JSON.stringify({
    strava_token: refreshResult.access_token,
    strava_refresh_token: refreshResult.refresh_token,
    strava_token_expires_at: refreshResult.expires_at
  });

  await new Promise((resolve) => {
    const options = {
      hostname,
      path: `/rest/v1/profiles?id=eq.${userId}`,
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

  return refreshResult.access_token;
}

function fetchStravaActivities(accessToken) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.strava.com',
      path: '/api/v3/athlete/activities?per_page=7',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
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

function buildDiagnosticoUserMessage(deportesEfectivos, weekStart, deporteInfo, dias, objetivo) {
  const deporte = deportesEfectivos[0]?.deporte || 'running';

  const testsInfo = {
    running: [
      `${dias[0]}: Descanso.`,
      `${dias[1]}: Cooper Test. Cal 10min trote suave + 12min carrera a máximo esfuerzo sostenido en llano + 10min vuelta calma. Medir distancia recorrida en 12min. RPE 9-10.`,
      `${dias[2]}: Rodaje suave Z2 (35min al 65-70% FCmax). RPE 5-6.`,
      `${dias[3]}: 5K Time Trial. Cal 10min + 5km a máximo esfuerzo sin parar + 10min vuelta calma. Anotar tiempo total y ritmo medio. RPE 9.`,
      `${dias[4]}: Descanso.`,
      `${dias[5]}: Rodaje suave Z2 (40min). RPE 5-6.`,
      `${dias[6]}: Descanso.`,
    ],
    triatlon: [
      `${dias[0]}: Descanso.`,
      `${dias[1]}: Natación Velocidad Crítica. Cal 200m suave + 400m crol a máximo esfuerzo + descanso 15min + 200m crol a máximo esfuerzo. Anotar tiempos de 400m y 200m por separado. RPE 9-10.`,
      `${dias[2]}: Bici 20min TT. Cal 15min suave + 20min a máximo esfuerzo sostenido en rodillo o carretera llana + 10min vuelta calma. Anotar vatios medios o FC media. RPE 9.`,
      `${dias[3]}: Natación técnica suave 30min Z2.`,
      `${dias[4]}: Running 5K Time Trial. Cal 10min + 5km a máximo esfuerzo + 10min vuelta calma. Anotar tiempo total y ritmo. RPE 9.`,
      `${dias[5]}: Descanso.`,
      `${dias[6]}: Rodaje suave Z2 (30min). RPE 5.`,
    ],
    hyrox: [
      `${dias[0]}: Descanso.`,
      `${dias[1]}: 5K Threshold Run. Cal 10min trote + 5km a máximo esfuerzo sostenido + 5min vuelta calma. Anotar tiempo y ritmo medio. RPE 9.`,
      `${dias[2]}: Descanso o movilidad 20min.`,
      `${dias[3]}: Strength Circuit. 3 series progresivas en press banca para estimar 3RM, descanso 3min entre series. Luego máximo pull-ups en 2min (anotar número). Luego 100m lunges con 15-20kg (anotar tiempo). RPE 8-9.`,
      `${dias[4]}: Descanso.`,
      `${dias[5]}: Rodaje suave 30min Z2. RPE 5.`,
      `${dias[6]}: Descanso.`,
    ],
    natacion: [
      `${dias[0]}: Descanso.`,
      `${dias[1]}: Velocidad Crítica. Cal 200m suave + 400m crol a máximo esfuerzo + descanso 15min + 200m crol a máximo esfuerzo. Anotar tiempos de 400m y 200m. RPE 9-10.`,
      `${dias[2]}: Técnica suave 30min. Drills: patada tabla, pull con paletas, dedos en agua. RPE 4.`,
      `${dias[3]}: 400m Endurance. Cal 200m suave + 400m continuo a ritmo fuerte + 200m vuelta calma. Anotar tiempo de los 400m. RPE 7-8.`,
      `${dias[4]}: Descanso.`,
      `${dias[5]}: Técnica suave 30min. RPE 4.`,
      `${dias[6]}: Descanso.`,
    ],
  };

  // Single sport: use per-day schedule as before
  if (deportesEfectivos.length <= 1) {
    const sesionesInfo = (testsInfo[deporte] || testsInfo.running).slice(0, dias.length).join('\n- ');
    return `Este atleta acaba de registrarse. Genera una SEMANA DE DIAGNÓSTICO para evaluar su nivel real.

PERFIL:
Deporte: ${deporteInfo[deporte] || deporte}
Nivel declarado: ${deportesEfectivos[0]?.nivel || 'desconocido'}
Objetivo: ${objetivo || 'mejorar forma física'}

El plan empieza el ${weekStart}. Los días en orden son: ${dias.join(', ')}.

TESTS (en el orden exacto de los días del plan):
- ${sesionesInfo}

El JSON debe tener esta estructura exacta con los días en el orden indicado:
{
  "semana": "${weekStart}",
  "sesiones": [
    { "dia": "${dias[0]}", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "${dias[1]}", "tipo": "Correr", "descripcion": "...", "duracion_min": 35, "intensidad": "fuerte" }
  ]
}

Para cada sesión de test (no descanso), la descripción debe:
1. Explicar en una frase POR QUÉ se hace ese test
2. Dar instrucciones exactas (calentamiento, bloque test, vuelta calma)
3. Indicar QUÉ debe medir o anotar el atleta
4. Indicar RPE objetivo del bloque principal

En la descripción de la última sesión añade: "Cuando termines cada test, cuéntame el resultado en el chat y lo usaré para calibrar tu plan personalizado de la próxima semana."

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
Devuelve exactamente ${dias.length} sesiones en el orden: ${dias.join(', ')}.`;
  }

  // Multi-sport: key tests per sport (max 2 intense tests each)
  const keyTestsByDeporte = {
    running: [
      { tipo: 'Correr', desc: 'Cooper Test. Cal 10min trote suave + 12min carrera a máximo esfuerzo en llano + 10min vuelta calma. Medir distancia recorrida en 12min. RPE 9-10.' },
      { tipo: 'Correr', desc: '5K Time Trial. Cal 10min + 5km a máximo esfuerzo sin parar + 10min vuelta calma. Anotar tiempo total y ritmo medio. RPE 9.' },
    ],
    natacion: [
      { tipo: 'Nadar', desc: 'Velocidad Crítica. Cal 200m suave + 400m crol a máximo esfuerzo + 15min descanso + 200m crol a máximo esfuerzo. Anotar tiempos de 400m y 200m por separado. RPE 9-10.' },
      { tipo: 'Nadar', desc: '400m Endurance. Cal 200m suave + 400m continuo a ritmo fuerte + 200m vuelta calma. Anotar tiempo de los 400m. RPE 7-8.' },
    ],
    triatlon: [
      { tipo: 'Nadar', desc: 'Natación Velocidad Crítica. Cal 200m suave + 400m crol a máximo esfuerzo + 15min descanso + 200m crol a máximo esfuerzo. Anotar tiempos de 400m y 200m. RPE 9-10.' },
      { tipo: 'Bici', desc: 'Bici 20min TT. Cal 15min suave + 20min a máximo esfuerzo sostenido en rodillo o carretera llana + 10min vuelta calma. Anotar vatios medios o FC media. RPE 9.' },
      { tipo: 'Correr', desc: 'Running 5K Time Trial. Cal 10min + 5km a máximo esfuerzo + 10min vuelta calma. Anotar tiempo total y ritmo. RPE 9.' },
    ],
    hyrox: [
      { tipo: 'Correr', desc: '5K Threshold Run. Cal 10min trote + 5km a máximo esfuerzo sostenido + 5min vuelta calma. Anotar tiempo y ritmo medio. RPE 9.' },
      { tipo: 'Fuerza', desc: 'Strength Circuit. 3 series progresivas en press banca para estimar 3RM (3min descanso entre series). Luego máximo pull-ups en 2min (anotar número). Luego 100m lunges con 15-20kg (anotar tiempo). RPE 8-9.' },
    ],
  };

  // If triatlón is present, it already covers running+natacion — skip those to avoid duplication
  const hasTri = deportesEfectivos.some(d => d.deporte === 'triatlon');
  const testSequence = [];
  deportesEfectivos.forEach(d => {
    if (hasTri && (d.deporte === 'running' || d.deporte === 'natacion')) return;
    const tests = keyTestsByDeporte[d.deporte] || [];
    testSequence.push(...tests);
  });

  // Build 7-day schedule: rest on day 0, alternate tests with rest between intense sessions
  const schedule = [`${dias[0]}: Descanso.`];
  let testIdx = 0;
  let dayIdx = 1;
  while (dayIdx < dias.length && testIdx < testSequence.length) {
    const t = testSequence[testIdx++];
    schedule.push(`${dias[dayIdx]}: ${t.tipo}. ${t.desc}`);
    dayIdx++;
    if (dayIdx < dias.length && testIdx < testSequence.length) {
      schedule.push(`${dias[dayIdx]}: Descanso activo o movilidad 20min.`);
      dayIdx++;
    }
  }
  while (dayIdx < dias.length) {
    schedule.push(`${dias[dayIdx]}: Descanso.`);
    dayIdx++;
  }

  const deportesNombres = deportesEfectivos.map(d => deporteInfo[d.deporte] || d.deporte).join(' + ');

  return `Este atleta acaba de registrarse. Practica MÚLTIPLES DEPORTES: ${deportesNombres}.
Genera una SEMANA DE DIAGNÓSTICO multi-deporte para evaluar su nivel real en cada disciplina.

DEPORTES DEL ATLETA:
${deportesEfectivos.map(d => `- ${deporteInfo[d.deporte] || d.deporte}: nivel declarado ${d.nivel || 'desconocido'}`).join('\n')}
Objetivo: ${objetivo || 'mejorar forma física'}

El plan empieza el ${weekStart}. Los días en orden son: ${dias.join(', ')}.

TESTS PROGRAMADOS (en el orden exacto de los días del plan):
- ${schedule.join('\n- ')}

El JSON debe tener esta estructura exacta con los días en el orden indicado:
{
  "semana": "${weekStart}",
  "sesiones": [
    { "dia": "${dias[0]}", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "${dias[1]}", "tipo": "Nadar", "descripcion": "...", "duracion_min": 50, "intensidad": "fuerte" }
  ]
}

Para cada sesión de test (no descanso), la descripción debe:
1. Explicar en una frase POR QUÉ se hace ese test y qué disciplina evalúa
2. Dar instrucciones exactas (calentamiento, bloque test, vuelta calma)
3. Indicar QUÉ debe medir o anotar el atleta
4. Indicar RPE objetivo del bloque principal

En la descripción de la última sesión activa añade: "Cuando termines cada test, cuéntame el resultado en el chat y lo usaré para calibrar tu plan personalizado de la próxima semana."

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
Devuelve exactamente ${dias.length} sesiones en el orden: ${dias.join(', ')}.`;
}

function buildAnalisisSemanaAnterior(planAnterior, stravaText, numeroDeSemana) {
  const sesiones = planAnterior.sesiones || [];
  const completadas = sesiones.filter(s => s.completada);
  const saltadas = sesiones.filter(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso');
  const activas = sesiones.filter(s => s.tipo?.toLowerCase() !== 'descanso');

  const getRpe = s => s.rpe ?? s.rpe_usuario;
  const rpesValidos = completadas.filter(s => getRpe(s) != null);
  const rpeMedia = rpesValidos.length > 0
    ? Math.round(rpesValidos.reduce((acc, s) => acc + getRpe(s), 0) / rpesValidos.length * 10) / 10
    : null;

  const saltadasStr = saltadas.length > 0
    ? saltadas.map(s => `${s.dia} (${s.tipo})`).join(', ')
    : 'Ninguna';

  const sesionesResumen = activas.map(s =>
    `${s.dia}: ${s.tipo} — ${s.descripcion?.substring(0, 60)}...`
  ).join('\n  ');

  const esSemanaDescarga = numeroDeSemana && numeroDeSemana % 4 === 0;

  return `SEMANA ANTERIOR (semana ${numeroDeSemana ? numeroDeSemana - 1 : '?'} del plan):
- Sesiones completadas: ${completadas.length} de ${activas.length}
- RPE medio: ${rpeMedia != null ? `${rpeMedia}/10` : 'No registrado'}
- Sesiones no completadas: ${saltadasStr}
- Actividades Strava: ${stravaText || 'Sin datos'}
- Sesiones entrenadas:
  ${sesionesResumen || 'Sin datos'}

PROGRESIÓN OBLIGATORIA PARA ESTA SEMANA (semana ${numeroDeSemana || '?'}):
${esSemanaDescarga
  ? '- SEMANA DE DESCARGA: reducir volumen 20-30%, mantener alguna intensidad corta, priorizar recuperación'
  : `- Este plan NO puede ser igual al de la semana anterior — variar tipos de sesión y estructura
- Si la semana pasada había series, esta semana incluir rodaje largo o tempo (y viceversa)
- Aplicar progresión de carga: +5-10% en volumen o intensidad respecto a semana anterior, nunca más de +10%
- Variar el orden de disciplinas y días de descanso`}
- Si RPE medio > 7 o completadas < ${Math.ceil(activas.length * 0.6)}: reducir carga un 15%, más recuperación
- Si RPE medio < 5 y completadas >= ${activas.length}: se puede aumentar carga un 10%`;
}

// ─── Duración mínima por fase y tipo ─────────────────────────────────────────

function validarDuracion(sesion, fase) {
  if (sesion.tipo?.toLowerCase() === 'descanso') return sesion.duracion_min || 0;
  const minimos = {
    base:  { 'Correr': 55, 'Bici': 80, 'Nadar': 45, 'Fuerza': 50 },
    build: { 'Correr': 65, 'Bici': 90, 'Nadar': 55, 'Fuerza': 55 },
    peak:  { 'Correr': 70, 'Bici': 100, 'Nadar': 60, 'Fuerza': 55 },
    taper: { 'Correr': 35, 'Bici': 50, 'Nadar': 35, 'Fuerza': 40 },
  };
  const min = minimos[fase]?.[sesion.tipo] || 45;
  return Math.max(sesion.duracion_min || 0, min);
}

// ─── Macrocycle helpers (inlined — cannot import from src/ in CommonJS) ───────

function getNumeroSemanaInline(fechaInicio, fechaSemana) {
  const diff = new Date(fechaSemana) - new Date(fechaInicio);
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getFaseActualInline(fases, numeroSemana) {
  return fases.find(f => numeroSemana >= f.sem_inicio && numeroSemana <= f.sem_fin) || fases[0];
}

function esSemanaDescargaInline(numeroSemana, fase) {
  if (fase.nombre === 'taper') return false;
  return numeroSemana % 4 === 0;
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

  const { userId, planAnterior, fechaInicio, contexto_semana } = parsed;
  if (!userId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  // Obtener perfil del usuario (incluyendo campos de Strava y multi-deporte)
  const profiles = await supabaseGet(
    hostname,
    `/rest/v1/profiles?id=eq.${userId}&select=deporte,nivel,objetivo,fecha_carrera,contexto,strava_token,strava_refresh_token,strava_token_expires_at,plan,created_at,deportes,carreras,intervals_athlete_id,intervals_api_key`,
    supabaseKey
  );

  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Perfil no encontrado' }) };
  }

  // Obtener ciclo de entrenamiento activo
  const cycleRows = await supabaseGet(
    hostname,
    `/rest/v1/training_cycles?user_id=eq.${userId}&estado=eq.active&order=created_at.desc&limit=1`,
    supabaseKey
  );
  const activeCycle = Array.isArray(cycleRows) && cycleRows[0] ? cycleRows[0] : null;

  const isPro = profile.plan === 'pro';

  // Obtener actividades de Strava solo para usuarios Pro (con refresh automático de token)
  let stravaText = null;
  let stravaActivities = null;
  if (isPro && profile.strava_token) {
    const accessToken = await refreshStravaToken(userId, profile.strava_token, profile.strava_refresh_token, profile.strava_token_expires_at, hostname, supabaseKey);
    if (accessToken) {
      stravaActivities = await fetchStravaActivities(accessToken);
      if (Array.isArray(stravaActivities) && stravaActivities.length > 0) {
        stravaText = stravaActivities.slice(0, 5)
          .map(a => `${a.type} ${(a.distance / 1000).toFixed(1)}km en ${Math.round(a.moving_time / 60)}min`)
          .join(', ');
      }
    }
  }

  // Obtener wellness de Intervals.icu para usuarios Pro con credenciales (no bloqueante)
  let wellnessData = null;
  if (isPro && profile.intervals_athlete_id && profile.intervals_api_key) {
    try {
      const auth = Buffer.from(`API_KEY:${profile.intervals_api_key}`).toString('base64');
      const today = new Date().toISOString().slice(0, 10);
      const wResult = await withTimeout(new Promise((resolve) => {
        const opts = {
          hostname: 'intervals.icu',
          path: `/api/v1/athlete/${profile.intervals_athlete_id}/wellness?oldest=${today}&newest=${today}`,
          method: 'GET',
          headers: { 'Authorization': `Basic ${auth}` },
        };
        const req = https.request(opts, (r) => {
          let d = '';
          r.on('data', chunk => d += chunk);
          r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.end();
      }), 5000, 'Intervals timeout');
      const w = Array.isArray(wResult) ? wResult[0] : wResult;
      if (w && (w.hrv != null || w.atl != null || w.tsb != null)) {
        wellnessData = w;
        console.log(`[intervals] wellness cargado — ATL: ${w.atl}, TSB: ${w.tsb}, HRV: ${w.hrv}`);
      }
    } catch {
      // non-blocking — ignorar error
    }
  }

  // Calcular método de entrenamiento según semanas hasta la carrera
  function calcularMetodo(fechaCarrera, nivel) {
    if (!fechaCarrera) return 'base';
    const hoy = new Date();
    const carrera = new Date(fechaCarrera);
    const semanas = Math.round((carrera - hoy) / (7 * 24 * 60 * 60 * 1000));
    if (semanas > 16) return 'base';
    if (semanas > 8) return 'especifico';
    if (semanas > 3) return 'pico';
    return 'taper';
  }

  const metodoTextos = {
    base: `FASE: BASE (>16 semanas para el evento)
Prioridad: construir aeróbico, técnica y fuerza general. Volumen progresivo, intensidades bajas-medias (Z1-Z3). Sin series de alta intensidad. Al menos 2 días de descanso/recuperación.`,
    especifico: `FASE: ESPECÍFICO (8-16 semanas para el evento)
Prioridad: simular las demandas del evento. Introduce trabajo en Z4, ritmos de carrera, ladrillos (brick) para triatlón, y sesiones largas a ritmo objetivo. Volumen alto, intensidad moderada-alta.`,
    pico: `FASE: PICO (3-8 semanas para el evento)
Prioridad: maximizar forma. Sesiones de alta intensidad controlada (Z4-Z5), simulacros de carrera, volumen ligeramente reducido. El atleta debe llegar a cada sesión descansado.`,
    taper: `FASE: TAPER (<3 semanas para el evento)
Prioridad: llegar fresco al día de la carrera. Reduce volumen 30-50%, mantén alguna sesión corta de intensidad para no perder ritmo. Sin sesiones largas agotadoras. Descanso activo y recuperación.`,
  };

  // Resolver deportes efectivos (multi-deporte o single)
  const deportesEfectivos = Array.isArray(profile.deportes) && profile.deportes.length > 0
    ? profile.deportes
    : profile.deporte ? [{ deporte: profile.deporte, nivel: profile.nivel }] : [];
  const deportePrimario = deportesEfectivos[0]?.deporte || profile.deporte || 'running';

  // Carrera más próxima para determinar fase de entrenamiento
  const carrerasArr = Array.isArray(profile.carreras) ? profile.carreras : [];
  const hoyStr = getTodayDate();
  const carrerasMasProximas = carrerasArr
    .filter(c => c.fecha && new Date(c.fecha) > new Date())
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const carreraProxima = carrerasMasProximas[0] || null;
  const fechaCarreraEfectiva = carreraProxima?.fecha || profile.fecha_carrera;

  const metodo = calcularMetodo(fechaCarreraEfectiva, profile.nivel);

  const weekStart = fechaInicio || getMondayOfCurrentWeek();
  const startDate = fechaInicio || getTodayDate();
  const dias = getDiasDesdeDate(startDate, weekStart);

  // Obtener planes recientes para detectar primer plan y plan anterior
  const planesRecientes = await supabaseGet(
    hostname,
    `/rest/v1/plans?user_id=eq.${userId}&select=*&order=semana.desc&limit=3`,
    supabaseKey
  );
  const planesArr = Array.isArray(planesRecientes) ? planesRecientes : [];
  const esPrimerPlan = planesArr.length === 0;
  const actividadesCount = Array.isArray(stravaActivities) ? stravaActivities.length : 0;
  const necesitaDiagnostico = esPrimerPlan && actividadesCount < 3;

  // Plan anterior = plan más reciente anterior a la semana actual que se está generando
  const planAnteriorEfectivo = planesArr.find(p => p.semana < weekStart) || planAnterior || null;

  // Número de semana y contexto de macrociclo
  let numeroDeSemana = null;
  let faseActual = null;
  let esDescarga = false;
  if (activeCycle && Array.isArray(activeCycle.fases) && activeCycle.fases.length > 0) {
    numeroDeSemana = getNumeroSemanaInline(activeCycle.fecha_inicio, weekStart);
    faseActual = getFaseActualInline(activeCycle.fases, numeroDeSemana);
    esDescarga = esSemanaDescargaInline(numeroDeSemana, faseActual);
  } else if (profile.created_at) {
    numeroDeSemana = Math.max(1, Math.round((new Date(weekStart) - new Date(profile.created_at)) / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  // Adherencia últimas semanas (de los planes ya cargados)
  const adherenciaStats = planesArr.reduce((acc, p) => {
    const ses = p.sesiones || [];
    const activas = ses.filter(s => s.tipo?.toLowerCase() !== 'descanso');
    const completadas = ses.filter(s => s.completada);
    return { completadas: acc.completadas + completadas.length, total: acc.total + activas.length };
  }, { completadas: 0, total: 0 });
  const adherenciaPct = adherenciaStats.total > 0
    ? Math.round((adherenciaStats.completadas / adherenciaStats.total) * 100)
    : null;

  const deporteInfo = {
    triatlon: 'triatlón olímpico (natación 1.5km, ciclismo 40km, running 10km)',
    running: 'running y carreras populares',
    natacion: 'natación (piscina y aguas abiertas)',
    hyrox: 'Hyrox (carrera funcional con estaciones de fitness)',
  };

  const systemPrompt = `Eres un coach deportivo experto. Genera planes de entrenamiento personalizados en JSON.
Instrucción: devuelve SOLO un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

  let userMessage;
  if (necesitaDiagnostico) {
    userMessage = buildDiagnosticoUserMessage(deportesEfectivos, weekStart, deporteInfo, dias, profile.objetivo);
  } else {
    const stravaParaAnalisis = isPro ? stravaText : null;
    const analisisSection = planAnteriorEfectivo
      ? '\n\n' + buildAnalisisSemanaAnterior(planAnteriorEfectivo, stravaParaAnalisis, numeroDeSemana)
      : '';

    // Multi-deporte: construir descripción de deportes y carreras
    const deportesTexto = deportesEfectivos.length > 1
      ? deportesEfectivos.map(d => `${deporteInfo[d.deporte] || d.deporte} (nivel: ${d.nivel || 'principiante'})`).join(', ')
      : deporteInfo[deportePrimario] || deportePrimario;
    const nivelPrimario = deportesEfectivos[0]?.nivel || profile.nivel || 'principiante';

    const carrerasTexto = carrerasMasProximas.length > 0
      ? carrerasMasProximas.slice(0, 3).map(c => `${c.nombre} (${c.tipo}) — ${c.fecha}`).join('; ')
      : (profile.fecha_carrera ? `Próximo evento: ${profile.fecha_carrera}` : '');

    const distribucionDeportes = deportesEfectivos.length > 1 ? `
DISTRIBUCIÓN DE SESIONES (multi-deporte):
El atleta practica ${deportesEfectivos.length} deportes. Distribuye las sesiones semanales priorizando el deporte de la carrera más próxima (${carreraProxima ? carreraProxima.tipo + ' — ' + carreraProxima.fecha : 'sin carrera definida'}).
${deportesEfectivos.map(d => `- ${deporteInfo[d.deporte] || d.deporte}: incluir al menos ${d.deporte === 'triatlon' ? '3-4' : '1-2'} sesiones`).join('\n')}
Si el atleta hace triatlón, las sesiones de running del triatlón también sirven para carreras de running.
Nunca más de 2 días seguidos del mismo deporte.` : '';

    const contextoSemanaSection = contexto_semana
      ? `\n\nCONTEXTO ESPECIAL ESTA SEMANA (tiene prioridad):\n${contexto_semana}\nAdapta el plan teniendo en cuenta esta información.`
      : '';

    const wellnessWarning = (() => {
      if (!wellnessData) return '';
      const alertas = [];
      if (wellnessData.atl != null && wellnessData.atl > 50) alertas.push(`fatiga alta (ATL ${Math.round(wellnessData.atl)})`);
      if (wellnessData.tsb != null && wellnessData.tsb < -20) alertas.push(`forma negativa (TSB ${Math.round(wellnessData.tsb)})`);
      if (wellnessData.hrv != null && wellnessData.hrv < 40) alertas.push(`HRV muy bajo (${wellnessData.hrv} ms)`);
      if (alertas.length === 0) return '';
      return `\n\n⚠️ ALERTA RECUPERACIÓN (Intervals.icu hoy): ${alertas.join(', ')}. Reduce el volumen total un 15-20% y evita sesiones de alta intensidad esta semana.`;
    })();

    // Detectar carrera B o C en los próximos 14 días
    const hoy14 = new Date(hoyStr);
    hoy14.setDate(hoy14.getDate() + 14);
    const hoy14Str = hoy14.toISOString().split('T')[0];
    const carreraProximaBC = carrerasArr
      .filter(c => c.fecha && c.fecha >= hoyStr && c.fecha <= hoy14Str && (c.prioridad === 'B' || c.prioridad === 'C'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
    let proximaCarreraSection = '';
    if (carreraProximaBC) {
      const diasRestantes = Math.round((new Date(carreraProximaBC.fecha) - new Date(hoyStr)) / (24 * 60 * 60 * 1000));
      if (carreraProximaBC.prioridad === 'B') {
        proximaCarreraSection = `\n\n⚠️ ATENCIÓN: El atleta tiene una carrera B (${carreraProximaBC.nombre}) en ${diasRestantes} días. Aplicar mini-taper: reducir volumen 20-30%, mantener algo de intensidad corta, incluir sesión de activación el día anterior a la carrera.`;
      } else {
        proximaCarreraSection = `\n\n⚠️ ATENCIÓN: El atleta tiene una carrera C (${carreraProximaBC.nombre}) en ${diasRestantes} días. Tratarla como sesión de calidad intensa en el plan. Sin cambios en el resto del plan.`;
      }
    }

    const macrocicloSection = activeCycle && faseActual ? `

CONTEXTO DEL MACROCICLO:
- Semana ${numeroDeSemana} de ${activeCycle.semanas_totales}
- Fase: ${faseActual.nombre.toUpperCase()} — ${faseActual.objetivo}
${esDescarga ? '⚠️ SEMANA DE DESCARGA: reducir volumen 20-30% respecto a semanas previas, mantener algo de intensidad corta, priorizar recuperación.' : ''}${adherenciaPct !== null ? `\n- Adherencia reciente: ${adherenciaPct}% de sesiones completadas${adherenciaPct < 70 ? ' — carga conservadora esta semana, no aumentar volumen' : ''}` : ''}
- Carrera objetivo: ${activeCycle.carrera_nombre || 'Sin carrera definida'}${activeCycle.fecha_carrera ? ` — ${activeCycle.fecha_carrera}` : ''}

DURACIONES MÍNIMAS OBLIGATORIAS — FASE ${faseActual.nombre.toUpperCase()} (NO usar valores menores):
${faseActual.nombre === 'base' ? `- Correr: mínimo 55min (rodaje Z2: 55-70min, rodaje largo: 80-110min, intervalos: 60-75min incluyendo calentamiento y vuelta a la calma)
- Bici: mínimo 80min (Z2: 80-120min, intervalos: 70-90min)
- Nadar: mínimo 45min
- Fuerza: mínimo 50min
PROHIBIDO generar sesiones de Correr de 45min en esta fase — el mínimo es 55min.` : ''}${faseActual.nombre === 'build' ? `- Correr: mínimo 65min (rodaje Z2: 65-85min, rodaje largo: 90-130min, intervalos: 70-85min)
- Bici: mínimo 90min (Z2: 90-150min, intervalos: 75-95min, brick: 90-130min)
- Nadar: mínimo 55min
- Fuerza: mínimo 55min
PROHIBIDO generar sesiones de Correr de 45-60min en esta fase — el mínimo es 65min.` : ''}${faseActual.nombre === 'peak' ? `- Correr: mínimo 70min (rodaje Z2: 70-85min, rodaje largo: 90-140min, intervalos: 75-90min)
- Bici: mínimo 100min (Z2: 100-160min, brick: 100-150min)
- Nadar: mínimo 60min
- Fuerza: mínimo 55min
PROHIBIDO generar sesiones de menos de 70min en esta fase.` : ''}${faseActual.nombre === 'taper' ? `- Correr: 35-50min (reducir volumen, mantener algo de ritmo)
- Bici: 50-75min
- Nadar: 35-50min
- Fuerza: 40-50min (sesiones cortas, técnica)`  : ''}` : '';

    const semanaLabel = numeroDeSemana ? `Semana ${numeroDeSemana} del plan del atleta.` : '';

    userMessage = `Genera un plan de entrenamiento semanal para este atleta:

Deportes: ${deportesTexto}
Nivel: ${nivelPrimario}
Objetivo: ${profile.objetivo || 'mejorar forma física'}
${carrerasTexto ? `Carreras/eventos próximos: ${carrerasTexto}` : ''}
${semanaLabel}
${profile.contexto ? `Contexto del atleta: ${profile.contexto}` : ''}${analisisSection}${macrocicloSection}
${distribucionDeportes}${contextoSemanaSection}${wellnessWarning}

El plan empieza el ${weekStart}. Los días en orden son: ${dias.join(', ')}.

${metodoTextos[metodo]}
${profile.nivel === 'principiante' ? `RESTRICCIÓN NIVEL PRINCIPIANTE: Máximo 5 sesiones activas (2 deben ser descanso). Duración máxima de sesión: 60min. Sin series de alta intensidad. Todas las sesiones en Z1-Z2. Prioriza técnica y adaptación.` : ''}

El JSON debe tener esta estructura exacta. El campo "estructura" es OBLIGATORIO para sesiones no-descanso:
{
  "semana": "${weekStart}",
  "sesiones": [
    {
      "dia": "${dias[0]}",
      "tipo": "Correr",
      "subtipo": "Rodaje Z2",
      "duracion_min": 50,
      "intensidad": "suave",
      "distancia_km": 7,
      "zona_objetivo": "Z1-Z2",
      "estructura": {
        "calentamiento": "10min trote suave Z1",
        "principal": "35min rodaje continuo Z2 a 5:40/km",
        "vuelta_calma": "5min andar + estiramientos gemelos",
        "rpe_objetivo": "5-6"
      }
    },
    {
      "dia": "${dias[1]}",
      "tipo": "Descanso",
      "subtipo": "Descanso completo",
      "duracion_min": 0,
      "intensidad": "descanso",
      "distancia_km": null,
      "zona_objetivo": null,
      "estructura": null
    }
  ]
}

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
zona_objetivo posibles: "Z1-Z2", "Z2-Z3", "Z3-Z4", "Z4-Z5" (null para Descanso)
subtipo: nombre corto descriptivo de la sesión (ej: "Rodaje Z2", "Series 1km", "Largo dominical", "Fuerza core", "Brick bici+run")
distancia_km: distancia estimada en km (null para sesiones de fuerza o descanso)
Devuelve exactamente ${dias.length} sesiones en el orden: ${dias.join(', ')}.

Para el campo "estructura" de cada sesión activa:
- calentamiento: qué hacer exactamente (10-15% del tiempo total)
- principal: bloque central con detalles concretos según el deporte:
  * Correr: series con distancia y ritmo (ej: "4x1000m a 4:45/km, 90seg recuperación trote")
  * Bici: intervalos con zona o vatios (ej: "3x10min zona 3 a 85rpm")
  * Nadar: estilo, distancia, descanso y ritmo por 100m (ej: "6x100m crol con 20seg, ritmo 2:00/100m")
  * Fuerza/Hyrox: ejercicios, series y repeticiones (ej: "Sentadilla 3x10, Remo 3x12, Core 3x15")
- vuelta_calma: recuperación y estiramientos (10% del tiempo)
- rpe_objetivo: rango RPE para el bloque principal (ej: "5-6", "7-8", "9-10")${proximaCarreraSection}`;
  }


  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let claudeResponse;
  try {
    claudeResponse = await withTimeout(
      callClaude(ANTHROPIC_KEY, systemPrompt, userMessage),
      30000,
      'Claude timeout'
    );
  } catch (e) {
    return { statusCode: 408, headers: CORS, body: JSON.stringify({ error: 'La generación del plan tardó demasiado. Inténtalo de nuevo.' }) };
  }

  if (!claudeResponse || !claudeResponse.content?.[0]?.text) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al generar el plan' }) };
  }

  let planData;
  try {
    const text = claudeResponse.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    planData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan generado no es JSON válido' }) };
  }

  if (!planData.sesiones || planData.sesiones.length < 1) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan no tiene sesiones' }) };
  }

  // Inyectar tipo_semana en cada sesión de diagnóstico
  if (necesitaDiagnostico) {
    planData.sesiones = planData.sesiones.map(s => ({ ...s, tipo_semana: 'diagnostico' }));
  }

  // Validar y corregir duraciones mínimas por fase (safety net post-generación)
  if (!necesitaDiagnostico) {
    const faseNombre = faseActual?.nombre || 'base';
    planData.sesiones = planData.sesiones.map(s => {
      const duracionCorregida = validarDuracion(s, faseNombre);
      return duracionCorregida !== s.duracion_min ? { ...s, duracion_min: duracionCorregida } : s;
    });
  }

  // Calcular volumen planificado (suma duracion_min de sesiones no-descanso)
  const volumenPlanificado = planData.sesiones
    .filter(s => s.tipo?.toLowerCase() !== 'descanso')
    .reduce((acc, s) => acc + (s.duracion_min || 0), 0);

  // Construir registro a guardar
  const planRecord = {
    user_id: userId,
    semana: weekStart,
    sesiones: planData.sesiones,
    volumen_planificado_min: volumenPlanificado,
    ...(activeCycle && faseActual ? {
      cycle_id: activeCycle.id,
      numero_semana: numeroDeSemana,
      fase: faseActual.nombre,
      objetivo_semana: faseActual.objetivo,
    } : {}),
  };

  // Guardar en Supabase
  const inserted = await supabasePost(hostname, '/rest/v1/plans', supabaseKey, planRecord);

  const plan = Array.isArray(inserted) ? inserted[0] : inserted;

  // Sincronizar sesiones con Intervals.icu (awaited con timeout, no bloquea si falla)
  if (profile.intervals_athlete_id && profile.intervals_api_key) {
    try {
      const DIA_OFFSET = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
      const TIPO_MAP = {
        'Correr': 'Run', 'Carrera': 'Run', 'Rodaje': 'Run',
        'Bici': 'Ride', 'Ciclismo': 'Ride',
        'Nadar': 'Swim', 'Natación': 'Swim',
        'Fuerza': 'WeightTraining', 'Hyrox': 'WeightTraining',
      };
      const auth = Buffer.from(`API_KEY:${profile.intervals_api_key}`).toString('base64');
      const lunes = new Date(weekStart + 'T12:00:00');

      const sesionesActivas = planData.sesiones.filter(s => {
        const t = s.tipo?.toLowerCase();
        return t !== 'descanso' && t !== 'resto' && t !== 'rest';
      });

      const eventIds = [];

      for (const sesion of sesionesActivas) {
        const offset = DIA_OFFSET[sesion.dia] ?? 0;
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + offset);
        const dateStr = fecha.toISOString().slice(0, 10);

        const desc = [
          sesion.estructura?.calentamiento ? `Calentamiento: ${sesion.estructura.calentamiento}` : '',
          sesion.estructura?.principal || '',
          sesion.estructura?.vuelta_calma ? `Vuelta calma: ${sesion.estructura.vuelta_calma}` : '',
          sesion.zona_objetivo ? `Zona objetivo: ${sesion.zona_objetivo}` : '',
          sesion.estructura?.rpe_objetivo ? `RPE objetivo: ${sesion.estructura.rpe_objetivo}` : '',
        ].filter(Boolean).join('\n');

        const eventBody = JSON.stringify({
          start_date_local: `${dateStr}T07:00:00`,
          category: 'WORKOUT',
          type: TIPO_MAP[sesion.tipo] || 'Workout',
          name: `${sesion.subtipo || sesion.tipo} — ${sesion.duracion_min}min`,
          ...(desc ? { description: desc } : {}),
          moving_time: (sesion.duracion_min || 0) * 60,
        });

        const result = await withTimeout(new Promise((resolve) => {
          const opts = {
            hostname: 'intervals.icu',
            path: `/api/v1/athlete/${profile.intervals_athlete_id}/events`,
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(eventBody),
            },
          };
          const req = https.request(opts, (r) => {
            let d = '';
            r.on('data', chunk => d += chunk);
            r.on('end', () => { try { resolve({ status: r.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: r.statusCode, data: null }); } });
          });
          req.on('error', (e) => resolve({ status: 500, data: null, err: e.message }));
          req.write(eventBody);
          req.end();
        }), 5000, `Intervals timeout sesion ${sesion.dia}`);

        if (result.status >= 200 && result.status < 300 && result.data?.id) {
          eventIds.push({ dia: sesion.dia, id: result.data.id });
        } else {
          console.error(`[intervals] Error creando evento ${sesion.dia}: status ${result.status}`);
        }
      }

      // Guardar IDs de eventos en el plan de Supabase
      if (eventIds.length > 0 && plan?.id) {
        const patchBody = JSON.stringify({ intervals_event_ids: eventIds });
        await new Promise((resolve) => {
          const opts = {
            hostname,
            path: `/rest/v1/plans?id=eq.${plan.id}`,
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(patchBody),
            },
          };
          const req = https.request(opts, (r) => { r.on('data', () => {}); r.on('end', resolve); });
          req.on('error', resolve);
          req.write(patchBody);
          req.end();
        });
        console.error(`[intervals] ${eventIds.length} eventos sincronizados para plan ${plan.id}`);
      }
    } catch (e) {
      console.error('[intervals] Error sincronizando plan:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  };
};
