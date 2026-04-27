const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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

function supabasePatch(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'PATCH',
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
    max_tokens: 2500,
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

function migrarSesionAntigua(s) {
  if (s.estructura) return s;
  return {
    ...s,
    subtipo: s.tipo,
    distancia_km: null,
    zona_objetivo: s.intensidad === 'suave' ? 'Z1-Z2' : s.intensidad === 'moderada' ? 'Z3-Z4' : 'Z4-Z5',
    estructura: {
      calentamiento: 'Calentamiento general 10min.',
      principal: s.descripcion,
      vuelta_calma: 'Vuelta a la calma y estiramientos.',
      rpe_objetivo: s.intensidad === 'suave' ? '4-5' : s.intensidad === 'moderada' ? '6-7' : '7-8',
    },
    tiempo_real_min: null,
    distancia_real_km: null,
    fc_media_real: null,
    notas_usuario: null,
  };
}

function buildMotivoPrompt(motivo, descripcion, pendientesStr) {
  const desc = descripcion ? ` (${descripcion})` : '';
  switch (motivo) {
    case 'dia_suelto':
      return `El atleta no puede entrenar hoy${desc}. Sesiones pendientes: ${pendientesStr}. Redistribuye la sesión del día en los días pendientes sin aumentar más del 20% la carga de ningún día. Si no hay hueco, márcala como descansada.`;
    case 'lesion':
      return `El atleta está lesionado${desc}. Genera una semana de recuperación activa. Sin impacto, sin pesos. Solo movilidad, natación suave o bici estática. Mantén la rutina sin forzar.`;
    case 'viaje':
      return `El atleta va de viaje${desc}. Adapta las sesiones pendientes para hacer sin material ni gym. Running, HIIT con peso corporal, estiramientos.`;
    default:
      return `Ajusta el plan según esta situación: ${descripcion || motivo}`;
  }
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

  const { userId, planId, motivo, descripcion } = parsed;
  if (!userId || !planId || !motivo) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId, planId y motivo son requeridos' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const hostname = new URL(supabaseUrl).hostname;

  // Obtener plan actual
  const plans = await supabaseGet(
    hostname,
    `/rest/v1/plans?id=eq.${planId}&user_id=eq.${userId}&select=*`,
    supabaseKey
  );
  const planActual = Array.isArray(plans) ? plans[0] : null;
  if (!planActual) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Plan no encontrado' }) };
  }

  // Obtener perfil del usuario
  const profiles = await supabaseGet(
    hostname,
    `/rest/v1/profiles?id=eq.${userId}&select=deporte,nivel,objetivo,fecha_carrera`,
    supabaseKey
  );
  const profile = Array.isArray(profiles) ? profiles[0] : {};

  const sesiones = planActual.sesiones || [];
  const completadas = sesiones.filter(s => s.completada);
  const pendientes = sesiones
    .filter(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso')
    .map(migrarSesionAntigua);
  const pendientesStr = pendientes.map(s => `${s.dia}: ${s.tipo} (${s.duracion_min}min)`).join(', ') || 'Ninguna pendiente';

  const motivoPrompt = buildMotivoPrompt(motivo, descripcion, pendientesStr);

  const systemPrompt = `Eres un coach deportivo experto. Ajusta planes de entrenamiento en JSON.
Instrucción: devuelve SOLO un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

  const deporteInfo = {
    triatlon: 'triatlón olímpico',
    running: 'running',
    natacion: 'natación',
    hyrox: 'Hyrox',
  };

  const sesionesResumenConEstructura = sesiones.map(s => {
    const migrada = migrarSesionAntigua(s);
    const base = `${migrada.dia}: ${migrada.tipo} ${migrada.duracion_min}min [${migrada.completada ? '✓ completada' : 'pendiente'}]`;
    if (!migrada.completada && migrada.estructura) {
      return `${base}\n  Principal: ${migrada.estructura.principal?.substring(0, 80)}`;
    }
    return base;
  }).join('\n');

  const userMessage = `Ajusta el plan semanal de este atleta de ${deporteInfo[profile.deporte] || 'deporte de resistencia'} (nivel ${profile.nivel || 'principiante'}).

Plan actual:
${sesionesResumenConEstructura}

Sesiones ya completadas: ${completadas.length}

Situación: ${motivoPrompt}

Devuelve el plan ajustado manteniendo las sesiones completadas tal como están (con completada: true) y ajustando solo las pendientes.

El JSON debe tener esta estructura exacta (7 sesiones, Lunes a Domingo). El campo "estructura" es OBLIGATORIO para sesiones no-descanso ajustadas:
{
  "semana": "${planActual.semana}",
  "sesiones": [
    {
      "dia": "Lunes",
      "tipo": "Correr",
      "subtipo": "Rodaje Z2",
      "duracion_min": 45,
      "intensidad": "suave",
      "distancia_km": 6,
      "zona_objetivo": "Z1-Z2",
      "estructura": {
        "calentamiento": "10min trote suave Z1",
        "principal": "30min rodaje Z2 a 5:45/km",
        "vuelta_calma": "5min andar + estiramientos",
        "rpe_objetivo": "5-6"
      }
    }
  ]
}

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
zona_objetivo posibles: "Z1-Z2", "Z2-Z3", "Z3-Z4", "Z4-Z5" (null para Descanso)
Conserva el campo "completada: true" y TODOS los campos originales (incluyendo estructura) en las sesiones ya completadas.`;

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const claudeResponse = await callClaude(ANTHROPIC_KEY, systemPrompt, userMessage);

  if (!claudeResponse || !claudeResponse.content?.[0]?.text) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al ajustar el plan' }) };
  }

  let planData;
  try {
    const text = claudeResponse.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    planData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan ajustado no es JSON válido' }) };
  }

  if (!planData.sesiones || planData.sesiones.length !== 7) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan debe tener exactamente 7 sesiones' }) };
  }

  // Actualizar plan en Supabase
  const updated = await supabasePatch(
    hostname,
    `/rest/v1/plans?id=eq.${planId}`,
    supabaseKey,
    { sesiones: planData.sesiones }
  );

  const plan = Array.isArray(updated) ? updated[0] : updated;

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  };
};
