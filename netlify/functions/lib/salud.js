// Prueba mínima de los modelos de Claude configurados (Free y Pro).
// La usan health-check (programada, avisa por email) y claude-status (manual).
const { callClaude, extractText, modelFor } = require('./claude');

async function probarModelo(model) {
  const t0 = Date.now();
  const r = await callClaude({
    model,
    messages: [{ role: 'user', content: 'Responde solo con la palabra OK.' }],
    maxTokens: 64,
    timeoutMs: 15000,
  });
  const texto = r.ok ? extractText(r.data) : '';
  return { model, ok: r.ok && texto.length > 0, status: r.status, error: r.error || (r.ok && !texto ? 'respuesta sin texto' : null), ms: Date.now() - t0 };
}

async function probarModelos() {
  const modelos = [...new Set([modelFor('free'), modelFor('pro')])];
  return Promise.all(modelos.map(probarModelo));
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

module.exports = { probarModelo, probarModelos, probarCompleto };
