import { useState, useEffect } from 'react'
import { getRecentPlans, getHistorialPlanes, calcularConsistencia } from '../lib/plans'

function diasRestantes(fechaCarrera) {
  if (!fechaCarrera) return null
  const diff = new Date(fechaCarrera) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function calcularAdherencia(planes) {
  if (!planes || planes.length === 0) return null
  let conRpeSostenible = 0
  let totalCompletadas = 0
  for (const plan of planes) {
    for (const s of (plan.sesiones || [])) {
      if (s.completada && s.tipo?.toLowerCase() !== 'descanso') {
        totalCompletadas++
        const rpe = s.rpe ?? s.rpe_usuario
        if (rpe != null && rpe <= 7) conRpeSostenible++
      }
    }
  }
  if (totalCompletadas === 0) return null
  return Math.round((conRpeSostenible / totalCompletadas) * 100)
}

function calcularVolumen(planes) {
  if (!planes || planes.length < 2) return null
  const ultima = planes[0]?.sesiones?.filter(s => s.completada).reduce((acc, s) => acc + (s.duracion_min || 0), 0) || 0
  const anterior = planes[planes.length - 1]?.sesiones?.filter(s => s.completada).reduce((acc, s) => acc + (s.duracion_min || 0), 0) || 0
  if (anterior === 0) return null
  return Math.round(((ultima - anterior) / anterior) * 100)
}

function getMensajeCoach(consistencia) {
  if (consistencia === null) return null
  if (consistencia >= 80) return '¡Estás siendo muy consistente! Sigue así, la constancia es la clave.'
  if (consistencia >= 50) return 'Buen trabajo. Mantén el ritmo e intenta completar más sesiones esta semana.'
  return 'Esta semana intenta completar más sesiones. Pequeños pasos también cuentan.'
}

function BarraProgreso({ valor, label, sublabel }) {
  const pct = Math.min(100, Math.max(0, valor ?? 0))
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
          {valor !== null ? `${valor}%` : '–'}
        </span>
      </div>
      <div style={{
        height: 8,
        background: 'var(--secondary)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--primary), oklch(0.7 0.18 60))',
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
      {sublabel && (
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{sublabel}</p>
      )}
    </div>
  )
}

const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function GraficoSemana({ plan }) {
  if (!plan?.sesiones) return null

  const today = new Date()
  const todayDiaIdx = (today.getDay() + 6) % 7 // 0=Lun, 6=Dom

  const barras = DIAS_NOMBRE.map((dia, i) => {
    const sesion = plan.sesiones.find(s => s.dia === dia)
    if (!sesion || sesion.tipo?.toLowerCase() === 'descanso') return { label: DIAS_LABEL[i], pct: 0, isHoy: i === todayDiaIdx, completada: false }
    const pct = sesion.completada ? 100 : 20
    return { label: DIAS_LABEL[i], pct, isHoy: i === todayDiaIdx, completada: sesion.completada }
  })

  const maxH = 64 // max bar height in px

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 16px',
      marginBottom: 10,
    }}>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 16 }}>
        Esta semana
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: maxH + 24 }}>
        {barras.map((b, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', height: maxH, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${Math.max(b.pct > 0 ? Math.max(b.pct, 12) : 0, 0) * maxH / 100}px`,
                background: b.completada
                  ? `linear-gradient(180deg, #FF6B2B 0%, rgba(255,107,43,0.3) 100%)`
                  : b.isHoy && b.pct > 0
                    ? 'oklch(0.7 0.18 45 / 0.2)'
                    : b.pct > 0
                      ? 'var(--secondary)'
                      : 'transparent',
                borderRadius: '4px 4px 0 0',
                border: b.isHoy && !b.completada ? '1px solid rgba(255,107,43,0.4)' : 'none',
                minHeight: b.isHoy && b.pct > 0 ? 4 : 0,
                transition: 'height 0.5s ease',
                boxShadow: b.completada ? '0 -2px 8px rgba(255,107,43,0.25)' : 'none',
              }} />
            </div>
            <span style={{
              fontSize: 11,
              color: b.isHoy ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: b.isHoy ? 700 : 400,
              letterSpacing: '0.04em',
            }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ICONOS_STRAVA = {
  Run: '🏃', VirtualRun: '🏃', TrailRun: '🏃',
  Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚴',
  Swim: '🏊', OpenWaterSwim: '🏊',
  WeightTraining: '💪', Workout: '💪', Crossfit: '💪',
}

function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  const d = new Date(fechaStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const FASE_COLORS_PROGRESO = {
  base:  '#10B981',
  build: '#3B8BD4',
  peak:  '#FF6B2B',
  taper: '#8B5CF6',
}

function TimelineMacrociclo({ cycle }) {
  if (!cycle || !Array.isArray(cycle.fases) || cycle.fases.length === 0) return null

  const hoyStr = new Date().toISOString().split('T')[0]
  const semanaActual = Math.max(1, Math.round((new Date(hoyStr) - new Date(cycle.fecha_inicio)) / (7 * 24 * 60 * 60 * 1000)) + 1)

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 16px 12px',
      marginBottom: 12,
    }}>
      <p style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        color: 'var(--muted-foreground)',
        marginBottom: 12,
      }}>
        Macrociclo · Semana {semanaActual} de {cycle.semanas_totales}
      </p>

      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {cycle.fases.map((fase) => {
          const semsInFase = fase.sem_fin - fase.sem_inicio + 1
          const flexVal = semsInFase / cycle.semanas_totales
          const isActual = semanaActual >= fase.sem_inicio && semanaActual <= fase.sem_fin
          const isPasada = semanaActual > fase.sem_fin
          const color = FASE_COLORS_PROGRESO[fase.nombre] || '#374151'

          return (
            <div
              key={fase.nombre}
              style={{
                flex: flexVal,
                position: 'relative',
              }}
            >
              <div style={{
                background: color,
                opacity: isPasada ? 0.35 : 1,
                borderRadius: 6,
                padding: '8px 4px 7px',
                textAlign: 'center',
                border: isActual ? `2px solid ${color}` : '2px solid transparent',
                boxShadow: isActual ? `0 0 10px ${color}40` : 'none',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  lineHeight: 1.2,
                }}>
                  {fase.nombre}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.75)',
                  marginTop: 2,
                }}>
                  {semsInFase}s
                </div>
              </div>
              {isActual && (
                <div style={{
                  textAlign: 'center',
                  marginTop: 4,
                  fontSize: 9,
                  color: color,
                  fontWeight: 700,
                }}>
                  ← aquí
                </div>
              )}
            </div>
          )
        })}
      </div>

      {cycle.carrera_nombre && (
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right', marginTop: 2 }}>
          🏁 {cycle.carrera_nombre}
        </p>
      )}
    </div>
  )
}

export default function Progress({ userId, profile, activeCycle, plan: planActual, onNavigate }) {
  const [planes, setPlanes] = useState(null)       // past completed weeks (for stats)
  const [actividades, setActividades] = useState(null) // null=no cargado, []= vacío, [...]= datos
  const [loadingActividades, setLoadingActividades] = useState(false)

  useEffect(() => {
    if (!userId) return
    // Use past weeks only for consistency/adherence stats — current week is in progress
    getHistorialPlanes(userId, 4).then(setPlanes).catch(() => setPlanes([]))
  }, [userId])

  useEffect(() => {
    if (!userId || !profile?.strava_token) return
    setLoadingActividades(true)
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
        if (data.sinStrava || !data.actividades) {
          setActividades([])
        } else {
          setActividades(data.actividades)
        }
      })
      .catch(() => setActividades([]))
      .finally(() => setLoadingActividades(false))
  }, [userId, profile?.strava_token])

  // Carrera más próxima: array carreras[] con fecha futura, o fallback a fecha_carrera legacy
  const hoy = new Date()
  const carreraProxima = (() => {
    const arr = Array.isArray(profile?.carreras) ? profile.carreras : []
    const futuras = arr
      .filter(c => c.fecha && new Date(c.fecha + 'T12:00:00') > hoy)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    if (futuras.length > 0) return { fecha: futuras[0].fecha, nombre: futuras[0].nombre || futuras[0].tipo || null }
    if (profile?.fecha_carrera) return { fecha: profile.fecha_carrera, nombre: null }
    return null
  })()

  const dias = diasRestantes(carreraProxima?.fecha)
  const consistencia = planes ? calcularConsistencia(planes) : null
  const adherencia = planes ? calcularAdherencia(planes) : null
  const variacionVolumen = planes ? calcularVolumen(planes) : null
  const mensaje = getMensajeCoach(consistencia)
  const semanas = planes?.length || 0

  const vacio = !planActual && (!planes || planes.length === 0)

  return (
    <div className="screen-enter" style={{
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      background: 'var(--background)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--background)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px 12px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, marginBottom: 2 }}>
              Tu progreso
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {semanas > 0 ? `${semanas} semana${semanas > 1 ? 's' : ''} de datos` : 'Datos de entrenamiento'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>

        {/* Empty state */}
        {vacio && (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📅</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              Aún no tienes un plan
            </h3>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 15, lineHeight: 1.5, marginBottom: 24, maxWidth: 280, margin: '0 auto 24px' }}>
              Genera tu primer plan para empezar a ver tu progreso
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('plan')}
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  border: 'none',
                  borderRadius: 24,
                  padding: '12px 28px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Crear mi plan
              </button>
            )}
          </div>
        )}

        {/* Macrocycle timeline */}
        {activeCycle && <TimelineMacrociclo cycle={activeCycle} />}

        {/* Countdown */}
        {dias !== null && (
          <div style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255,107,43,0.08) 0%, transparent 65%), var(--card)',
            border: '1px solid rgba(255,107,43,0.2)',
            borderRadius: 16,
            padding: '28px 20px',
            marginBottom: 16,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, transparent, rgba(255,107,43,0.5) 50%, transparent)',
            }} />
            <p style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
              marginBottom: 8,
              fontWeight: 600,
            }}>
              Próxima carrera
            </p>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 72,
              fontWeight: 700,
              color: 'var(--primary)',
              lineHeight: 1,
              marginBottom: 8,
              textShadow: '0 0 40px rgba(255,107,43,0.25)',
            }}>
              {dias}
            </div>
            <p style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 600 }}>
              días
            </p>
            {carreraProxima?.fecha && (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.7 }}>
                {carreraProxima.nombre && <span>{carreraProxima.nombre} · </span>}
                {new Date(carreraProxima.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {vacio && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 32,
            textAlign: 'center',
            marginTop: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 8 }}>
              Empieza a entrenar
            </h3>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
              Completa tu primera semana para ver tu progreso
            </p>
          </div>
        )}

        {/* Metrics grid */}
        {!vacio && planes !== null && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 14px' }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 10, fontWeight: 600 }}>Consistencia</p>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 700, color: 'var(--primary)', lineHeight: 1, marginBottom: 6 }}>
                  {consistencia !== null ? `${consistencia}%` : '–'}
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>sesiones completadas</p>
              </div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 14px' }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 10, fontWeight: 600 }}>Adherencia</p>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 700, color: 'var(--primary)', lineHeight: 1, marginBottom: 6 }}>
                  {adherencia !== null ? `${adherencia}%` : '–'}
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>RPE sostenible</p>
              </div>
            </div>
            {variacionVolumen !== null && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 14px', marginBottom: 10 }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 8, fontWeight: 600 }}>Volumen vs semanas anteriores</p>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 700, color: variacionVolumen >= 0 ? 'var(--success)' : 'var(--destructive)', lineHeight: 1 }}>
                  {variacionVolumen >= 0 ? '+' : ''}{variacionVolumen}%
                </div>
              </div>
            )}
          </>
        )}

        {/* Weekly bar chart — uses current week plan prop (not historical) */}
        {planActual && <GraficoSemana plan={planActual} />}

        {/* Coach message */}
        {mensaje && (
          <div style={{
            background: 'oklch(0.7 0.18 45 / 0.08)',
            border: '1px solid oklch(0.7 0.18 45 / 0.3)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.5 }}>
              💬 <em>{mensaje}</em>
            </p>
          </div>
        )}

        {/* Mis actividades Strava */}
        {profile?.strava_token && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '18px 16px',
            marginTop: 6,
          }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 14 }}>
              Actividades Strava
            </p>

            {loadingActividades && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height: 52, background: 'var(--secondary)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}

            {!loadingActividades && actividades !== null && actividades.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                No hay actividades recientes en Strava
              </p>
            )}

            {!loadingActividades && actividades && actividades.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actividades.map((act, i) => {
                  const icon = ICONOS_STRAVA[act.tipo_deporte || act.tipo] || '🎾'
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'var(--secondary)',
                      borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {act.tipo_deporte || act.tipo}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 8 }}>
                            {formatFecha(act.fecha)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {act.distancia_km > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>
                              {act.distancia_km} km
                            </span>
                          )}
                          {act.duracion_min > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                              {act.duracion_min} min
                            </span>
                          )}
                          {act.fc_media && (
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                              ♥ {act.fc_media}
                            </span>
                          )}
                          {act.desnivel > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                              ↑ {act.desnivel}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
