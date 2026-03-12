import { useState, useEffect, useRef } from 'react'
import { getMessages, saveMessage } from '../lib/messages'
import { canSendMessage, incrementMessageCount } from '../lib/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { updateContext } from '../lib/context'

const DEPORTE_LABELS = {
  triatlon: '🏊 Triatlón',
  running: '🏃 Running',
  hyrox: '💪 Hyrox',
}

export default function Chat({ userId, profile, personalidad, onPersonalidadChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stravaData, setStravaData] = useState(null)
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
          system: buildSystemPrompt(profile, profile.personalidad || 'cercano', stravaData),
          messages: [
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          // model y max_tokens ya no vienen del frontend — están fijos en el backend
        }),
      })

      if (response.status === 429) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Has alcanzado el límite diario del plan Free. Actualiza a Pro para mensajes ilimitados.' }])
        return
      }

      const data = await response.json()
      const assistantMessage = data.content?.[0]?.text || 'Error al responder'

      // ── Incrementar contador solo si la llamada tuvo éxito ──
      await incrementMessageCount(userId, profile)
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
    if (!userId) return
    fetch('/.netlify/functions/strava-activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
      },
      body: JSON.stringify({ userId })
    })
      .then(r => r.json())
      .then(data => { if (!data.sinStrava) setStravaData(data) })
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const messagesHoy = profile?.messages_today || 0
  const esFree = profile?.plan === 'free'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      background: 'var(--background)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)' }}>
              {profile?.nombre || 'Atleta'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 1 }}>
              {DEPORTE_LABELS[profile?.deporte] || profile?.deporte || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onPersonalidadChange && (
              <select
                value={personalidad || 'cercano'}
                onChange={onPersonalidadChange}
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                  padding: '4px 8px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value="cercano">😊 Cercano</option>
                <option value="estricto">💪 Estricto</option>
                <option value="gracioso">😄 Gracioso</option>
                <option value="motivador">🔥 Motivador</option>
              </select>
            )}
            {esFree && (
              <span style={{ fontSize: 12, color: messagesHoy >= 8 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                {messagesHoy}/10
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <p style={{ fontSize: 15 }}>Cuéntame cómo va el entrenamiento</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <span style={{
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--secondary)',
                color: msg.role === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                display: 'inline-block',
                maxWidth: '80%',
                fontSize: 15,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </span>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <span style={{
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
                padding: '10px 14px',
                borderRadius: '18px 18px 18px 4px',
                fontSize: 14,
              }}>
                ···
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input
            style={{
              flex: 1,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              padding: '10px 16px',
              outline: 'none',
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Escribe un mensaje..."
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              background: loading ? 'var(--muted)' : 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 24,
              padding: '10px 20px',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
