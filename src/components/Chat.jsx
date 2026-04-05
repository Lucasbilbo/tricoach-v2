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

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/>
    <path d="M22 2L15 22 11 13 2 9l20-7z"/>
  </svg>
)

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const soportaVoz = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export default function Chat({ userId, profile, plan, planProximaSemana, historialPlanes, personalidad, onPersonalidadChange, onShowUpgrade, onPlanUpdate, prefillMessage }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stravaData, setStravaData] = useState(null)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustApplied, setAdjustApplied] = useState(false)
  const [adjustToast, setAdjustToast] = useState(null)
  const [escuchando, setEscuchando] = useState(false)
  const [shouldAutoSend, setShouldAutoSend] = useState(false)
  const [vozActiva, setVozActiva] = useState(() => localStorage.getItem('tricoach_voz_activa') !== 'false')
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const vozActivaRef = useRef(vozActiva)

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
      leerEnVoz(assistantMessage)

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
    })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    fetch('/.netlify/functions/strava-activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) setStravaData(data.sinStrava ? null : data)
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[Chat] strava-activities error:', err) })
    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (prefillMessage) setInput(prefillMessage)
  }, [prefillMessage])

  useEffect(() => {
    if (shouldAutoSend && input.trim() && !loading) {
      setShouldAutoSend(false)
      transcriptRef.current = ''
      sendMessage()
    }
  }, [shouldAutoSend, input])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])


  const messagesHoy = profile?.messages_today || 0
  const esFree = !profile?.plan || profile?.plan === 'free'
  const limitAlcanzado = esFree && messagesHoy >= 25
  const nombreCoach = profile?.nombre_coach || 'Coach'

  const remaining = esFree ? (25 - messagesHoy) : (150 - messagesHoy)
  const showCounter = !limitAlcanzado && (esFree ? remaining < 8 : remaining < 20)

  const lastAssistantIdx = messages.reduce((last, m, i) => m.role === 'assistant' ? i : last, -1)

  const coachInitial = (nombreCoach[0] || 'C').toUpperCase()

  function toggleVoz() {
    const next = !vozActiva
    setVozActiva(next)
    vozActivaRef.current = next
    localStorage.setItem('tricoach_voz_activa', next ? 'true' : 'false')
    if (!next) window.speechSynthesis?.cancel()
  }

  function leerEnVoz(texto) {
    if (!window.speechSynthesis || !vozActivaRef.current) return
    window.speechSynthesis.cancel()
    const textoLimpio = texto
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6} /g, '')
      .replace(/^- /gm, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!textoLimpio) return
    const utterance = new SpeechSynthesisUtterance(textoLimpio)
    utterance.lang = 'es-ES'
    utterance.rate = 1.1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  async function toggleMic() {
    if (!soportaVoz) return
    if (escuchando) {
      recognitionRef.current?.stop()
      setEscuchando(false)
      return
    }
    window.speechSynthesis?.cancel()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch (err) {
      console.error('[Voz] Permiso denegado:', err)
      alert('Necesitas permitir el acceso al micrófono en tu navegador')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onstart = () => {
      console.log('[Voz] Iniciando...')
    }
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      console.log('[Voz] Resultado:', transcript)
      transcriptRef.current = transcript
      setInput(transcript)
    }
    recognition.onerror = (event) => {
      console.error('[Voz] Error:', event.error)
      if (event.error === 'not-allowed') {
        alert('Necesitas permitir el acceso al micrófono en tu navegador')
      }
      setEscuchando(false)
      transcriptRef.current = ''
    }
    recognition.onend = () => {
      console.log('[Voz] Terminado')
      setEscuchando(false)
      if (transcriptRef.current.trim()) {
        setShouldAutoSend(true)
      }
    }
    recognitionRef.current = recognition
    transcriptRef.current = ''
    try {
      recognition.start()
      setEscuchando(true)
    } catch (e) {
      console.error('[Voz] Error al iniciar:', e)
    }
  }

  return (
    <div className="screen-enter" style={{
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
            {soportaVoz && (
              <button
                onClick={toggleVoz}
                title={vozActiva ? 'Silenciar respuestas' : 'Activar respuestas en voz'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '4px 6px',
                  borderRadius: 6,
                  opacity: vozActiva ? 1 : 0.35,
                  transition: 'opacity 0.2s',
                  flexShrink: 0,
                }}
              >
                {vozActiva ? '🔊' : '🔇'}
              </button>
            )}
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
              marginBottom: 16,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 8,
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  flexShrink: 0,
                  marginBottom: 2,
                }}>
                  {coachInitial}
                </div>
              )}
              <div style={{ maxWidth: '80%' }}>
                {msg.role === 'assistant' && (
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 3, marginLeft: 2, letterSpacing: '0.04em', opacity: 0.7 }}>
                    {nombreCoach}
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <span
                    style={{
                      background: 'var(--secondary)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      padding: '9px 13px',
                      borderRadius: '4px 16px 16px 16px',
                      display: 'inline-block',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <span style={{
                    background: 'rgba(255, 107, 43, 0.1)',
                    color: 'var(--foreground)',
                    border: '1px solid rgba(255, 107, 43, 0.18)',
                    padding: '9px 13px',
                    borderRadius: '16px 16px 4px 16px',
                    display: 'inline-block',
                    fontSize: 14,
                    lineHeight: 1.6,
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
        background: 'oklch(0.15 0.01 60 / 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: showCounter ? 'none' : '1px solid var(--border)',
        padding: '12px 16px',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {escuchando && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: 8,
              paddingLeft: 4,
            }}>
              <span style={{
                display: 'inline-block',
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'rgb(239,68,68)',
                animation: 'dotPulse 1s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13,
                color: 'rgb(239,68,68)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
              }}>
                Escuchando...
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {soportaVoz && (
              <button
                onClick={toggleMic}
                disabled={loading}
                title={escuchando ? 'Detener grabación' : 'Hablar con el coach'}
                style={{
                  width: 44, height: 44,
                  background: escuchando ? 'rgba(239,68,68,0.12)' : 'var(--secondary)',
                  border: escuchando ? '1px solid rgba(239,68,68,0.45)' : '1px solid var(--border)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  color: escuchando ? 'rgb(239,68,68)' : 'var(--muted-foreground)',
                  opacity: loading ? 0.4 : 1,
                  animation: escuchando ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                <MicIcon />
              </button>
            )}
            <input
              style={{
                flex: 1,
                background: escuchando ? 'rgba(239,68,68,0.04)' : 'var(--secondary)',
                border: escuchando ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
                borderRadius: 24,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                padding: '11px 18px',
                outline: 'none',
                opacity: loading ? 0.6 : 1,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && !escuchando && sendMessage()}
              placeholder={escuchando ? '🎙 Escuchando tu voz...' : 'Escribe un mensaje...'}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: 44, height: 44,
                background: loading || !input.trim() ? 'var(--secondary)' : 'var(--primary)',
                color: loading || !input.trim() ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
                border: loading || !input.trim() ? '1px solid var(--border)' : 'none',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                boxShadow: !loading && input.trim() ? '0 0 16px rgba(255,107,43,0.25)' : 'none',
              }}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
