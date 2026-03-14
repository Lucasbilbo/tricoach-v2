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
  const diff = day === 0 ? -6 : 1 - day;
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

function callClaude(apiKey, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
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

function buildDiagnosticoUserMessage(profile, weekStart, deporteInfo, dias) {
  const deporte = profile.deporte;

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

  const sesionesInfo = (testsInfo[deporte] || testsInfo.running).slice(0, dias.length).join('\n- ');

  return `Este atleta acaba de registrarse. Genera una SEMANA DE DIAGNÓSTICO para evaluar su nivel real.

PERFIL:
Deporte: ${deporteInfo[deporte] || deporte}
Nivel declarado: ${profile.nivel || 'desconocido'}
Objetivo: ${profile.objetivo || 'mejorar forma física'}

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

  const { userId, planAnterior, fechaInicio } = parsed;
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
  let stravaActivities = null;
  if (isPro && profile.strava_token) {
    const now = Math.floor(Date.now() / 1000);
    const tokenOk = !profile.strava_token_expires_at || profile.strava_token_expires_at > now;
    if (tokenOk) {
      stravaActivities = await fetchStravaActivities(profile.strava_token);
      if (Array.isArray(stravaActivities) && stravaActivities.length > 0) {
        stravaText = stravaActivities.slice(0, 5)
          .map(a => `${a.type} ${(a.distance / 1000).toFixed(1)}km en ${Math.round(a.moving_time / 60)}min`)
          .join(', ');
      }
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

  const metodo = calcularMetodo(profile.fecha_carrera, profile.nivel);

  // Detectar si necesita semana de diagnóstico
  const planesExistentes = await supabaseGet(
    hostname,
    `/rest/v1/plans?user_id=eq.${userId}&select=id&limit=1`,
    supabaseKey
  );
  const esPrimerPlan = !Array.isArray(planesExistentes) || planesExistentes.length === 0;
  const actividadesCount = Array.isArray(stravaActivities) ? stravaActivities.length : 0;
  const necesitaDiagnostico = esPrimerPlan && actividadesCount < 3;

  const weekStart = fechaInicio || getMondayOfCurrentWeek();
  const startDate = fechaInicio || getTodayDate();
  const dias = getDiasDesdeDate(startDate, weekStart);

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
    userMessage = buildDiagnosticoUserMessage(profile, weekStart, deporteInfo, dias);
  } else {
    const analisisSection = (isPro && planAnterior)
      ? '\n\n' + buildAnalisisSemanaAnterior(planAnterior, stravaText)
      : '';
    userMessage = `Genera un plan de entrenamiento semanal para este atleta:

Deporte: ${deporteInfo[profile.deporte] || profile.deporte || 'deporte de resistencia'}
Nivel: ${profile.nivel || 'principiante'}
Objetivo: ${profile.objetivo || 'mejorar forma física'}
${profile.fecha_carrera ? `Próximo evento: ${profile.fecha_carrera}` : ''}
${profile.contexto ? `Contexto del atleta: ${profile.contexto}` : ''}${analisisSection}

El plan empieza el ${weekStart}. Los días en orden son: ${dias.join(', ')}.

${metodoTextos[metodo]}
${profile.nivel === 'principiante' ? `RESTRICCIÓN NIVEL PRINCIPIANTE: Máximo 5 sesiones activas (2 deben ser descanso). Duración máxima de sesión: 60min. Sin series de alta intensidad. Todas las sesiones en Z1-Z2. Prioriza técnica y adaptación.` : ''}

El JSON debe tener esta estructura exacta con los días en el orden indicado:
{
  "semana": "${weekStart}",
  "sesiones": [
    { "dia": "${dias[0]}", "tipo": "Correr", "descripcion": "Rodaje suave 45min zona 2", "duracion_min": 45, "intensidad": "suave" },
    { "dia": "${dias[1]}", "tipo": "Descanso", "descripcion": "Recuperación activa o descanso completo", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "${dias[2]}", "tipo": "Correr", "descripcion": "...", "duracion_min": 50, "intensidad": "moderada" },
    { "dia": "${dias[3]}", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" },
    { "dia": "${dias[4]}", "tipo": "Correr", "descripcion": "...", "duracion_min": 45, "intensidad": "suave" },
    { "dia": "${dias[5]}", "tipo": "Correr", "descripcion": "...", "duracion_min": 75, "intensidad": "moderada" },
    { "dia": "${dias[6]}", "tipo": "Descanso", "descripcion": "...", "duracion_min": 0, "intensidad": "descanso" }
  ]
}

tipos posibles: "Correr", "Bici", "Nadar", "Fuerza", "Brick", "Descanso"
intensidades posibles: "suave", "moderada", "fuerte", "descanso"
Devuelve exactamente ${dias.length} sesiones en el orden: ${dias.join(', ')}.

Para la descripción de cada sesión activa incluye en una sola línea:
- Calentamiento específico (10-15% del tiempo): qué hacer exactamente
- Bloque principal con detalles concretos según el deporte:
  * Correr: series con distancia y ritmo (ej: "4x1000m a 4:45/km, 90seg recuperación trote")
  * Bici: intervalos con zona o vatios (ej: "3x10min zona 3 a 85rpm")
  * Nadar: estilo (crol/espalda/braza), distancia, descanso y ritmo por 100m; añadir drills de técnica si nivel principiante (ej: "6x100m crol con 20seg descanso, ritmo 2:00/100m")
  * Fuerza/Hyrox: ejercicios, series y repeticiones (ej: "Sentadilla 3x10, Remo 3x12, Core 3x15")
- Vuelta a la calma (10% del tiempo): estiramientos o recuperación suave
- RPE objetivo para el bloque principal (ej: "RPE 6-7")
Ejemplo descripción running: "Cal 10min trote suave z1. Principal: 4x1000m a 5:10/km con 90seg recuperación. Vuelta 5min estiramientos. RPE 7-8"`;
  }


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

  if (!planData.sesiones || planData.sesiones.length < 1) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'El plan no tiene sesiones' }) };
  }

  // Inyectar tipo_semana en cada sesión de diagnóstico
  if (necesitaDiagnostico) {
    planData.sesiones = planData.sesiones.map(s => ({ ...s, tipo_semana: 'diagnostico' }));
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
