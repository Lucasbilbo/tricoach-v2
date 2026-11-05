// Cliente único de la API de Claude para todas las functions (CommonJS).
//
// Por qué existe: hasta nov-2026 cada function tenía el modelo escrito a mano
// ('claude-sonnet-4-20250514'). Anthropic lo retiró el 15-jun-2026 y el coach
// dejó de responder durante casi 5 meses sin que nadie se enterara.
// Ahora el modelo se decide aquí, por plan del usuario, y se puede cambiar
// desde las variables de entorno de Netlify sin tocar código.
//
//   CLAUDE_MODEL_FREE  (por defecto claude-haiku-5-5)  — usuarios Free y tareas baratas
//   CLAUDE_MODEL_PRO   (por defecto claude-sonnet-5-5) — usuarios Pro
//
// Notas de los modelos 5.5 (guía de migración de Anthropic):
// - No aceptan temperature/top_p/top_k ni prefill de assistant al final.
// - Pueden empezar la respuesta con bloques `thinking`: leer bloques por tipo,
//   nunca content[0]. Usar siempre extractText().
// - Los tokens de razonamiento cuentan dentro de max_tokens.
// - Nuevos stop_reason: 'refusal' y 'model_context_window_exceeded'.

const https = require('https');

const DEFAULT_MODEL_FREE = 'claude-haiku-5-5';
const DEFAULT_MODEL_PRO = 'claude-sonnet-5-5';

function modelFor(plan) {
  if (plan === 'pro') return process.env.CLAUDE_MODEL_PRO || DEFAULT_MODEL_PRO;
  return process.env.CLAUDE_MODEL_FREE || DEFAULT_MODEL_FREE;
}

// Modelo barato para tareas internas (resúmenes, bienvenida, health-check)
function cheapModel() {
  return process.env.CLAUDE_MODEL_FREE || DEFAULT_MODEL_FREE;
}

// Concatena todos los bloques de texto de una respuesta (ignora thinking y tool_use)
function extractText(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter(b => b && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n')
    .trim();
}

// Construye el cuerpo de la petición. effort 'low' reduce razonamiento, latencia y coste.
function buildBody({ model, system, messages, maxTokens, tools, effort = 'low' }) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages,
    output_config: { effort },
  };
  if (system) body.system = system;
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  return body;
}

// Llama a la API. Nunca lanza: devuelve { ok, status, data, error }.
function callClaude({ apiKey, model, system, messages, maxTokens = 1024, tools, effort, timeoutMs = 25000 }) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return Promise.resolve({ ok: false, status: 500, data: null, error: 'ANTHROPIC_API_KEY no configurada' });

  const payload = JSON.stringify(buildBody({ model, system, messages, maxTokens, tools, effort }));

  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(raw); } catch { /* cuerpo no JSON */ }
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        const error = ok ? null : (data?.error?.message || `HTTP ${res.statusCode}`);
        if (!ok) {
          console.error(`[claude] ${model} respondió ${res.statusCode}: ${String(error).slice(0, 300)}`);
        } else if (data?.stop_reason === 'refusal') {
          console.error(`[claude] ${model} rechazó la petición (refusal)`);
        }
        done({ ok, status: res.statusCode, data, error });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      console.error(`[claude] ${model} timeout tras ${timeoutMs}ms`);
      done({ ok: false, status: 408, data: null, error: 'timeout' });
    });
    req.on('error', (e) => {
      console.error(`[claude] error de red: ${e.message}`);
      done({ ok: false, status: 502, data: null, error: e.message });
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { modelFor, cheapModel, extractText, buildBody, callClaude, DEFAULT_MODEL_FREE, DEFAULT_MODEL_PRO };
