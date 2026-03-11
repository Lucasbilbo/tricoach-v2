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
  const day = now.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
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
  const hostname = new URL(supabaseUrl).hostname;

  // Obtener perfil del usuario
  const profiles = await supabaseGet(
    hostname,
    `/rest/v1/profiles?id=eq.${userId}&select=deporte,nivel,objetivo,fecha_carrera,contexto`,
    supabaseKey
  );

  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Perfil no encontrado' }) };
  }

  const weekStart = getWeekStart();

  const deporteInfo = {
    triatlon: 'triatlón olímpico (natación 1.5km, ciclismo 40km, running 10km)',
    running: 'running y carreras populares',
    hyrox: 'Hyrox (carrera funcional con estaciones de fitness)',
  };

  const systemPrompt = `Eres un coach deportivo experto. Genera planes de entrenamiento personalizados en JSON.
Instrucción: devuelve SOLO un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

  const userMessage = `Genera un plan de entrenamiento semanal para este atleta:

Deporte: ${deporteInfo[profile.deporte] || profile.deporte || 'deporte de resistencia'}
Nivel: ${profile.nivel || 'principiante'}
Objetivo: ${profile.objetivo || 'mejorar forma física'}
${profile.fecha_carrera ? `Próximo evento: ${profile.fecha_carrera}` : ''}
${profile.contexto ? `Contexto del atleta: ${profile.contexto}` : ''}

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
Devuelve exactamente 7 sesiones, una por día de la semana (Lunes a Domingo).`;

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
    // Extraer JSON limpio (por si Claude añade texto extra)
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
