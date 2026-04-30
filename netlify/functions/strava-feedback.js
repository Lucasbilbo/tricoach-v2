const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 };

const STRAVA_TIPO_MAP = {
  Run: 'Correr', VirtualRun: 'Correr',
  Ride: 'Bici', VirtualRide: 'Bici',
  Swim: 'Nadar',
};

const PERSONALIDADES = {
  cercano: 'Eres cercano, empático y motivador. Tratas al atleta como a un amigo. Tono cálido y personal, celebras sus logros.',
  estricto: 'Eres exigente y directo. Marcas objetivos claros y no aceptas excusas.',
  gracioso: 'Eres divertido y usas el humor para motivar. Haces referencias a la cultura pop.',
  motivador: 'Eres un coach al estilo Tony Robbins. Cada mensaje es una dosis de energía.',
  cientifico: 'Eres un coach deportivo basado en ciencia y datos. Usas métricas exactas: zonas FC, ritmos, vatios.',
};

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
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
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
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
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

function callClaude(apiKey, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 400,
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
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
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
  if (!FUNCTION_SECRET || secret !== FUNCTION_SECRET) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { userId, actividad } = parsed;
  if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  if (!UUID_REGEX.test(userId)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  if (!actividad) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'actividad requerida' }) };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  const hostname = new URL(supabaseUrl).hostname;

  // 1. Obtener perfil del usuario
  const profiles = await supabaseGet(
    hostname,
    `/rest/v1/profiles?id=eq.${userId}&select=nombre,nombre_coach,personalidad,plan`,
    supabaseKey
  );
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Perfil no encontrado' }) };
  }

  // 2. Solo usuarios Pro
  if (profile.plan !== 'pro') {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ skipped: true }) };
  }

  // 3. Obtener plan de la semana actual
  const semanaActual = getMondayOfCurrentWeek();
  const planes = await supabaseGet(
    hostname,
    `/rest/v1/plans?user_id=eq.${userId}&semana=eq.${semanaActual}&select=id,semana,sesiones&limit=1`,
    supabaseKey
  );
  const plan = Array.isArray(planes) && planes[0] ? planes[0] : null;

  // 4. Buscar sesión del plan más cercana a la actividad por tipo y fecha
  let sesionPlanificada = null;
  if (plan?.sesiones) {
    const tipoPlan = STRAVA_TIPO_MAP[actividad.tipo_deporte] || actividad.tipo_deporte;
    const actividadFecha = actividad.fecha || new Date().toISOString().split('T')[0];
    const baseDate = new Date(plan.semana + 'T12:00:00');

    const sesionesActivas = plan.sesiones.filter(s =>
      s.tipo?.toLowerCase() !== 'descanso' && !s.completada
    );

    // Prefer exact tipo match; fall back to any active session
    const mismoTipo = sesionesActivas.filter(s => s.tipo === tipoPlan);
    const pool = mismoTipo.length > 0 ? mismoTipo : sesionesActivas;

    if (pool.length > 0) {
      sesionPlanificada = pool.reduce((closest, s) => {
        const offset = DIA_OFFSET_MAP[s.dia] ?? 0;
        const sesionDate = new Date(baseDate);
        sesionDate.setDate(baseDate.getDate() + offset);
        const sesionDateStr = sesionDate.toISOString().split('T')[0];
        const diff = Math.abs(new Date(actividadFecha) - new Date(sesionDateStr));
        if (!closest) return { sesion: s, diff };
        return diff < closest.diff ? { sesion: s, diff } : closest;
      }, null)?.sesion || null;
    }
  }

  // 5. Construir prompt para Claude
  const nombreCoach = profile.nombre_coach || 'Coach';
  const nombreAtleta = profile.nombre || 'atleta';
  const personalidad = PERSONALIDADES[profile.personalidad] || PERSONALIDADES.cercano;

  const actividadInfo = [
    actividad.distancia_km ? `${actividad.distancia_km}km` : null,
    actividad.duracion_min ? `${actividad.duracion_min} minutos` : null,
    actividad.zona_fc ? `zona ${actividad.zona_fc}` : null,
    actividad.fc_media ? `FC media ${actividad.fc_media} ppm` : null,
    actividad.intensidad_pct ? `(${actividad.intensidad_pct}% FCmax)` : null,
    actividad.ritmo_min_km ? `ritmo ${actividad.ritmo_min_km}/km` : null,
  ].filter(Boolean).join(', ');

  let sesionPlanInfo = 'Sin plan registrado para esta sesión.';
  if (sesionPlanificada) {
    const rpeObj = sesionPlanificada.estructura?.rpe_objetivo;
    sesionPlanInfo = [
      `Tipo planificado: ${sesionPlanificada.tipo}`,
      sesionPlanificada.duracion_min ? `Duración planificada: ${sesionPlanificada.duracion_min}min` : null,
      sesionPlanificada.zona_objetivo ? `Zona objetivo: ${sesionPlanificada.zona_objetivo}` : null,
      rpeObj ? `RPE objetivo: ${rpeObj}` : null,
    ].filter(Boolean).join('. ');
  }

  // Encontrar próxima sesión pendiente (mismo día o siguiente)
  let proximaSesion = null;
  if (plan?.sesiones && actividad.fecha) {
    const baseDate = new Date(plan.semana + 'T12:00:00');
    const actividadFecha = actividad.fecha;
    const pendientes = plan.sesiones
      .filter(s => s.tipo?.toLowerCase() !== 'descanso' && !s.completada)
      .map(s => {
        const offset = DIA_OFFSET_MAP[s.dia] ?? 0;
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + offset);
        return { sesion: s, fecha: d.toISOString().split('T')[0] };
      })
      .filter(({ fecha }) => fecha > actividadFecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    proximaSesion = pendientes[0]?.sesion || null;
  }

  const proximaInfo = proximaSesion
    ? `La próxima sesión pendiente del atleta es: ${proximaSesion.tipo}${proximaSesion.subtipo ? ' — ' + proximaSesion.subtipo : ''} (${proximaSesion.dia}).`
    : '';

  const systemPrompt = `Eres el coach deportivo personal llamado ${nombreCoach}. ${personalidad}
Tu atleta se llama ${nombreAtleta}.
Acaba de sincronizar una actividad desde Strava y recibes los datos automáticamente.
Escribe un mensaje breve de feedback post-entrenamiento: máximo 3-4 frases.
Tono: conversacional, como un mensaje de WhatsApp del coach, NO un informe técnico.
Menciona al menos un dato concreto del entrenamiento (distancia, zona, FC o ritmo).
Si hay próxima sesión pendiente, anticipa brevemente qué viene.
NO uses listas, bullets ni formato. Solo texto natural.
NO empieces con el nombre del atleta ni con "¡".`;

  const userMessage = `Actividad completada:
Tipo: ${actividad.tipo_deporte || 'Entrenamiento'}
Datos: ${actividadInfo}

Sesión planificada: ${sesionPlanInfo}
${proximaInfo}

Escribe el mensaje de feedback ahora.`;

  // 6. Llamar a Claude
  const claudeResponse = await callClaude(anthropicKey, systemPrompt, userMessage);
  const mensaje = claudeResponse?.content?.[0]?.text;

  if (!mensaje) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'No se pudo generar el mensaje' }) };
  }

  // 7. Guardar en tabla messages
  await supabasePost(
    hostname,
    '/rest/v1/messages',
    supabaseKey,
    { user_id: userId, role: 'assistant', content: mensaje }
  );

  // 8. Retornar
  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, mensaje })
  };
};
