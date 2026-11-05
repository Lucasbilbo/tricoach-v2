// Prueba mínima de los modelos de Claude configurados (Free y Pro).
// La usan health-check (programada, avisa por email) y claude-status (manual).
const https = require('https');
const { callClaude, extractText, modelFor } = require('./claude');

async function probarModelo(model) {
  const t0 = Date.now();
  const r = await callClaude({
    model,
    messages: [{ role: 'user', content: 'Responde solo con la palabra OK.' }],
    maxTokens: 64,
    timeoutMs: 15000,
    sinFallback: true, // el chequeo debe ver el fallo real aunque el chat se autocure
  });
  const texto = r.ok ? extractText(r.data) : '';
  return { model, ok: r.ok && texto.length > 0, status: r.status, error: r.error || (r.ok && !texto ? 'respuesta sin texto' : null), ms: Date.now() - t0 };
}

async function probarModelos() {
  const modelos = [...new Set([modelFor('free'), modelFor('pro')])];
  return Promise.all(modelos.map(probarModelo));
}

// ── Errores reales de usuarios ───────────────────────────────────────────────
// Chat.jsx guarda el mensaje del usuario ANTES de llamar al coach y solo guarda la
// respuesta si llega. Un mensaje de usuario sin respuesta posterior = fallo (o límite).
// No hace falta ninguna tabla nueva: se deduce de `messages`.

const VENTANA_MS = 24 * 60 * 60 * 1000;
const ESPERA_RESPUESTA_MS = 10 * 60 * 1000; // los mensajes más recientes aún pueden estar en curso
const MIN_FALLOS_ALERTA = 3;
const RATIO_ALERTA = 0.3;
const MENSAJES_LIMITE = 10; // quien llega a 10 mensajes pudo toparse con el límite diario, no con un fallo

function calcularSinRespuesta(mensajes, ahora = Date.now()) {
  const porUsuario = new Map();
  for (const m of mensajes || []) {
    if (!m || !m.user_id) continue;
    if (!porUsuario.has(m.user_id)) porUsuario.set(m.user_id, []);
    porUsuario.get(m.user_id).push({ role: m.role, t: Date.parse(m.created_at) });
  }
  let total = 0;
  let sinRespuesta = 0;
  for (const lista of porUsuario.values()) {
    const usuario = lista.filter(m => m.role === 'user' && Number.isFinite(m.t));
    if (usuario.length >= MENSAJES_LIMITE) continue;
    const coach = lista.filter(m => m.role === 'assistant' && Number.isFinite(m.t));
    for (const u of usuario) {
      if (ahora - u.t < ESPERA_RESPUESTA_MS) continue;
      total += 1;
      if (!coach.some(c => c.t >= u.t && c.t - u.t <= ESPERA_RESPUESTA_MS)) sinRespuesta += 1;
    }
  }
  const ratio = total ? sinRespuesta / total : 0;
  return { total, sinRespuesta, ratio, alerta: sinRespuesta >= MIN_FALLOS_ALERTA && ratio >= RATIO_ALERTA };
}

function leerMensajesRecientes(ahora = Date.now()) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) return Promise.resolve(null);
  const desde = new Date(ahora - VENTANA_MS).toISOString();
  return new Promise((resolve) => {
    const req = https.request({
      hostname: new URL(base).hostname,
      path: `/rest/v1/messages?select=user_id,role,created_at&created_at=gte.${encodeURIComponent(desde)}&order=created_at.asc&limit=5000`,
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { const d = JSON.parse(raw); resolve(Array.isArray(d) ? d : null); } catch { resolve(null); }
      });
    });
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function comprobarRespuestasChat() {
  const ahora = Date.now();
  const mensajes = await leerMensajesRecientes(ahora);
  if (mensajes === null) return { ok: true, sinDatos: true, total: 0, sinRespuesta: 0, ratio: 0, alerta: false };
  return { ok: true, ...calcularSinRespuesta(mensajes, ahora) };
}

// Prueba realista (manual): un turno de chat con la herramienta del coach y un plan
// semanal en JSON, para medir latencia y comprobar el formato con cada modelo.
const TOOL = {
  name: 'actualizar_perfil',
  description: 'Guarda información relevante del atleta en su perfil.',
  input_schema: { type: 'object', properties: { dato: { type: 'string' } }, required: ['dato'] },
};

async function probarCompleto(plan) {
  const model = modelFor(plan);
  const t0 = Date.now();
  const chat = await callClaude({
    model,
    system: 'Eres un coach de running. Responde en español en 2 frases.',
    messages: [{ role: 'user', content: 'Mi mejor 10k es 52 minutos. ¿A qué ritmo hago el rodaje suave?' }],
    tools: [TOOL],
    maxTokens: 2048,
    timeoutMs: 22000,
  });
  // Mismo camino que claude.js cuando el modelo solo usa la herramienta
  let chatTexto = extractText(chat.data);
  let seguimiento = false;
  const toolUses = (chat.data?.content || []).filter(b => b.type === 'tool_use');
  if (chat.ok && !chatTexto && toolUses.length) {
    seguimiento = true;
    const f = await callClaude({
      model,
      system: 'Eres un coach de running. Responde en español en 2 frases.',
      tools: [TOOL],
      maxTokens: 2048,
      timeoutMs: 15000,
      messages: [
        { role: 'user', content: 'Mi mejor 10k es 52 minutos. ¿A qué ritmo hago el rodaje suave?' },
        { role: 'assistant', content: chat.data.content },
        { role: 'user', content: toolUses.map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Guardado en el perfil.' })) },
      ],
    });
    chatTexto = f.ok ? extractText(f.data) : `ERROR seguimiento ${f.status}: ${f.error}`;
  }
  const tChat = Date.now() - t0;
  const t1 = Date.now();
  const planRes = await callClaude({
    model,
    system: 'Eres un entrenador. Devuelve SOLO JSON válido, sin texto extra.',
    messages: [{ role: 'user', content: 'Plan de 7 días (Lunes a Domingo) para un corredor intermedio que prepara un 10K, 4 días de entreno. Formato: {"sesiones":[{"dia":"Lunes","tipo":"Correr|Fuerza|Descanso","subtipo":"","descripcion":"","duracion_min":0,"intensidad":"suave|moderada|fuerte|descanso","distancia_km":null,"zona_objetivo":null,"estructura":{"calentamiento":"","principal":"","vuelta_calma":"","rpe_objetivo":""}}]}' }],
    maxTokens: 8000,
    timeoutMs: 24000,
  });
  const tPlan = Date.now() - t1;
  let sesiones = null;
  try {
    const txt = extractText(planRes.data);
    const m = txt.match(/\{[\s\S]*\}/);
    sesiones = JSON.parse(m ? m[0] : txt).sesiones?.length ?? null;
  } catch { sesiones = null; }
  return {
    model,
    chat: { ok: chat.ok && Boolean(chatTexto) && !chatTexto.startsWith('ERROR'), status: chat.status, ms: tChat, seguimiento, texto: chatTexto.slice(0, 200), stop: chat.data?.stop_reason },
    plan: { ok: planRes.ok && sesiones === 7, status: planRes.status, ms: tPlan, sesiones, stop: planRes.data?.stop_reason, tokens: planRes.data?.usage?.output_tokens, error: planRes.error },
  };
}

module.exports = { probarModelo, probarModelos, probarCompleto, calcularSinRespuesta, comprobarRespuestasChat };
