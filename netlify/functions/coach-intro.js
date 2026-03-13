const https = require('https');
const { URL } = require('url');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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

function callClaude(apiKey, userMessage) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 300,
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

  const { userId, perfil, tieneDatos, actividadesResumen, esDiagnostico, sesionesTest } = parsed;

  if (!userId || !perfil) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId y perfil requeridos' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

  const deporteLabels = {
    triatlon: 'triatlón',
    running: 'running',
    natacion: 'natación',
    hyrox: 'Hyrox',
  };

  const datosSection = tieneDatos
    ? `DATOS DE STRAVA DISPONIBLES: ${actividadesResumen || 'historial disponible'}\nEl atleta ya tiene historial — usa estos datos para personalizar.`
    : `SIN DATOS PREVIOS — necesitamos evaluar su nivel.`;

  const planSection = esDiagnostico
    ? `SEMANA DE DIAGNÓSTICO: Las sesiones de esta semana son tests de evaluación.\nTests programados: ${JSON.stringify(sesionesTest || [])}\nExplica brevemente qué tests hará, por qué son importantes y qué debe anotar/medir en cada uno.`
    : `PLAN DIRECTO: El atleta tiene datos suficientes para empezar.\nExplica brevemente lo que has visto en sus datos y cómo has construido el plan.`;

  const userMessage = `Eres un entrenador deportivo cercano y motivador que habla en español.
Escribe un mensaje de bienvenida personalizado para un atleta que acaba de generar su primer plan de entrenamiento.

PERFIL DEL ATLETA:
Nombre: ${perfil.nombre || 'atleta'}
Deporte: ${deporteLabels[perfil.deporte] || perfil.deporte || 'deporte de resistencia'}
Nivel: ${perfil.nivel || 'principiante'}
Objetivo: ${perfil.objetivo || 'mejorar forma física'}
Carreras próximas: ${perfil.carreras ? JSON.stringify(perfil.carreras) : 'ninguna indicada'}
Historial: ${perfil.historial || 'no especificado'}

${datosSection}

${planSection}

INSTRUCCIONES:
- Máximo 4-5 frases. Directo y motivador.
- Usa el nombre del atleta
- Menciona los tests específicos si es semana de diagnóstico
- Si tiene datos de Strava, menciona algo concreto que hayas visto
- Termina con algo que invite a la acción
- NO uses emojis excesivos — máximo 1
- Tono: entrenador personal cercano, no robot corporativo

Responde SOLO con el mensaje, sin comillas ni explicaciones.`;

  const claudeResponse = await callClaude(ANTHROPIC_KEY, userMessage);

  if (!claudeResponse || !claudeResponse.content?.[0]?.text) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al generar mensaje' }) };
  }

  const mensaje = claudeResponse.content[0].text.trim();

  // Guardar como primer mensaje del coach en Supabase
  if (hostname && supabaseKey) {
    await supabasePost(hostname, '/rest/v1/messages', supabaseKey, {
      user_id: userId,
      role: 'assistant',
      content: mensaje
    });
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje })
  };
};
