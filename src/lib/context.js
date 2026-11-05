import { supabase } from './supabase'

export async function updateContext(userId, messages, currentContext) {
  if (messages.length < 4) return

  const lastMessages = messages.filter(m => !m.local).slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')

  const response = await fetch('/.netlify/functions/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      purpose: 'contexto', // el servidor fija el system, usa el modelo barato y no cuenta para el límite
      messages: [
        {
          role: 'user',
          content: `Analiza esta conversación de coaching deportivo y genera una FICHA TÉCNICA del atleta en máximo 150 palabras. Extrae SOLO información concreta y útil para un coach:

FORMATO OBLIGATORIO (omite secciones sin datos):
- LESIONES: [dolores, molestias, zona afectada, fecha]
- HITOS: [PRs, logros recientes, mejoras]
- MÉTRICAS: [FC máxima, umbrales, ritmos, vatios, peso si se menciona]
- LIMITACIONES: [días/horarios restringidos, equipamiento, contexto vital]
- ALERTAS: [sobreentrenamiento, fatiga acumulada, riesgos]

Contexto previo:
${currentContext || 'Sin contexto previo'}

Conversación reciente:
${lastMessages}

Genera la ficha técnica actualizada (máximo 150 palabras, sin paja):`
        }
      ]
    })
  })

  if (!response.ok) return
  const data = await response.json().catch(() => ({}))
  const nuevoContexto = data.text || data.content?.find?.(b => b.type === 'text')?.text
  if (!nuevoContexto) return

  const { error } = await supabase
    .from('profiles')
    .update({ contexto: nuevoContexto })
    .eq('id', userId)
  if (error) console.error('[context] Error guardando contexto:', error.message)
  return nuevoContexto
}