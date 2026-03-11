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
          content: `Basándote en esta conversación reciente con un atleta, genera un resumen breve (máximo 150 palabras) de lo más relevante que un coach debería recordar sobre este atleta: sus logros recientes, problemas mencionados, preferencias y cualquier dato importante.

Contexto previo que ya tenías:
${currentContext || 'Ninguno'}

Conversación reciente:
${lastMessages}

Genera el resumen actualizado:`
        }
      ],
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200
    })
  })

  const data = await response.json()
  const nuevoContexto = data.content?.[0]?.text
  if (!nuevoContexto) return

  await supabase
    .from('profiles')
    .update({ contexto: nuevoContexto })
    .eq('id', userId)
}