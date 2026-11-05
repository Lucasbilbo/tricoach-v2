const claudeApi = require('./lib/claude');
const { authenticate, corsHeaders } = require('./lib/auth');
const https = require('https');
const { URL } = require('url');

let CORS = corsHeaders();



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

// Llamada a Claude vía lib/claude.js. Devuelve la respuesta de la API o null si falla
// (el error queda registrado en los logs de Netlify).
async function callClaude(apiKey, userMessage, model) {
  const r = await claudeApi.callClaude({
    apiKey,
    model,
    system: undefined,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 1200,
    timeoutMs: 20000,
  });
  return r.ok ? r.data : null;
}

exports.handler = async (event) => {
  CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };


  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { perfil, tieneDatos, actividadesResumen, esDiagnostico, sesionesTest } = parsed;
  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  if (!userId || !perfil) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId y perfil requeridos' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
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

  const claudeResponse = await callClaude(ANTHROPIC_KEY, userMessage, claudeApi.cheapModel());

  if (!claudeResponse || !claudeApi.extractText(claudeResponse)) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al generar mensaje' }) };
  }

  const mensaje = claudeApi.extractText(claudeResponse);

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
