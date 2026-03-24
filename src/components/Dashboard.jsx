import { useState, useEffect, useRef } from 'react'
import { markSessionComplete } from '../lib/plans'

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
  return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

const RUTINA_MOVILIDAD = [
  { nombre: 'Movilidad de cadera', duracion: '2 min' },
  { nombre: 'Estiramiento isquiotibiales', duracion: '2 min' },
  { nombre: 'Foam roller piernas', duracion: '2 min' },
  { nombre: 'Respiración y relajación', duracion: '4 min' },
]

export default function Dashboard({ userId, plan, profile, loading, onPlanUpdate, onNavigate }) {
  const [completando, setCompletando] = useState(false)
  const [rpe, setRpe] = useState(6)
  const [showMovilidad, setShowMovilidad] = useState(false)
  const [syncToast, setSyncToast] = useState(null)
  const syncedRef = useRef(false)
  const [showPwaBanner, setShowPwaBanner] = useState(() => {
    const esMovil = /iPhone|iPad|Android/i.test(navigator.userAgent)
    const esStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
    const yaVisto = localStorage.getItem('pwa_banner_visto')
    return esMovil && !esStandalone && !yaVisto
  })

  useEffect(() => {
    if (!userId || !plan || !profile?.strava_token || syncedRef.current) return
    syncedRef.current = true

    fetch('/.netlify/functions/strava-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
      },
      body: JSON.stringify({ userId })
    })
      .then(r => r.json())
      .then(data => {
        if (data.sincronizadas > 0 && data.sesiones) {
          onPlanUpdate({ ...plan, sesiones: data.sesiones })
          setSyncToast(`✓ ${data.sincronizadas} sesión${data.sincronizadas > 1 ? 'es' : ''} sincronizada${data.sincronizadas > 1 ? 's' : ''} con Strava`)
          setTimeout(() => setSyncToast(null), 4000)
        }
      })
      .catch(() => {})
  }, [userId, plan, profile])

  const today = DIAS_SEMANA[new Date().getDay()]
  const sesionHoy = plan?.sesiones?.find(s => s.dia === today) || null
  const esDescanso = sesionHoy?.tipo?.toLowerCase() === 'descanso' || sesionHoy?.tipo?.toLowerCase() === 'rest'
  const esSesionTest = sesionHoy?.tipo_semana === 'diagnostico' && !esDescanso

  const todayIdx = DIAS_ORDEN.indexOf(today)
  const siguiente = plan?.sesiones?.find(s => {
    const idx = DIAS_ORDEN.indexOf(s.dia)
    return idx > todayIdx && s.tipo?.toLowerCase() !== 'descanso'
  }) || null

  async function handleCompletar() {
    if (!plan?.id || !sesionHoy) return
    try {
      const updated = await markSessionComplete(plan.id, sesionHoy.dia, rpe)
      onPlanUpdate(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setCompletando(false)
    }
  }

  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      background: 'var(--background)',
    }}>
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
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, marginBottom: 2 }}>
            {getSaludo(profile?.nombre)}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>
            {getFechaHoy()}
          </p>
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

        {/* Today's session */}
        {!loading && sesionHoy && (
          <>
            <div style={{
              background: 'var(--card)',
              border: sesionHoy.completada
                ? '1px solid oklch(0.7 0.14 180 / 0.35)'
                : '2px solid var(--primary)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              marginBottom: 16,
              minHeight: '55vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>
                {ICONOS[sesionHoy.tipo] || '🏋️'}
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
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 12,
                      letterSpacing: '0.05em',
                    }}>
                      📊 TEST
                    </div>
                  )}
                  <h2 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 28,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: sesionHoy.completada ? 'var(--success)' : 'var(--foreground)',
                  }}>
                    {sesionHoy.tipo}
                  </h2>
                  {sesionHoy.duracion_min > 0 && (
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 15, marginBottom: 4 }}>
                      {sesionHoy.duracion_min} min · {sesionHoy.intensidad}
                    </p>
                  )}
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5, marginBottom: esSesionTest ? 8 : 24, padding: '0 8px', maxWidth: 340 }}>
                    {sesionHoy.descripcion}
                  </p>
                  {esSesionTest && (
                    <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>¿Cómo fue el esfuerzo? (RPE 1-10)</p>
                    <select
                      value={rpe}
                      onChange={e => setRpe(Number(e.target.value))}
                      style={{
                        background: 'var(--input)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--foreground)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 16,
                        padding: '6px 12px',
                      }}
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleCompletar}
                        style={{
                          background: 'var(--success)',
                          color: 'oklch(0.13 0.01 60)',
                          border: 'none',
                          borderRadius: 24,
                          padding: '10px 24px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setCompletando(false)}
                        style={{
                          background: 'var(--secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 24,
                          color: 'var(--muted-foreground)',
                          padding: '10px 16px',
                          fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCompletando(true)}
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      border: 'none',
                      borderRadius: 24,
                      padding: '14px 32px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Completar sesión
                  </button>
                )
              )}
            </div>

            {/* TCX download button */}
            {!esDescanso && (
              <button
                onClick={() => generarTCX(sesionHoy)}
                style={{
                  width: '100%',
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 24,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '11px',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                ⬇ Descargar para el reloj (.TCX)
              </button>
            )}

            {/* Coach button */}
            <button
              onClick={() => onNavigate('coach')}
              style={{
                width: '100%',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: 24,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 500,
                padding: '12px',
                cursor: 'pointer',
              }}
            >
              💬 Hablar con el coach
            </button>
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
