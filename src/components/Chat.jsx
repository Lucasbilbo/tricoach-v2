import { useState, useEffect, useRef } from 'react'
import { getMessages, saveMessage } from '../lib/messages'
import { canSendMessage } from '../lib/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { updateContext } from '../lib/context'

const DEPORTE_LABELS = {
  triatlon: '🏊 Triatlón',
  running: '🏃 Running',
  hyrox: '💪 Hyrox',
}

export default function Chat({ userId, profile, personalidad, onPersonalidadChange, onShowUpgrade, prefillMessage }) {
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

      const systemPrompt = buildSystemPrompt(profile, profile.personalidad || 'cercano', stravaData)
      console.log('[Chat] System prompt (primeros 200 chars):', systemPrompt.substring(0, 200))

      const response = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
        },
        body: JSON.stringify({
          userId,
          system: systemPrompt,
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

      // El contador se incrementa en el backend (claude.js) antes de llamar a Claude
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
    console.log('[Chat] Llamando strava-activities para userId:', userId)
    fetch('/.netlify/functions/strava-activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
      },
      body: JSON.stringify({ userId })
    })
      .then(r => r.json())
      .then(data => {
        console.log('[Chat] Respuesta strava-activities:', {
          sinStrava: data.sinStrava,
          resumen: data.resumen,
          numActividades: data.actividades?.length ?? 0,
        })
        if (!data.sinStrava) setStravaData(data)
      })
      .catch(err => console.error('[Chat] Error strava-activities:', err))
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (prefillMessage) setInput(prefillMessage)
  }, [prefillMessage])

  const messagesHoy = profile?.messages_today || 0
  const esFree = !profile?.plan || profile?.plan === 'free'
  const limitAlcanzado = esFree && messagesHoy >= 10
  const nombreCoach = profile?.nombre_coach || 'Coach'

  const remaining = esFree ? (10 - messagesHoy) : (100 - messagesHoy)
  const showCounter = !limitAlcanzado && (esFree ? remaining < 5 : remaining < 20)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)',
      background: 'var(--background)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--background)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)' }}>
              {nombreCoach}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 1 }}>
              {DEPORTE_LABELS[profile?.deporte] || profile?.deporte || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {esFree && onShowUpgrade && (
              <button
                onClick={onShowUpgrade}
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  border: 'none',
                  borderRadius: 24,
                  padding: '5px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ✦ Hazte Pro
              </button>
            )}
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
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <p style={{ fontSize: 15 }}>Cuéntame cómo va el entrenamiento</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="message-enter" style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{ maxWidth: '80%' }}>
                {msg.role === 'assistant' && (
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 3, marginLeft: 4 }}>
                    {nombreCoach}
                  </div>
                )}
                <span style={{
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--secondary)',
                  color: msg.role === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  display: 'inline-block',
                  fontSize: 15,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </span>
              </div>
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

      {/* Upgrade banner when limit reached */}
      {limitAlcanzado && (
        <div style={{
          background: 'oklch(0.7 0.18 45 / 0.08)',
          borderTop: '1px solid oklch(0.7 0.18 45 / 0.35)',
          padding: '10px 16px',
          flexShrink: 0,
          textAlign: 'center',
        }}>
          <button
            onClick={onShowUpgrade}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 24,
              padding: '8px 20px',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🏆 Hazte Pro — mensajes ilimitados
          </button>
        </div>
      )}

      {/* Message counter */}
      {showCounter && (
        <div style={{
          textAlign: 'center',
          color: 'var(--muted-foreground)',
          fontSize: 12,
          padding: '6px 16px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {remaining} mensajes restantes hoy
        </div>
      )}

      {/* Input */}
      <div style={{
        background: 'var(--card)',
        borderTop: showCounter ? 'none' : '1px solid var(--border)',
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
