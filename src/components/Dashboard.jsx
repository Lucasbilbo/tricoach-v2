import { useState } from 'react'
import { markSessionComplete, autoAdjustPlan } from '../lib/plans'
import { checkShouldAdjust } from '../lib/autoAdjust'
import CicloCompletadoBanner from './CicloCompletadoBanner'
import AdjustmentBanner from './AdjustmentBanner'

function generarTCX(sesion) {
  const ahora = new Date().toISOString()
  const duracionSeg = (sesion.duracion_min || 30) * 60
  const tipoTCX = sesion.tipo === 'Correr' ? 'Running' : sesion.tipo === 'Bici' ? 'Biking' : 'Other'
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Workouts>
    <Workout Sport="${tipoTCX}">
      <Name>${sesion.tipo} - ${sesion.dia}</Name>
      <Step xsi:type="Step_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <StepId>1</StepId>
        <Name>${sesion.descripcion || sesion.tipo}</Name>
        <Duration xsi:type="Time_t">
          <Seconds>${duracionSeg}</Seconds>
        </Duration>
        <Intensity>Active</Intensity>
        <Target xsi:type="None_t"/>
      </Step>
      <ScheduledOn>${ahora.split('T')[0]}</ScheduledOn>
      <Notes>${sesion.descripcion || ''} | Intensidad: ${sesion.intensidad || ''}</Notes>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`
  const blob = new Blob([xml], { type: 'application/tcx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tricoach_${sesion.tipo}_${sesion.dia}.tcx`
  a.click()
  URL.revokeObjectURL(url)
}

const ICONOS = {
  Correr: '🏃',
  Bici: '🚴',
  Nadar: '🏊',
  Fuerza: '💪',
  Brick: '🧱',
  Descanso: '😴',
}

const SPORT_COLORS = {
  Correr: '#FF6B2B',
  Nadar: '#0EA5E9',
  Bici: '#10B981',
  Fuerza: '#8B5CF6',
  Brick: '#FF8C42',
  Descanso: '#374151',
}

const DOT_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const MENSAJES_DESCANSO = [
  'El descanso es parte del entrenamiento. Recupérate bien.',
  'Hoy recuperas energía para los próximos retos.',
  'El cuerpo crece en el descanso. Aprovéchalo.',
]

function getSaludo(nombre) {
  const hora = new Date().getHours()
  let saludo
  if (hora < 13) saludo = 'Buenos días'
  else if (hora < 20) saludo = 'Buenas tardes'
  else saludo = 'Buenas noches'
  return nombre ? `${saludo}, ${nombre}` : saludo
}

function getFechaHoy() {
  const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const RUTINA_MOVILIDAD = [
  { nombre: 'Movilidad de cadera', duracion: '2 min' },
  { nombre: 'Estiramiento isquiotibiales', duracion: '2 min' },
  { nombre: 'Foam roller piernas', duracion: '2 min' },
  { nombre: 'Respiración y relajación', duracion: '4 min' },
]

const TIPO_SPORT_CARRERA = {
  Correr: ['5K', '10K', 'Media Maratón', 'Maratón', 'Trail', 'running'],
  Nadar: ['100m', '200m', '400m', '800m', '1500m', 'Aguas abiertas 1km', 'Aguas abiertas 3km', 'Aguas abiertas 5km', 'natacion'],
  Bici: ['Sprint', 'Olímpico', '70.3', 'Ironman', 'triatlon'],
  Brick: ['Sprint', 'Olímpico', '70.3', 'Ironman', 'triatlon'],
  Fuerza: ['Hyrox Individual', 'Hyrox Dobles', 'hyrox'],
}

function getCarreraBadge(sesion, profile) {
  if (!sesion || !sesion.tipo || sesion.tipo.toLowerCase() === 'descanso') return null
  const carrerasArr = Array.isArray(profile?.carreras) ? profile.carreras : []
  const hoy = new Date()
  const futuras = carrerasArr
    .filter(c => c.fecha && new Date(c.fecha) > hoy)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  if (futuras.length === 0) return null
  const tiposRelacionados = TIPO_SPORT_CARRERA[sesion.tipo] || []
  const carreraRelacionada = futuras.find(c =>
    tiposRelacionados.some(t => (c.tipo || '').toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes((c.tipo || '').toLowerCase()))
  ) || futuras[0]
  if (!carreraRelacionada) return null
  return carreraRelacionada.nombre || carreraRelacionada.tipo || null
}

const FASE_COLORS = {
  base: '#10B981',
  build: '#3B8BD4',
  peak: '#FF6B2B',
  taper: '#8B5CF6',
}

function SportIcon({ tipo, size = 18, color = 'currentColor' }) {
  const paths = {
    Correr: (
      <>
        <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/>
        <path d="M7.5 16.5 10 19l2-4 3 3 1.5-4"/>
        <path d="M5 10.5c1-1 2-1.5 3-1.5s2 .5 2.5 1.5L12 13l3-2.5c1-1 2.5-1 3.5 0"/>
      </>
    ),
    Nadar: (
      <>
        <path d="M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
        <path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
        <circle cx="15" cy="5" r="2"/>
        <path d="M15 7v3l3 2"/>
      </>
    ),
    Bici: (
      <>
        <circle cx="5" cy="17" r="3"/>
        <circle cx="19" cy="17" r="3"/>
        <path d="M9 17H5l2-7h5l3 4h2"/>
        <path d="M14 10h3l2 4"/>
      </>
    ),
    Fuerza: (
      <>
        <path d="M6.5 6.5h11"/>
        <path d="M4 9.5h16"/>
        <rect x="2" y="9.5" width="2" height="5" rx="1"/>
        <rect x="20" y="9.5" width="2" height="5" rx="1"/>
        <rect x="6" y="7" width="12" height="10" rx="1"/>
      </>
    ),
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[tipo] || <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>}
    </svg>
  )
}

export default function Dashboard({ userId, plan, profile, activeCycle, loading, onPlanUpdate, onNavigate, cicloCompletado, onRenovarCiclo, renovandoCiclo }) {
  const [completando, setCompletando] = useState(false)
  const [rpe, setRpe] = useState(6)
  const [showMovilidad, setShowMovilidad] = useState(false)
  const [syncToast, setSyncToast] = useState(null)
  const [stravaSyncLoading, setStravaSyncLoading] = useState(false)
  const [adjustBanner, setAdjustBanner] = useState(null) // { reason, mensaje }
  const [intervalsLoading, setIntervalsLoading] = useState(false)
  const [intervalsToast, setIntervalsToast] = useState(null)
  const [showPwaBanner, setShowPwaBanner] = useState(() => {
    const esMovil = /iPhone|iPad|Android/i.test(navigator.userAgent)
    const esStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
    const yaVisto = localStorage.getItem('pwa_banner_visto')
    return esMovil && !esStandalone && !yaVisto
  })

  const today = DIAS_SEMANA[new Date().getDay()]
  const sesionHoy = plan?.sesiones?.find(s => s.dia === today) || null
  const esDescanso = sesionHoy?.tipo?.toLowerCase() === 'descanso' || sesionHoy?.tipo?.toLowerCase() === 'rest'
  const esSesionTest = sesionHoy?.tipo_semana === 'diagnostico' && !esDescanso

  const todayIdx = DIAS_ORDEN.indexOf(today)
  const siguiente = plan?.sesiones?.find(s => {
    const idx = DIAS_ORDEN.indexOf(s.dia)
    return idx > todayIdx && s.tipo?.toLowerCase() !== 'descanso'
  }) || null

  async function handleStravaSync() {
    if (stravaSyncLoading) return
    setStravaSyncLoading(true)
    try {
      const r = await fetch('/.netlify/functions/strava-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || '',
        },
        body: JSON.stringify({ userId }),
      })
      const data = await r.json()
      if (data.sincronizadas > 0 && data.sesiones) {
        const updatedPlan = { ...plan, sesiones: data.sesiones }
        onPlanUpdate(updatedPlan)
        setSyncToast(`✓ ${data.sincronizadas} sesión${data.sincronizadas > 1 ? 'es' : ''} sincronizada${data.sincronizadas > 1 ? 's' : ''} con Strava`)
        // Comprobar si hay señales de sobrecarga tras la sincronización
        const { shouldAdjust, reason, signal } = checkShouldAdjust(updatedPlan, profile)
        if (shouldAdjust) {
          const result = await autoAdjustPlan(userId, plan.id, signal)
          if (result?.sesiones) {
            onPlanUpdate(result)
            setAdjustBanner({ reason, mensaje: result.mensaje || 'Plan ajustado según los datos de Strava.' })
          }
        }
      } else {
        setSyncToast('Todo al día ✓')
      }
      setTimeout(() => setSyncToast(null), 4000)
    } catch {
      setSyncToast('Error al sincronizar')
      setTimeout(() => setSyncToast(null), 3000)
    } finally {
      setStravaSyncLoading(false)
    }
  }

  async function handleEnviarIntervals(sesion) {
    if (intervalsLoading) return
    setIntervalsLoading(true)
    try {
      const r = await fetch('/.netlify/functions/intervals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || '',
        },
        body: JSON.stringify({
          userId,
          start_date_local: new Date().toISOString().slice(0, 19),
          category: 'WORKOUT',
          name: `${sesion.tipo} — TriCoach`,
          description: sesion.descripcion || '',
          moving_time: (sesion.duracion_min || 30) * 60,
          type: sesion.tipo === 'Correr' ? 'Run'
              : sesion.tipo === 'Bici' ? 'Ride'
              : sesion.tipo === 'Nadar' ? 'Swim'
              : sesion.tipo === 'Brick' ? 'Brick'
              : 'WeightTraining',
        }),
      })
      if (r.ok) {
        setIntervalsToast('✓ Enviado a Intervals')
      } else {
        setIntervalsToast('Error al enviar')
      }
      setTimeout(() => setIntervalsToast(null), 4000)
    } catch {
      setIntervalsToast('Error al enviar')
      setTimeout(() => setIntervalsToast(null), 3000)
    } finally {
      setIntervalsLoading(false)
    }
  }

  async function handleCompletar() {
    if (!plan?.id || !sesionHoy) return
    try {
      const updated = await markSessionComplete(plan.id, sesionHoy.dia, rpe)
      onPlanUpdate(updated)
      // Auto-adjust: evaluate on saved plan (includes the new RPE)
      const { shouldAdjust, reason, signal } = checkShouldAdjust(updated, profile)
      if (shouldAdjust) {
        const result = await autoAdjustPlan(userId, plan.id, signal)
        if (result?.sesiones) {
          onPlanUpdate(result)
          setAdjustBanner({ reason, mensaje: result.mensaje || 'Tu coach ha ajustado el plan para los próximos días.' })
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCompletando(false)
    }
  }

  const sportColor = SPORT_COLORS[sesionHoy?.tipo] || '#374151'

  return (
    <div className="screen-enter" style={{
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      background: 'var(--background)',
    }}>
      {/* Intervals toast */}
      {intervalsToast && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: intervalsToast.startsWith('Error') ? 'var(--destructive)' : 'oklch(0.45 0.2 140)',
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
          {intervalsToast}
        </div>
      )}

      {/* Strava sync toast */}
      {syncToast && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'oklch(0.45 0.2 140)',
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
          {syncToast}
        </div>
      )}

      {/* PWA install banner */}
      {showPwaBanner && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          background: '#FF6B2B',
          color: '#fff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
        }}>
          <span>📲 Instala TriCoach en tu móvil — pulsa <strong>⎙</strong> → <strong>Añadir a pantalla de inicio</strong></span>
          <button
            onClick={() => {
              localStorage.setItem('pwa_banner_visto', 'true')
              setShowPwaBanner(false)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
              flexShrink: 0,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

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
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, marginBottom: 2 }}>
              {getSaludo(profile?.nombre)}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {getFechaHoy()}
            </p>
          </div>
          {profile?.strava_token && (
            <button
              onClick={handleStravaSync}
              disabled={stravaSyncLoading}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 20,
                color: stravaSyncLoading ? 'var(--muted-foreground)' : '#fc4c02',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 12px',
                cursor: stravaSyncLoading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {stravaSyncLoading ? '⏳ Sincronizando...' : '🔄 Sincronizar Strava'}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>

        {/* Skeleton loader */}
        {loading && (
          <>
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              height: 200,
              marginBottom: 12,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              height: 48,
              marginBottom: 8,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              height: 48,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          </>
        )}

        {/* No plan */}
        {!loading && !plan && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 32,
            textAlign: 'center',
            marginTop: 32,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 8 }}>
              Sin plan esta semana
            </h3>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 24 }}>
              Genera tu plan personalizado para empezar
            </p>
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
              Generar mi plan
            </button>
          </div>
        )}

        {/* Completed cycle banner */}
        {!loading && cicloCompletado && (
          <CicloCompletadoBanner
            semanasTotales={activeCycle?.semanas_totales}
            onRenovar={onRenovarCiclo}
            renovando={renovandoCiclo}
          />
        )}

        {/* Auto-adjustment banner */}
        {adjustBanner && (
          <AdjustmentBanner
            reason={adjustBanner.reason}
            mensaje={adjustBanner.mensaje}
            onVerCambios={onNavigate ? () => onNavigate('plan') : undefined}
            onDismiss={() => setAdjustBanner(null)}
          />
        )}

        {/* Macrocycle bar */}
        {!loading && activeCycle && (() => {
          const semanaActual = Math.max(1, Math.round((new Date() - new Date(activeCycle.fecha_inicio)) / (7 * 24 * 60 * 60 * 1000)) + 1)
          const faseActual = activeCycle.fases?.find(f => semanaActual >= f.sem_inicio && semanaActual <= f.sem_fin) || activeCycle.fases?.[0]
          const esDescargaW = faseActual && faseActual.nombre !== 'taper' && semanaActual % 4 === 0
          const semanasRestantes = Math.max(0, activeCycle.semanas_totales - semanaActual)
          const pct = Math.min(100, Math.round((semanaActual / activeCycle.semanas_totales) * 100))
          const faseColor = FASE_COLORS[faseActual?.nombre] || 'var(--primary)'

          return (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  Semana {semanaActual} de {activeCycle.semanas_totales}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: faseColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Fase {faseActual?.nombre || '–'}
                </span>
              </div>
              <div style={{
                height: 6,
                background: 'var(--secondary)',
                borderRadius: 99,
                overflow: 'hidden',
                marginBottom: 8,
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: faseColor,
                  borderRadius: 99,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {activeCycle.carrera_nombre
                    ? `${semanasRestantes} semana${semanasRestantes !== 1 ? 's' : ''} para ${activeCycle.carrera_nombre}`
                    : 'Ciclo general'}
                </span>
                {esDescargaW && (
                  <span style={{
                    fontSize: 10,
                    background: 'rgba(249,115,22,0.15)',
                    color: '#f97316',
                    border: '1px solid rgba(249,115,22,0.3)',
                    borderRadius: 99,
                    padding: '2px 8px',
                    fontWeight: 600,
                  }}>
                    Semana de descarga
                  </span>
                )}
              </div>
            </div>
          )
        })()}

        {/* Today's session */}
        {!loading && sesionHoy && (
          <>
            <div style={{
              background: sesionHoy.completada
                ? `radial-gradient(ellipse at 70% 0%, oklch(0.7 0.14 180 / 0.05) 0%, transparent 60%), var(--card)`
                : `radial-gradient(ellipse at 70% 0%, ${sportColor}10 0%, transparent 60%), var(--card)`,
              border: sesionHoy.completada
                ? '1px solid oklch(0.7 0.14 180 / 0.2)'
                : `1px solid ${sportColor}22`,
              borderRadius: 16,
              padding: '28px 20px',
              marginBottom: 16,
              minHeight: '50vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Sport color accent line at top */}
              {!sesionHoy.completada && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 2,
                  background: `linear-gradient(90deg, ${sportColor}70, transparent)`,
                  borderRadius: '16px 16px 0 0',
                }} />
              )}
              <div style={{
                marginBottom: 20,
                lineHeight: 1,
                filter: `drop-shadow(0 8px 24px ${sportColor}55)`,
              }}>
                <SportIcon tipo={sesionHoy.tipo} size={96} color={sportColor} />
              </div>

              {esDescanso && (
                <>
                  <h2 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 28,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: 'var(--foreground)',
                  }}>
                    Hoy descansas
                  </h2>
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5, marginBottom: 24, padding: '0 8px', maxWidth: 340 }}>
                    El descanso es parte del entrenamiento
                  </p>
                  <button
                    onClick={() => setShowMovilidad(true)}
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 24,
                      color: 'var(--foreground)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      fontWeight: 500,
                      padding: '12px 24px',
                      cursor: 'pointer',
                    }}
                  >
                    Ver rutina de movilidad 10min
                  </button>
                </>
              )}

              {!esDescanso && (
                <>
                  {esSesionTest && (
                    <div style={{
                      background: `${sportColor}22`,
                      color: sportColor,
                      border: `1px solid ${sportColor}44`,
                      borderRadius: 99,
                      padding: '3px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 14,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}>
                      📊 Sesión Test
                    </div>
                  )}
                  {(() => {
                    const badge = getCarreraBadge(sesionHoy, profile)
                    if (!badge) return null
                    return (
                      <div style={{
                        background: 'var(--secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 99,
                        padding: '3px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        marginBottom: 14,
                        color: 'var(--muted-foreground)',
                        letterSpacing: '0.04em',
                      }}>
                        🎯 Para tu {badge}
                      </div>
                    )
                  })()}
                  <h2 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 36,
                    fontWeight: 700,
                    marginBottom: 12,
                    color: '#FFFFFF',
                    letterSpacing: '-0.5px',
                  }}>
                    {sesionHoy.tipo}
                  </h2>
                  {sesionHoy.duracion_min > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span style={{
                        background: 'var(--secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 99,
                        padding: '4px 12px',
                        fontSize: 13,
                        color: 'var(--foreground)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {sesionHoy.duracion_min} min
                      </span>
                      {sesionHoy.intensidad && (
                        <span style={{
                          background: `${sportColor}15`,
                          border: `1px solid ${sportColor}30`,
                          borderRadius: 99,
                          padding: '4px 12px',
                          fontSize: 13,
                          color: sportColor,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                          </svg>
                          {sesionHoy.intensidad}
                        </span>
                      )}
                    </div>
                  )}
                  <p style={{
                    color: 'var(--muted-foreground)',
                    fontSize: 14,
                    lineHeight: 1.75,
                    marginBottom: esSesionTest ? 8 : 24,
                    padding: '0 8px',
                    maxWidth: 320,
                  }}>
                    {sesionHoy.descripcion}
                  </p>
                  {esSesionTest && (
                    <p style={{ color: sportColor, fontSize: 13, fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>
                      Anota tu resultado para compartirlo con el coach
                    </p>
                  )}
                </>
              )}

              {sesionHoy.completada && (
                <div>
                  <div style={{ fontSize: 20, color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
                    ✓ Completada{sesionHoy.rpe ? ` · RPE ${sesionHoy.rpe}` : ''}
                  </div>
                  {siguiente && (
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                      Próxima: {ICONOS[siguiente.tipo] || ''} {siguiente.tipo} ({siguiente.duracion_min} min)
                    </p>
                  )}
                </div>
              )}

              {!sesionHoy.completada && !esDescanso && (
                completando ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', width: '100%', maxWidth: 320 }}>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', letterSpacing: '0.02em' }}>
                      Esfuerzo percibido (RPE)
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button
                          key={n}
                          onClick={() => setRpe(n)}
                          style={{
                            width: 38, height: 38,
                            borderRadius: '50%',
                            background: rpe === n ? sportColor : 'var(--secondary)',
                            border: rpe === n ? 'none' : '1px solid var(--border)',
                            color: rpe === n ? '#fff' : 'var(--muted-foreground)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                          }}
                        >{n}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <button
                        onClick={handleCompletar}
                        style={{
                          flex: 1,
                          background: 'var(--success)',
                          color: 'oklch(0.13 0.01 60)',
                          border: 'none',
                          borderRadius: 99,
                          padding: '13px 24px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Guardar
                      </button>
                      <button
                        onClick={() => setCompletando(false)}
                        style={{
                          background: 'var(--secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 99,
                          color: 'var(--muted-foreground)',
                          padding: '13px 18px',
                          fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCompletando(true)}
                    style={{
                      background: sportColor,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 99,
                      padding: '14px 0',
                      width: '100%',
                      maxWidth: 300,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '0.01em',
                      boxShadow: `0 0 24px ${sportColor}38`,
                      transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '0.9'
                      e.currentTarget.style.boxShadow = `0 0 32px ${sportColor}55`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.boxShadow = `0 0 24px ${sportColor}38`
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Completar sesión
                    </span>
                  </button>
                )
              )}
            </div>

            {/* 7-dot week tracker */}
            {plan.sesiones && (() => {
              const sesionesActivas = DIAS_ORDEN.filter(d => {
                const s = plan.sesiones.find(x => x.dia === d)
                return s && s.tipo?.toLowerCase() !== 'descanso' && s.tipo?.toLowerCase() !== 'rest'
              })
              const completadas = sesionesActivas.filter(d => {
                const s = plan.sesiones.find(x => x.dia === d)
                return s?.completada
              }).length
              return (
                <div style={{ marginBottom: 16, padding: '16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                      Esta semana
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: completadas === sesionesActivas.length && sesionesActivas.length > 0 ? 'var(--success)' : 'var(--foreground)' }}>
                      {completadas} / {sesionesActivas.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                    {DIAS_ORDEN.map((dia, i) => {
                      const sesion = plan.sesiones.find(s => s.dia === dia)
                      const isHoy = dia === today
                      const isDescanso = !sesion || sesion.tipo?.toLowerCase() === 'descanso' || sesion.tipo?.toLowerCase() === 'rest'
                      const color = SPORT_COLORS[sesion?.tipo] || '#374151'
                      return (
                        <div key={dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div
                            className={isHoy && !sesion?.completada && !isDescanso ? 'dot-pulse' : ''}
                            style={{
                              width: isDescanso ? 8 : 14,
                              height: isDescanso ? 8 : 14,
                              borderRadius: '50%',
                              background: sesion?.completada
                                ? color
                                : isHoy && !isDescanso
                                  ? 'transparent'
                                  : isDescanso
                                    ? 'var(--secondary)'
                                    : 'var(--secondary)',
                              border: isHoy && !isDescanso && !sesion?.completada
                                ? `2px solid ${color}`
                                : sesion?.completada
                                  ? 'none'
                                  : '1px solid var(--border)',
                              transition: 'all 0.3s ease',
                              marginTop: isDescanso ? 3 : 0,
                              boxShadow: sesion?.completada ? `0 0 8px ${color}66` : 'none',
                            }}
                          />
                          <span style={{
                            fontSize: 10,
                            color: isHoy ? 'var(--primary)' : 'var(--muted-foreground)',
                            fontWeight: isHoy ? 700 : 400,
                            letterSpacing: '0.04em',
                          }}>
                            {DOT_LABELS[i]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* TCX download button */}
            {!esDescanso && (
              <button
                onClick={() => generarTCX(sesionHoy)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 99,
                  color: 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '11px',
                  cursor: 'pointer',
                  marginBottom: 8,
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.32 0.02 60)'; e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                ⬇ Descargar para el reloj (.TCX)
              </button>
            )}

            {/* Enviar a Intervals */}
            {!esDescanso && profile?.intervals_athlete_id && (
              <button
                onClick={() => handleEnviarIntervals(sesionHoy)}
                disabled={intervalsLoading}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 99,
                  color: intervalsLoading ? 'var(--muted-foreground)' : 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '11px',
                  cursor: intervalsLoading ? 'not-allowed' : 'pointer',
                  marginBottom: 8,
                  transition: 'border-color 0.2s, color 0.2s',
                  opacity: intervalsLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!intervalsLoading) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--foreground)' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--foreground)' }}
              >
                {intervalsLoading ? '⏳ Enviando...' : '⌚ Enviar a Intervals'}
              </button>
            )}

            {/* Quick action cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <button
                onClick={() => onNavigate('coach')}
                style={{
                  background: 'rgba(255,107,43,0.1)',
                  border: '1px solid rgba(255,107,43,0.2)',
                  borderRadius: 12,
                  padding: '16px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Coach</span>
              </button>
              <button
                onClick={() => onNavigate('plan')}
                style={{
                  background: 'rgba(14,165,233,0.1)',
                  border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: 12,
                  padding: '16px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Plan</span>
              </button>
              <button
                onClick={() => onNavigate('plan')}
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 12,
                  padding: '16px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Ajustar</span>
              </button>
            </div>
          </>
        )}

        {/* Plan exists but no session for today */}
        {!loading && plan && !sesionHoy && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 24,
            textAlign: 'center',
            marginTop: 32,
          }}>
            <p style={{ color: 'var(--muted-foreground)' }}>No hay sesión para hoy en tu plan.</p>
          </div>
        )}

      </div>

      {/* Mobility modal */}
      {showMovilidad && (
        <div
          onClick={() => setShowMovilidad(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0 0 0 / 0.6)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: '16px 16px 0 0',
              padding: '24px 20px 0',
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>
                Rutina de movilidad
              </h3>
              <button
                onClick={() => setShowMovilidad(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: 20, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
              {RUTINA_MOVILIDAD.map((ejercicio, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 16px',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{i + 1}. {ejercicio.nombre}</span>
                  <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{ejercicio.duracion}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
