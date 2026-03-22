import { useState, useEffect, useRef } from 'react'
import { getMessages, saveMessage } from '../lib/messages'
import { canSendMessage } from '../lib/profiles'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'
import { updateContext } from '../lib/context'
import { adjustPlan } from '../lib/plans'

const AJUSTE_RE = /actualiz|cambiar|modificar|ajustar/i

function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Listas: líneas que empiezan con "- "
  html = html.replace(/((?:^|\n)- .+)+/g, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^- /, '')}</li>`
    ).join('')
    return `<ul style="margin:6px 0;padding-left:18px">${items}</ul>`
  })

  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')

  return html
}

const DEPORTE_LABELS = {
  triatlon: '🏊 Triatlón',
  running: '🏃 Running',
  hyrox: '💪 Hyrox',
}

export default function Chat({ userId, profile, plan, planProximaSemana, historialPlanes, personalidad, onPersonalidadChange, onShowUpgrade, onPlanUpdate, prefillMessage }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stravaData, setStravaData] = useState(null)
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustApplied, setAdjustApplied] = useState(false)
  const [adjustToast, setAdjustToast] = useState(null)
  const bottomRef = useRef(null)

  function showAdjustToast(msg, type) {
    setAdjustToast({ msg, type })
    setTimeout(() => setAdjustToast(null), 3500)
  }

  async function handleApplyAdjust() {
    if (!plan?.id || adjustLoading) return
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return

    setAdjustLoading(true)
    try {
      const planActualizado = await adjustPlan(userId, plan.id, 'libre', lastAssistant.content.slice(0, 200))
      if (planActualizado?.sesiones) {
        onPlanUpdate?.(planActualizado)
        setAdjustApplied(true)
        showAdjustToast('✅ Plan actualizado', 'success')
      } else {
        showAdjustToast('No se pudo actualizar el plan. Inténtalo de nuevo.', 'error')
      }
    } catch {
      showAdjustToast('Error al actualizar el plan. Inténtalo de nuevo.', 'error')
    } finally {
      setAdjustLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim()) return

    const userMessage = input

    const canSend = await canSendMessage(profile)
    if (!canSend) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Has alcanzado el límite de 25 mensajes diarios del plan Free. Actualiza a Pro para mensajes ilimitados.' }])
      return
    }

    setInput('')
    setLoading(true)
    setAdjustApplied(false)

    try {
      await saveMessage(userId, 'user', userMessage)
      const updatedMessages = [...messages, { role: 'user', content: userMessage }]
      setMessages(updatedMessages)

      const systemPrompt = buildSystemPrompt(profile, profile.personalidad || 'cercano', stravaData, plan, planProximaSemana, historialPlanes || [])
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
        }),
      })

      if (response.status === 429) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ Has alcanzado el límite diario del plan Free. Actualiza a Pro para mensajes ilimitados.' }])
        return
      }

      const data = await response.json()
      const assistantMessage = data.content?.[0]?.text || 'Error al responder'

      await saveMessage(userId, 'assistant', assistantMessage)

      const finalMessages = [...updatedMessages, { role: 'assistant', content: assistantMessage }]
      setMessages(finalMessages)

      updateContext(userId, finalMessages, profile.contexto).catch(() => {})

    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Hubo un error al conectar con el coach. Inténtalo de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getMessages(userId).then(msgs => {
      setMessages(msgs)
      setMessagesLoaded(true)
    })
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
        if (!data.error) setStravaData(data.sinStrava ? null : data)
      })
      .catch(err => console.error('[Chat] Error strava-activities:', err))
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (prefillMessage) setInput(prefillMessage)
  }, [prefillMessage])

  useEffect(() => {
    if (!messagesLoaded || !plan || !profile) return
    const key = `welcome_${userId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const diaSemana = DIAS[new Date().getDay()]
    const sesionHoy = plan.sesiones?.find(s => s.dia === diaSemana && s.tipo?.toLowerCase() !== 'descanso' && !s.completada)
    const completadasRecientes = plan.sesiones?.filter(s => s.completada) || []
    const nombre = profile.nombre || 'atleta'

    let welcomeText = null
    if (completadasRecientes.length > 0) {
      const ultima = completadasRecientes[completadasRecientes.length - 1]
      const resto = sesionHoy ? ` Hoy tienes ${sesionHoy.tipo.toLowerCase()} — ¿listo?` : ' ¿Cómo te encuentras?'
      welcomeText = `¡Hola ${nombre}! Vi que completaste el ${ultima.tipo.toLowerCase()} del ${ultima.dia.toLowerCase()}.${resto}`
    } else if (sesionHoy) {
      welcomeText = `¡Hola ${nombre}! Hoy tienes ${sesionHoy.tipo.toLowerCase()} en tu plan. ¿Ya tienes todo preparado?`
    } else {
      const pendientes = plan.sesiones?.filter(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso') || []
      if (pendientes.length > 0) {
        welcomeText = `¡Hola ${nombre}! Esta semana tienes ${pendientes.length} sesión${pendientes.length > 1 ? 'es' : ''} pendiente${pendientes.length > 1 ? 's' : ''}. ¿Cómo lo llevas?`
      }
    }

    if (welcomeText) {
      saveMessage(userId, 'assistant', welcomeText).then(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: welcomeText }])
      }).catch(() => {})
    }
  }, [messagesLoaded, plan?.id, userId])

  const messagesHoy = profile?.messages_today || 0
  const esFree = !profile?.plan || profile?.plan === 'free'
  const limitAlcanzado = esFree && messagesHoy >= 25
  const nombreCoach = profile?.nombre_coach || 'Coach'

  const remaining = esFree ? (25 - messagesHoy) : (150 - messagesHoy)
  const showCounter = !limitAlcanzado && (esFree ? remaining < 8 : remaining < 20)

  const lastAssistantIdx = messages.reduce((last, m, i) => m.role === 'assistant' ? i : last, -1)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)',
      background: 'var(--background)',
    }}>
      {/* Adjust toast */}
      {adjustToast && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: adjustToast.type === 'success' ? 'oklch(0.45 0.2 140)' : 'var(--destructive)',
          color: '#fff',
          borderRadius: 'var(--radius)',
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
          zIndex: 200,
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 4px 20px oklch(0 0 0 / 0.3)',
          whiteSpace: 'nowrap',
        }}>
          {adjustToast.msg}
        </div>
      )}

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
                <option value="cientifico">🔬 Científico</option>
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
                {msg.role === 'assistant' ? (
                  <span
                    style={{
                      background: 'var(--secondary)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      padding: '10px 14px',
                      borderRadius: '18px 18px 18px 4px',
                      display: 'inline-block',
                      fontSize: 15,
                      lineHeight: 1.5,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <span style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: '18px 18px 4px 18px',
                    display: 'inline-block',
                    fontSize: 15,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </span>
                )}
                {/* Botón aplicar cambio al plan */}
                {plan?.id
                  && i === lastAssistantIdx
                  && msg.role === 'assistant'
                  && !adjustApplied
                  && !loading
                  && AJUSTE_RE.test(msg.content)
                  && (
                  <div style={{ marginTop: 8, marginLeft: 4 }}>
                    <button
                      onClick={handleApplyAdjust}
                      disabled={adjustLoading}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--primary)',
                        borderRadius: 20,
                        color: 'var(--primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 14px',
                        cursor: adjustLoading ? 'not-allowed' : 'pointer',
                        opacity: adjustLoading ? 0.7 : 1,
                      }}
                    >
                      {adjustLoading ? '⏳ Aplicando...' : '🔄 Aplicar cambio al plan'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 3, marginLeft: 4 }}>
                  {nombreCoach}
                </div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
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
              opacity: loading ? 0.6 : 1,
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
            placeholder="Escribe un mensaje..."
            disabled={loading}
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
