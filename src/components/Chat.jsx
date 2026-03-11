import { useState, useEffect, useRef } from 'react'
import { getMessages, saveMessage } from '../lib/messages'
import { canSendMessage, incrementMessageCount } from '../lib/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { updateContext } from '../lib/context'

export default function Chat({ userId, profile }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  async function sendMessage() {
    if (!input.trim()) return

    const canSend = await canSendMessage(profile)
    if (!canSend) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Has alcanzado el límite de 10 mensajes diarios del plan Free. Actualiza a Pro para mensajes ilimitados.' }])
      return
    }

    const userMessage = input
    setInput('')
    setLoading(true)

    try {
      await saveMessage(userId, 'user', userMessage)
      await incrementMessageCount(userId, profile)
      const updatedMessages = [...messages, { role: 'user', content: userMessage }]
      setMessages(updatedMessages)

      const response = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
        },
        body: JSON.stringify({
          userId,
          system: buildSystemPrompt(profile, profile.personalidad || 'cercano'),
          messages: [
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000
        }),
      })

      const data = await response.json()

      if (response.status === 429) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Has alcanzado el límite diario del plan Free. Actualiza a Pro para mensajes ilimitados.' }])
        return
      }

      const assistantMessage = data.content?.[0]?.text || 'Error al responder'
      await saveMessage(userId, 'assistant', assistantMessage)
      const finalMessages = [...updatedMessages, { role: 'assistant', content: assistantMessage }]
      setMessages(finalMessages)

      // Actualizar contexto en segundo plano, sin bloquear el chat
      updateContext(userId, finalMessages, profile.contexto).catch(() => {})

    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Hubo un error al conectar con el coach. Inténtalo de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getMessages(userId).then(setMessages)
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <div style={{ height: 400, overflowY: 'auto', border: '1px solid #ccc', padding: 16, marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <span style={{
              background: msg.role === 'user' ? '#0070f3' : '#f0f0f0',
              color: msg.role === 'user' ? 'white' : 'black',
              padding: '8px 12px',
              borderRadius: 12,
              display: 'inline-block',
              maxWidth: '80%'
            }}>
              {msg.content}
            </span>
          </div>
        ))}
        {loading && <p style={{ color: '#999' }}>El coach está escribiendo...</p>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Escribe un mensaje..."
        />
        <button onClick={sendMessage} disabled={loading}>
          Enviar
        </button>
      </div>
    </div>
  )
}