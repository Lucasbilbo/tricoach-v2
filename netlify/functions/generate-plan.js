const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
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

function callClaude(apiKey, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
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

function buildAnalisisSemanaAnterior(planAnterior, stravaText) {
  const sesiones = planAnterior.sesiones || [];
  const completadas = sesiones.filter(s => s.completada);
  const saltadas = sesiones.filter(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso');

  const getRpe = s => s.rpe ?? s.rpe_usuario;
  const rpesValidos = completadas.filter(s => getRpe(s) != null);
  const rpeMedia = rpesValidos.length > 0
    ? Math.round(rpesValidos.reduce((acc, s) => acc + getRpe(s), 0) / rpesValidos.length * 10) / 10
    : null;

  const saltadasStr = saltadas.length > 0
    ? saltadas.map(s => `${s.dia} (${s.tipo})`).join(', ')
    : 'Ninguna';

  return `ANÁLISIS DE LA SEMANA ANTERIOR:
- Sesiones completadas: ${completadas.length} de 7
- RPE medio: ${rpeMedia != null ? `${rpeMedia}/10` : 'No registrado'}
- Sesiones no completadas: ${saltadasStr}
- Actividades Strava registradas: ${stravaText || 'Sin datos'}

CRITERIOS PARA ESTA SEMANA:
- Si RPE medio > 7 o completadas < 4: reducir carga un 15%, más recuperación
- Si RPE medio < 5 y completadas >= 6: se puede aumentar carga un 10%
- Si hay sesiones saltadas de un tipo específico: no acumular deuda, redistribuir
- Mantener progresión hacia la fecha de carrera`;
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

  const { userId, planAnterior } = parsed;
  if (!userId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  // Obtener perfil del usuario (incluyendo campos de Strava)
  const profiles = await supabaseGet(
    hostname,
    `/rest/v1/profiles?id=eq.${userId}&select=deporte,nivel,objetivo,fecha_carrera,contexto,strava_token,strava_token_expires_at,plan`,
    supabaseKey
  );

  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Perfil no encontrado' }) };
  }

  const isPro = profile.plan === 'pro';

  // Obtener actividades de Strava solo para usuarios Pro
  let stravaText = null;
  if (isPro && profile.strava_token) {
    const now = Math.floor(Date.now() / 1000);
    const tokenOk = !profile.strava_token_expires_at || profile.strava_token_expires_at > now;
    if (tokenOk) {
      const activities = await fetchStravaActivities(profile.strava_token);
      if (Array.isArray(activities) && activities.length > 0) {
        stravaText = activities.slice(0, 5)
          .map(a => `${a.type} ${(a.distance / 1000).toFixed(1)}km en ${Math.round(a.moving_time / 60)}min`)
          .join(', ');
      }
    }
  }

  const weekStart = getWeekStart();

  const deporteInfo = {
    triatlon: 'triatlón olímpico (natación 1.5km, ciclismo 40km, running 10km)',
    running: 'running y carreras populares',
    hyrox: 'Hyrox (carrera funcional con estaciones de fitness)',
  };

  const analisisSection = (isPro && planAnterior)
    ? '\n\n' + buildAnalisisSemanaAnterior(planAnterior, stravaText)
    : '';

  const systemPrompt = `Eres un coach deportivo experto. Genera planes de entrenamiento personalizados en JSON.
Instrucción: devuelve SOLO un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

  const userMessage = `Genera un plan de entrenamiento semanal para este atleta:

Deporte: ${deporteInfo[profile.deporte] || profile.deporte || 'deporte de resistencia'}
Nivel: ${profile.nivel || 'principiante'}
Objetivo: ${profile.objetivo || 'mejorar forma física'}
${profile.fecha_carrera ? `Próximo evento: ${profile.fecha_carrera}` : ''}
${profile.contexto ? `Contexto del atleta: ${profile.contexto}` : ''}${analisisSection}

El JSON debe tener esta estructura exacta:
{
  "semana": "${weekStart}",
  "sesiones": [
    { "dia": "Lunes", "tipo": "Correr", "descripcion": "Rodaje suave 45min zona 2", "duracion_min": 45, "intensidad": "suave" },
    { "dia": "Martes", "tipo": "Descanso", "descripcion": "Recuperación activa o descanso completo", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "Miércoles", "tipo": "Correr", "descripcion": "...", "duracion_min": 50, "intensidad": "moderada" },
    { "dia": "Jueves", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "Viernes", "tipo": "Correr", "descripcion": "...", "duracion_min": 45, "intensidad": "suave" },
    { "dia": "Sábado", "tipo": "Correr", "descripcion": "...", "duracion_min": 75, "intensidad": "moderada" },
    { "dia": "Domingo", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" }
  ]
}

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
Devuelve exactamente 7 sesiones, una por día de la semana (Lunes a Domingo).

Para la descripción de cada sesión activa incluye en una sola línea:
- Calentamiento específico (10-15% del tiempo): qué hacer exactamente
- Bloque principal con detalles concretos según el deporte:
  * Correr: series con distancia y ritmo (ej: "4x1000m a 4:45/km, 90seg recuperación trote")
  * Bici: intervalos con zona o vatios (ej: "3x10min zona 3 a 85rpm")
  * Nadar: series con distancia y descanso (ej: "6x100m estilo libre, 20seg descanso")
  * Fuerza/Hyrox: ejercicios, series y repeticiones (ej: "Sentadilla 3x10, Remo 3x12, Core 3x15")
- Vuelta a la calma (10% del tiempo): estiramientos o recuperación suave
- RPE objetivo para el bloque principal (ej: "RPE 6-7")
Ejemplo descripción running: "Cal 10min trote suave z1. Principal: 4x1000m a 5:10/km con 90seg recuperación. Vuelta 5min estiramientos. RPE 7-8"`;


  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const claudeResponse = await callClaude(ANTHROPIC_KEY, systemPrompt, userMessage);

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

  if (!planData.sesiones || planData.sesiones.length !== 7) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan debe tener exactamente 7 sesiones' }) };
  }

  // Guardar en Supabase
  const inserted = await supabasePost(hostname, '/rest/v1/plans', supabaseKey, {
    user_id: userId,
    semana: weekStart,
    sesiones: planData.sesiones
  });

  const plan = Array.isArray(inserted) ? inserted[0] : inserted;

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  };
};
