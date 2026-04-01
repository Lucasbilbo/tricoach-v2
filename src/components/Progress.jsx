import { useState, useEffect } from 'react'
import { getRecentPlans, calcularConsistencia } from '../lib/plans'

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
      borderRadius: 'var(--radius)',
      padding: '16px',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>
        Esta semana
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: maxH + 20 }}>
        {barras.map((b, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: maxH, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${Math.max(b.pct, 0) * maxH / 100}px`,
                background: b.pct > 20
                  ? 'linear-gradient(180deg, var(--primary) 0%, transparent 100%)'
                  : b.pct > 0
                    ? 'var(--secondary)'
                    : 'transparent',
                borderRadius: '3px 3px 0 0',
                border: b.isHoy ? '1px solid var(--primary)' : 'none',
                minHeight: b.isHoy ? 3 : 0,
                transition: 'height 0.4s ease',
              }} />
            </div>
            <span style={{
              fontSize: 11,
              color: b.isHoy ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: b.isHoy ? 700 : 400,
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

export default function Progress({ userId, profile, onNavigate }) {
  const [planes, setPlanes] = useState(null)
  const [actividades, setActividades] = useState(null) // null=no cargado, []= vacío, [...]= datos
  const [loadingActividades, setLoadingActividades] = useState(false)

  useEffect(() => {
    if (!userId) return
    getRecentPlans(userId, 4).then(setPlanes).catch(() => setPlanes([]))
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

  const dias = diasRestantes(profile?.fecha_carrera)
  const consistencia = planes ? calcularConsistencia(planes) : null
  const adherencia = planes ? calcularAdherencia(planes) : null
  const variacionVolumen = planes ? calcularVolumen(planes) : null
  const mensaje = getMensajeCoach(consistencia)
  const semanas = planes?.length || 0

  const vacio = planes !== null && semanas === 0

  return (
    <div style={{
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

        {/* Countdown */}
        {dias !== null && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 2 }}>Cuenta atrás a la carrera</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {profile?.fecha_carrera
                  ? new Date(profile.fecha_carrera + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                  : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>
                {dias}
              </span>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>días</p>
            </div>
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

        {/* Metrics */}
        {!vacio && planes !== null && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 16px',
            marginBottom: 16,
          }}>
            <BarraProgreso
              valor={consistencia}
              label="Consistencia"
              sublabel="Sesiones completadas en las últimas semanas"
            />
            <BarraProgreso
              valor={adherencia}
              label="Adherencia al esfuerzo"
              sublabel="Sesiones completadas con RPE ≤ 7 (esfuerzo sostenible)"
            />
            {variacionVolumen !== null && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Volumen vs hace {semanas > 1 ? semanas : ''} semanas</span>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: variacionVolumen >= 0 ? 'var(--success)' : 'var(--destructive)',
                  }}>
                    {variacionVolumen >= 0 ? '+' : ''}{variacionVolumen}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly bar chart */}
        {!vacio && planes !== null && <GraficoSemana plan={planes[0]} />}

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
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>
              Mis actividades
            </p>

            {loadingActividades && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Cargando actividades...</p>
            )}

            {!loadingActividades && actividades !== null && actividades.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                No hay actividades recientes en Strava
              </p>
            )}

            {!loadingActividades && actividades && actividades.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actividades.map((act, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>
                      {ICONOS_STRAVA[act.tipo_deporte || act.tipo] || '🎾'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.tipo_deporte || act.tipo}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 8 }}>
                          {formatFecha(act.fecha)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {act.distancia_km > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
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
                            ♥ {act.fc_media} bpm
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
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
