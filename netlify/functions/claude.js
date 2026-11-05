const https = require('https');
const { authenticate, corsHeaders } = require('./lib/auth');
const { modelFor, cheapModel, extractText, callClaude } = require('./lib/claude');
const { planEfectivo } = require('./lib/plan-efectivo');

const MAX_BODY_BYTES = 64 * 1024;
const CLAUDE_MAX_TOKENS = 2048;      // incluye el razonamiento de los modelos 5.5
const CONTEXTO_MAX_TOKENS = 400;

const DAILY_LIMIT = { free: 10, pro: 20 };

// Resumen de contexto del atleta (src/lib/context.js). El system lo fija el servidor:
// el cliente solo aporta la conversación. Usa siempre el modelo barato y no cuenta
// para el límite diario de mensajes.
const CONTEXTO_SYSTEM = 'Eres un asistente que resume conversaciones de coaching deportivo. Responde SOLO con el resumen, sin explicaciones ni saludos.';

const ACTUALIZAR_PERFIL_TOOL = {
  name: 'actualizar_perfil',
  description: 'Guarda información relevante del atleta en su perfil. Úsala cuando el usuario mencione marcas personales (5K, 10K, maratón, etc.), lesiones actuales o pasadas, disponibilidad de entrenamiento, equipamiento, o cualquier dato que deba recordarse en futuras sesiones.',
  input_schema: {
    type: 'object',
    properties: {
      dato: {
        type: 'string',
        description: 'El dato a guardar, redactado de forma concisa. Ej: "Marca 5K: 25 min", "Lesión rodilla derecha (tendinitis)", "Entrena lunes, miércoles y viernes"'
      }
    },
    required: ['dato']
  }
};


function supabaseGet(hostname, path, key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'GET',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)[0]); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Atomic rate-limit increment via Postgres RPC.
// Required SQL (run once in Supabase SQL Editor):
//   CREATE OR REPLACE FUNCTION increment_messages_today(p_user_id uuid, p_limit int, p_today text)
//   RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
//   DECLARE new_count int;
//   BEGIN
//     UPDATE profiles
//     SET messages_today = CASE WHEN last_message_date::text = p_today THEN messages_today + 1 ELSE 1 END,
//         last_message_date = p_today::date
//     WHERE id = p_user_id AND (last_message_date::text != p_today OR messages_today < p_limit)
//     RETURNING messages_today INTO new_count;
//     RETURN COALESCE(new_count, -1);
//   END; $$;
//   GRANT EXECUTE ON FUNCTION increment_messages_today TO service_role;
function supabaseRpc(hostname, path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: {
        'apikey': key, 'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

// Append new athlete data to profile.contexto under [Datos del atleta] section.
// Reads current contexto, appends each dato with today's date, patches back to Supabase.
async function actualizarContextoPerfil(userId, datos, hostname, supabaseKey) {
  const perfil = await new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: `/rest/v1/profiles?id=eq.${userId}&select=contexto`,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    }, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)[0]); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });

  if (!perfil) return;

  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  let contexto = (perfil.contexto || '').trimEnd();

  for (const dato of datos) {
    const linea = `${dato} (actualizado ${hoy})`;
    if (contexto.includes('[Datos del atleta]')) {
      contexto = contexto + '\n' + linea;
    } else {
      const sep = contexto ? '\n\n' : '';
      contexto = contexto + sep + '[Datos del atleta]\n' + linea;
    }
  }

  const patchBody = JSON.stringify({ contexto });
  await new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: `/rest/v1/profiles?id=eq.${userId}`,
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(patchBody),
        'Prefer': 'return=minimal'
      }
    }, (r) => {
      r.on('data', () => {});
      r.on('end', resolve);
    });
    req.on('error', resolve);
    req.write(patchBody);
    req.end();
  });
}

function json(statusCode, cors, obj) {
  return { statusCode, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

// Mensaje para el usuario según el fallo. Nunca se guarda como respuesta del coach.
function mensajeError(status) {
  if (status === 408) return 'El coach tardó demasiado en responder. Inténtalo de nuevo.';
  if (status === 429 || status === 529) return 'El coach está saturado ahora mismo. Inténtalo en un minuto.';
  return 'El coach no está disponible ahora mismo. Ya estamos avisados; inténtalo en un rato.';
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const rawBody = event.body || '';
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return json(413, CORS, { error: 'Request demasiado grande' });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return json(400, CORS, { error: 'JSON inválido' });
  }

  const auth = await authenticate(event, { cors: CORS, bodyUserId: parsed.userId });
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
    return json(400, CORS, { error: 'messages requerido' });
  }
  if (parsed.messages.length > 60) parsed.messages = parsed.messages.slice(-60);

  const esContexto = parsed.purpose === 'contexto';

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

  // Plan del usuario: decide el modelo y el límite diario
  const profile = supabaseHostname
    ? await supabaseGet(supabaseHostname, `/rest/v1/profiles?id=eq.${userId}&select=plan,deleted_at,trial_ends_at`, supabaseServiceKey)
    : null;
  if (profile?.deleted_at) return json(403, CORS, { error: 'Cuenta eliminada' });
  const plan = planEfectivo(profile);

  // ── Límite diario (RPC atómica). El resumen de contexto no cuenta. ──
  if (!esContexto && supabaseHostname) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const newCount = await supabaseRpc(supabaseHostname, '/rest/v1/rpc/increment_messages_today', supabaseServiceKey, {
      p_user_id: userId, p_limit: DAILY_LIMIT[plan], p_today: today,
    });
    if (newCount === -1) {
      return json(429, CORS, { error: 'Has alcanzado el límite de mensajes de hoy', limite: DAILY_LIMIT[plan], plan });
    }
    // newCount === null → Supabase falló: se deja pasar el mensaje en vez de bloquear
  }

  // Limpieza de mensajes: sin vacíos, solo user/assistant, sin errores antiguos guardados
  // como respuesta del coach, empezando y terminando en user (los modelos 5.5 rechazan
  // un último turno de assistant).
  let cleanMessages = parsed.messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .filter(m => typeof m.content === 'string' && m.content.trim() !== '')
    .filter(m => !(m.role === 'assistant' && m.content.trim() === 'Error al responder'))
    .map(m => ({ role: m.role, content: m.content }));

  // Fusionar turnos consecutivos del mismo rol (al quitar errores pueden quedar dos user seguidos)
  cleanMessages = cleanMessages.reduce((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.role === m.role) {
      acc[acc.length - 1] = { ...last, content: `${last.content}\n${m.content}` };
    } else {
      acc.push(m);
    }
    return acc;
  }, []);
  const firstUser = cleanMessages.findIndex(m => m.role === 'user');
  cleanMessages = firstUser >= 0 ? cleanMessages.slice(firstUser) : [];
  while (cleanMessages.length && cleanMessages[cleanMessages.length - 1].role !== 'user') cleanMessages.pop();

  if (cleanMessages.length === 0) return json(400, CORS, { error: 'No hay mensajes válidos' });

  const system = esContexto ? CONTEXTO_SYSTEM : (typeof parsed.system === 'string' ? parsed.system.slice(0, 40000) : undefined);
  const model = esContexto ? cheapModel() : modelFor(plan);
  const tools = esContexto ? undefined : [ACTUALIZAR_PERFIL_TOOL];

  const first = await callClaude({
    model, system, messages: cleanMessages, tools,
    maxTokens: esContexto ? CONTEXTO_MAX_TOKENS : CLAUDE_MAX_TOKENS,
    timeoutMs: 22000,
  });

  if (!first.ok) {
    return json(first.status === 408 ? 408 : 502, CORS, { error: mensajeError(first.status), codigo: 'claude_error' });
  }

  let data = first.data;
  let text = extractText(data);

  // ── tool_use: actualizar_perfil ──
  const toolUses = (data.content || []).filter(b => b.type === 'tool_use' && b.name === 'actualizar_perfil');
  if (toolUses.length > 0 && supabaseHostname) {
    const datos = toolUses.map(b => b.input?.dato).filter(Boolean);
    await Promise.race([
      actualizarContextoPerfil(userId, datos, supabaseHostname, supabaseServiceKey),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]).catch(() => {});

    // Si Claude solo guardó el dato y no escribió nada, se le devuelve el resultado de la
    // herramienta para que conteste. Antes esto acababa en "Error al responder".
    if (!text) {
      const followUp = await callClaude({
        model, system, tools,
        maxTokens: CLAUDE_MAX_TOKENS,
        timeoutMs: 15000,
        messages: [
          ...cleanMessages,
          { role: 'assistant', content: data.content },
          { role: 'user', content: toolUses.map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Guardado en el perfil.' })) },
        ],
      });
      if (followUp.ok) {
        data = followUp.data;
        text = extractText(data);
      }
    }
  }

  if (!text) {
    if (data?.stop_reason === 'refusal') {
      text = 'Prefiero no responder a eso. Si es sobre tu entrenamiento, cuéntamelo de otra forma y lo vemos.';
    } else {
      console.error(`[claude] respuesta sin texto (stop_reason=${data?.stop_reason}) user=${userId}`);
      return json(502, CORS, { error: mensajeError(502), codigo: 'sin_texto' });
    }
  }

  return json(200, CORS, {
    content: [{ type: 'text', text }],
    text,
    stop_reason: data?.stop_reason || 'end_turn',
    model,
  });
};
