import { supabase } from './supabase'

export async function updateContext(userId, messages, currentContext) {
  if (messages.length < 4) return

  const lastMessages = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')

  const response = await fetch('/.netlify/functions/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
    },
    body: JSON.stringify({
      system: 'Eres un asistente que resume conversaciones de coaching deportivo. Responde SOLO con el resumen, sin explicaciones ni saludos.',
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
      ],
      max_tokens: 200
    })
  })

  const data = await response.json()
  const nuevoContexto = data.content?.[0]?.text
  if (!nuevoContexto) return

  const { error } = await supabase
    .from('profiles')
    .update({ contexto: nuevoContexto })
    .eq('id', userId)
  if (error) console.error('[context] Error guardando contexto:', error.message)
  return nuevoContexto
}