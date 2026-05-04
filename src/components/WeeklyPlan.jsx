import { useState, useEffect } from 'react'
import { generatePlan, getPlanForWeek, getNextWeekStart, adjustPlan, autoAdjustPlan, analizarPlan } from '../lib/plans'
import { checkShouldAdjust } from '../lib/autoAdjust'
import ModalCompletarSesion from './ModalCompletarSesion'
import AdjustmentBanner from './AdjustmentBanner'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function fechaSeleccionadaToISO(dia, mes, anio) {
  const mesIdx = MESES.indexOf(mes) + 1
  return `${anio}-${String(mesIdx).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
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

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIA_OFFSET_MAP = { Lunes: 0, Martes: 1, 'Miércoles': 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 }

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

export default function WeeklyPlan({ userId, profile, plan, onPlanUpdate, onSessionDetail, onNavigate, onPlanProximaSemanaUpdate, planActualizadoPorCoach, planProximaSemana }) {
  const _todayDate = new Date()
  const [generando, setGenerando] = useState(false)
  const [viendoProxima, setViendoProxima] = useState(false)
  const [planSiguiente, setPlanSiguiente] = useState(null)
  const [planSiguienteNoExiste, setPlanSiguienteNoExiste] = useState(false)
  const [loadingProxima, setLoadingProxima] = useState(false)
  const [generandoSiguiente, setGenerandoSiguiente] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [showCoachBadge, setShowCoachBadge] = useState(false)
  const [completando, setCompletando] = useState(null)
  const [rpe, setRpe] = useState(5)
  const [sesionParaCompletar, setSesionParaCompletar] = useState(null)
  const [ajustando, setAjustando] = useState(false)
  const [ajusteBanner, setAjusteBanner] = useState(null) // { reason, mensaje }
  const [diaInicio, setDiaInicio] = useState(String(_todayDate.getDate()))
  const [mesInicio, setMesInicio] = useState(MESES[_todayDate.getMonth()])
  const [anioInicio, setAnioInicio] = useState(String(_todayDate.getFullYear()))
  const [coachIntro, setCoachIntro] = useState(null)
  const [expandedDias, setExpandedDias] = useState(new Set())
  const [showContextModal, setShowContextModal] = useState(false)
  const [contextoSemana, setContextoSemana] = useState('')
  const [pendingFechaInicio, setPendingFechaInicio] = useState(null)

  function toggleDesc(dia) {
    setExpandedDias(prev => {
      const next = new Set(prev)
      next.has(dia) ? next.delete(dia) : next.add(dia)
      return next
    })
  }

  useEffect(() => {
    if (!errorToast) return
    const t = setTimeout(() => setErrorToast(null), 3000)
    return () => clearTimeout(t)
  }, [errorToast])

  useEffect(() => {
    if (!planActualizadoPorCoach) return
    setShowCoachBadge(true)
    const t = setTimeout(() => setShowCoachBadge(false), 5 * 60 * 1000)
    return () => clearTimeout(t)
  }, [planActualizadoPorCoach])

  useEffect(() => {
    if (!planProximaSemana) return
    setPlanSiguiente(planProximaSemana)
    setPlanSiguienteNoExiste(false)
  }, [planProximaSemana])

  useEffect(() => {
    if (!plan) return
    if (!plan.sesiones || plan.sesiones.length === 0) return
    const todasCompletadas = plan.sesiones.every(s => s.completada)
    if (!todasCompletadas) return
    if (planSiguiente) return
    handleGenerarSiguiente()
  }, [plan, planSiguiente])

  const today = DIAS_SEMANA[new Date().getDay()]
  const todayStr = getTodayStr()
  const planEndStr = plan ? (() => {
    const d = new Date(plan.semana + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })() : null
  const esSemanaPasada = !viendoProxima && plan && planEndStr < todayStr
  const esPlanFuturo = !viendoProxima && plan && plan.semana > todayStr

  const hayPendientes = plan?.sesiones?.some(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso')

  async function fetchCoachIntro(nuevoPlan) {
    if (!profile) return
    try {
      const esDiagnostico = nuevoPlan?.sesiones?.[0]?.tipo_semana === 'diagnostico'
      const sesionesTest = esDiagnostico
        ? nuevoPlan.sesiones
            .filter(s => s.tipo !== 'Descanso')
            .map(s => ({ dia: s.dia, tipo: s.tipo, descripcion: s.descripcion }))
        : []
      const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
      const res = await fetch('/.netlify/functions/coach-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tricoach-secret': secret },
        body: JSON.stringify({
          userId,
          perfil: {
            nombre: profile.nombre,
            deporte: profile.deporte,
            nivel: profile.nivel,
            objetivo: profile.objetivo,
            carreras: profile.carreras,
            historial: profile.historial,
          },
          tieneDatos: !esDiagnostico,
          actividadesResumen: null,
          esDiagnostico,
          sesionesTest,
        })
      })
      const data = await res.json()
      if (data.mensaje) {
        setCoachIntro({ mensaje: data.mensaje, nombreCoach: profile.nombre_coach || 'Coach' })
      }
    } catch (e) {
      console.error('Error en coach-intro:', e)
    }
  }

  async function handleGenerarPlan(planAnteriorParaAnalisis = null, fechaInicio = null, contexto = null) {
    setGenerando(true)
    setShowContextModal(false)
    try {
      const nuevoPlan = await generatePlan(userId, planAnteriorParaAnalisis, fechaInicio, contexto)
      if (nuevoPlan?.error) {
        setErrorToast(nuevoPlan.error)
        return
      }
      onPlanUpdate(nuevoPlan)
      if (planAnteriorParaAnalisis === null) {
        fetchCoachIntro(nuevoPlan)
      }
    } catch (e) {
      console.error('Error al generar plan:', e)
      setErrorToast('La generación del plan tardó demasiado. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  function abrirModalContexto(fechaInicio = null) {
    setPendingFechaInicio(fechaInicio)
    setContextoSemana('')
    setShowContextModal(true)
  }

  async function handleCompletar(dia) {
    const currentPlan = viendoProxima ? planSiguiente : plan
    const planId = currentPlan.id
    const optimisticSesiones = currentPlan.sesiones.map(s =>
      s.dia === dia ? { ...s, completada: true, rpe } : s
    )
    const optimisticPlan = { ...currentPlan, sesiones: optimisticSesiones }
    if (viendoProxima) {
      setPlanSiguiente(optimisticPlan)
    } else {
      onPlanUpdate(optimisticPlan)
    }
    try {
      const updated = await markSessionComplete(planId, dia, rpe)
      if (viendoProxima) {
        setPlanSiguiente(updated)
        onPlanProximaSemanaUpdate?.(updated)
      } else {
        onPlanUpdate(updated)
      }
    } catch (e) {
      console.error('Error al completar sesión:', e)
      if (viendoProxima) {
        setPlanSiguiente(currentPlan)
      } else {
        onPlanUpdate(currentPlan)
      }
      setErrorToast('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setCompletando(null)
    }
  }

  async function handleAjustar(motivo, descripcion = '') {
    setAjustando(motivo)
    setAjusteBanner(null)
    try {
      const updated = await adjustPlan(userId, plan.id, motivo, descripcion)
      onPlanUpdate(updated)
      if (updated?.mensaje) {
        const label = motivo === 'lesion' ? 'Lesión detectada'
          : motivo === 'viaje' ? 'Viaje adaptado'
          : 'Plan actualizado'
        setAjusteBanner({ reason: label, mensaje: updated.mensaje })
      }
    } catch (e) {
      console.error('Error al ajustar plan:', e)
      setErrorToast('No se pudo ajustar el plan. Inténtalo de nuevo.')
    } finally {
      setAjustando(false)
    }
  }

  async function handleVerSiguiente() {
    setViendoProxima(true)
    if (planSiguiente || planSiguienteNoExiste) return
    setLoadingProxima(true)
    try {
      const encontrado = await getPlanForWeek(userId, getNextWeekStart())
      if (encontrado) {
        setPlanSiguiente(encontrado)
        onPlanProximaSemanaUpdate?.(encontrado)
      } else {
        setPlanSiguienteNoExiste(true)
      }
    } catch (e) {
      console.error('Error al cargar próxima semana:', e)
      setPlanSiguienteNoExiste(true)
    } finally {
      setLoadingProxima(false)
    }
  }

  async function handleGenerarSiguiente() {
    // Verificar si ya existe un plan en la DB antes de generar
    const existente = await getPlanForWeek(userId, getNextWeekStart()).catch(() => null)
    if (existente) {
      setPlanSiguiente(existente)
      setPlanSiguienteNoExiste(false)
      onPlanProximaSemanaUpdate?.(existente)
      return
    }
    setGenerandoSiguiente(true)
    try {
      const nuevo = await generatePlan(userId, plan, getNextWeekStart())
      if (nuevo?.id) {
        setPlanSiguiente(nuevo)
        setPlanSiguienteNoExiste(false)
        onPlanProximaSemanaUpdate?.(nuevo)
      }
    } catch (e) {
      console.error('Error al generar plan próxima semana:', e)
    } finally {
      setGenerandoSiguiente(false)
    }
  }

  const selectStyle = {
    background: 'var(--input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--foreground)',
    fontFamily: 'var(--font-sans)',
    fontSize: 16,
    padding: '10px 8px',
    width: '100%',
    appearance: 'none',
  }

  if (!plan) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 64px)',
        background: 'var(--background)',
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>📅</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
          Aún no tienes un plan
        </h3>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 28, fontSize: 15, maxWidth: 300, lineHeight: 1.5 }}>
          Genera tu primer plan y el coach lo adaptará a tu nivel
        </p>

        <div style={{ width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 10 }}>
            ¿Cuándo quieres empezar?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8, marginBottom: 16 }}>
            <select value={diaInicio} onChange={e => setDiaInicio(e.target.value)} style={selectStyle}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={mesInicio} onChange={e => setMesInicio(e.target.value)} style={selectStyle}>
              {MESES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={anioInicio} onChange={e => setAnioInicio(e.target.value)} style={selectStyle}>
              {[String(new Date().getFullYear()), String(new Date().getFullYear() + 1)].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => abrirModalContexto(fechaSeleccionadaToISO(diaInicio, mesInicio, anioInicio))}
            disabled={generando}
            style={{
              background: 'var(--primary)',
              opacity: generando ? 0.75 : 1,
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              height: 52,
              width: '100%',
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 700,
              cursor: generando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {generando ? (
            <>
              <span style={{
                display: 'inline-block',
                width: 16, height: 16,
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginRight: 8,
                verticalAlign: 'middle',
              }} />
              Generando...
            </>
          ) : 'Generar mi plan'}
          </button>
        </div>

        {/* Modal contexto semana — necesario aquí para cuando no hay plan */}
        {showContextModal && (
          <div
            onClick={() => setShowContextModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'oklch(0 0 0 / 0.65)',
              zIndex: 200,
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
                padding: '24px 20px',
                paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                width: '100%',
                maxWidth: 480,
              }}
            >
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 6,
                color: 'var(--foreground)',
              }}>
                ¿Algo que tu coach deba saber esta semana?
              </h3>
              <p style={{
                fontSize: 13,
                color: 'var(--muted-foreground)',
                marginBottom: 16,
                lineHeight: 1.5,
              }}>
                Viajes, compromisos, cansancio acumulado...
              </p>
              <textarea
                value={contextoSemana}
                onChange={e => setContextoSemana(e.target.value)}
                placeholder="Ej: El miércoles tengo viaje, el viernes llego tarde del trabajo, esta semana me noto cansado..."
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  padding: '10px 14px',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.55,
                  marginBottom: 16,
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleGenerarPlan(null, pendingFechaInicio, null)}
                  disabled={generando}
                  style={{
                    flex: 1,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    color: 'var(--muted-foreground)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '11px 8px',
                    cursor: generando ? 'not-allowed' : 'pointer',
                    opacity: generando ? 0.6 : 1,
                  }}
                >
                  Generar sin contexto
                </button>
                <button
                  onClick={() => handleGenerarPlan(null, pendingFechaInicio, contextoSemana.trim() || null)}
                  disabled={generando}
                  style={{
                    flex: 2,
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: 10,
                    color: 'var(--primary-foreground)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '11px 16px',
                    cursor: generando ? 'not-allowed' : 'pointer',
                    opacity: generando ? 0.7 : 1,
                  }}
                >
                  {generando ? 'Generando...' : 'Generar con contexto →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const displayedPlan = viendoProxima ? planSiguiente : plan
  const analisis = analizarPlan(displayedPlan)
  const esDiagnostico = displayedPlan?.sesiones?.[0]?.tipo_semana === 'diagnostico'

  const dow = new Date().getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const esJuevesODespues = dow >= 4 || dow === 0
  const puedeVerSiguiente = esJuevesODespues && plan?.semana !== getNextWeekStart()

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
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
            {viendoProxima ? 'Próxima semana' : 'Semana actual'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {viendoProxima && (
              <button
                onClick={() => setViendoProxima(false)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: 16, padding: '2px 8px', cursor: 'pointer', lineHeight: 1.2 }}
              >‹</button>
            )}
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, flex: 1 }}>
              {(() => {
                const src = viendoProxima ? getNextWeekStart() : plan.semana
                const lunes = new Date(src + 'T12:00:00')
                const domingo = new Date(lunes)
                domingo.setDate(lunes.getDate() + 6)
                const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                return `Semana del ${fmt(lunes)} al ${fmt(domingo)}`
              })()}
            </h3>
            {!viendoProxima && puedeVerSiguiente && (
              <button
                onClick={handleVerSiguiente}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: 16, padding: '2px 8px', cursor: 'pointer', lineHeight: 1.2 }}
              >›</button>
            )}
          </div>
        {showCoachBadge && (
          <div style={{ maxWidth: 640, margin: '4px auto 0', paddingLeft: 4 }}>
            <span style={{
              fontSize: 11,
              background: 'oklch(0.7 0.18 45 / 0.15)',
              color: 'var(--primary)',
              border: '1px solid oklch(0.7 0.18 45 / 0.3)',
              borderRadius: 4,
              padding: '2px 8px',
              fontFamily: 'var(--font-sans)',
            }}>
              ✓ Actualizado por el coach
            </span>
          </div>
        )}
      </div>
      </div>

      {/* Error toast */}
      {errorToast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 16px))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'oklch(0.4 0.2 30)',
          color: 'white',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 14,
          fontFamily: 'var(--font-sans)',
          zIndex: 200,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px oklch(0 0 0 / 0.3)',
        }}>
          {errorToast}
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}>

        {/* Banner semana pasada */}
        {esSemanaPasada && (
          <div style={{
            background: 'oklch(0.7 0.18 45 / 0.08)',
            border: '1px solid oklch(0.7 0.18 45 / 0.35)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--primary)', marginBottom: 4 }}>
                  📅 Nueva semana
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  Semana anterior: {analisis?.sesionesCompletadas ?? 0}/7 sesiones completadas
                  {analisis?.rpeMedia != null ? ` · RPE medio ${analisis.rpeMedia}` : ''}
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('coach')}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  💬 Nuevo plan con el coach
                </button>
              )}
            </div>
          </div>
        )}

        {/* Banner plan futuro */}
        {esPlanFuturo && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 16px',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              Tu plan empieza el {formatDateLong(plan.semana)}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 16 }}>
              Mientras tanto habla con tu coach si tienes dudas.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('coach')}
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  padding: '10px 20px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                💬 Hablar con el coach
              </button>
            )}
          </div>
        )}

        {/* Banner semana de diagnóstico */}
        {esDiagnostico && (
          <div style={{
            background: 'oklch(0.7 0.18 45 / 0.1)',
            border: '1px solid oklch(0.7 0.18 45 / 0.3)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, color: 'var(--primary)', marginBottom: 4 }}>
                  📊 Semana de diagnóstico
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                  Estas sesiones nos ayudan a conocer tu nivel real para crear tu plan perfecto. Comparte los resultados con tu coach.
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('coach')}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  💬 Hablar con el coach
                </button>
              )}
            </div>
          </div>
        )}

        {/* Coach intro card */}
        {coachIntro && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: 16,
            position: 'relative',
          }}>
            <button
              onClick={() => setCoachIntro(null)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none',
                color: 'var(--muted-foreground)', cursor: 'pointer',
                fontSize: 16, padding: 4, lineHeight: 1,
              }}
            >✕</button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--primary)', color: 'var(--primary-foreground)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18, flexShrink: 0,
              }}>
                {(coachIntro.nombreCoach[0] || 'C').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  {coachIntro.nombreCoach}
                </p>
                <p style={{ color: 'var(--foreground)', fontSize: 14, lineHeight: 1.55 }}>
                  {coachIntro.mensaje}
                </p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('coach')}
                    style={{
                      marginTop: 10,
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '5px 12px',
                      color: 'var(--muted-foreground)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    💬 Responder al coach
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast "Ajustando..." */}
        {ajustando !== false && (
          <div style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 16px))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'oklch(0.22 0.015 60)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            borderRadius: 99,
            padding: '10px 20px',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            zIndex: 200,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px oklch(0 0 0 / 0.3)',
          }}>
            ⏳ Ajustando tu plan...
          </div>
        )}

        {/* Banner de ajuste del coach */}
        {ajusteBanner && (
          <AdjustmentBanner
            reason={ajusteBanner.reason}
            mensaje={ajusteBanner.mensaje}
            onDismiss={() => setAjusteBanner(null)}
          />
        )}

        {/* Botones de ajuste rápido */}
        {!esSemanaPasada && !viendoProxima && hayPendientes && (
          <div style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}>
            {[
              { motivo: 'dia_suelto', label: 'No puedo hoy', desc: `hoy es ${today}` },
              { motivo: 'lesion', label: 'Estoy lesionado', desc: '' },
              { motivo: 'viaje', label: 'Voy de viaje', desc: '' },
            ].map(({ motivo, label, desc }) => (
              <button
                key={motivo}
                onClick={() => handleAjustar(motivo, desc)}
                disabled={ajustando !== false}
                style={{
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  color: ajustando === motivo ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  padding: '5px 12px',
                  cursor: ajustando !== false ? 'not-allowed' : 'pointer',
                }}
              >
                {ajustando === motivo ? '...' : label}
              </button>
            ))}
          </div>
        )}

        {/* Próxima semana — estados de carga y sin plan */}
        {viendoProxima && loadingProxima && (
          <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '40px 0', fontSize: 14 }}>
            Cargando plan...
          </div>
        )}
        {viendoProxima && !loadingProxima && planSiguienteNoExiste && (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              Aún no hay plan para la próxima semana
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>
              Genera el plan ahora y empieza la semana preparado.
            </p>
            <button
              onClick={handleGenerarSiguiente}
              disabled={generandoSiguiente}
              style={{
                background: generandoSiguiente ? 'var(--muted)' : 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '10px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                cursor: generandoSiguiente ? 'not-allowed' : 'pointer',
              }}
            >
              {generandoSiguiente ? 'Generando...' : 'Generar plan próxima semana'}
            </button>
          </div>
        )}

        {/* Week objective header */}
        {displayedPlan?.fase && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: {
                base: '#10B981',
                build: '#3B8BD4',
                peak: '#FF6B2B',
                taper: '#8B5CF6',
              }[displayedPlan.fase] || 'var(--primary)',
              whiteSpace: 'nowrap',
              paddingTop: 1,
            }}>
              {displayedPlan.numero_semana ? `Sem ${displayedPlan.numero_semana} ·` : ''} {displayedPlan.fase.toUpperCase()}
            </span>
            {displayedPlan.objetivo_semana && (
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {displayedPlan.objetivo_semana}
              </span>
            )}
          </div>
        )}

        {/* Sessions */}
        {(!viendoProxima || (viendoProxima && displayedPlan)) && !loadingProxima && displayedPlan?.sesiones?.map((sesion) => {
          const esHoy = sesion.dia === today && !esSemanaPasada && !esPlanFuturo && !viendoProxima
          const sesionFecha = (() => {
            const base = new Date(displayedPlan.semana + 'T12:00:00')
            base.setDate(base.getDate() + (DIA_OFFSET_MAP[sesion.dia] ?? 0))
            return base.toISOString().split('T')[0]
          })()
          const esPasadoEnSemanaActual = !esSemanaPasada && !esPlanFuturo && !viendoProxima && sesionFecha < todayStr && !esHoy
          const sportColor = SPORT_COLORS[sesion.tipo] || '#374151'
          const leftBorderColor = sesion.completada ? 'oklch(0.7 0.14 180)' : sportColor
          const expanded = expandedDias.has(sesion.dia) || esHoy
          return (
            <div
              key={sesion.dia}
              style={{
                background: esHoy && !sesion.completada
                  ? `${sportColor}08`
                  : sesion.completada
                    ? 'oklch(0.7 0.14 180 / 0.04)'
                    : 'var(--card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${leftBorderColor}`,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 8,
                transition: 'background 0.2s',
                opacity: esPasadoEnSemanaActual ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18 }}>{ICONOS[sesion.tipo] || '🏋️'}</span>
                    <span style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: esHoy && !sesion.completada ? sportColor : 'var(--foreground)',
                    }}>
                      {sesion.dia}
                    </span>
                    {esHoy && !sesion.completada && (
                      <span style={{
                        fontSize: 10,
                        background: `${sportColor}22`,
                        color: sportColor,
                        border: `1px solid ${sportColor}44`,
                        borderRadius: 99,
                        padding: '1px 7px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        HOY
                      </span>
                    )}
                    {esDiagnostico && sesion.tipo !== 'Descanso' && (
                      <span style={{
                        fontSize: 10,
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        borderRadius: 99,
                        padding: '1px 7px',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}>
                        TEST
                      </span>
                    )}
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
                      {sesion.subtipo || sesion.tipo}
                    </span>
                    {sesion.duracion_min > 0 && (
                      <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>· {sesion.duracion_min} min</span>
                    )}
                    {sesion.zona_objetivo && (
                      <span style={{
                        fontSize: 11,
                        background: '#1a1a1a',
                        color: '#aaa',
                        border: '1px solid #2a2a2a',
                        borderRadius: 20,
                        padding: '1px 7px',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                      }}>
                        {sesion.zona_objetivo}
                      </span>
                    )}
                    {sesion.intensidad && sesion.intensidad !== 'descanso' && (
                      <span style={{
                        fontSize: 11,
                        background: sesion.intensidad?.toLowerCase() === 'suave' ? '#2d4a3e'
                          : sesion.intensidad?.toLowerCase() === 'media' ? '#3d3520'
                          : sesion.intensidad?.toLowerCase() === 'alta' ? '#4a1a1a'
                          : `${sportColor}15`,
                        color: sesion.intensidad?.toLowerCase() === 'suave' ? '#4ade80'
                          : sesion.intensidad?.toLowerCase() === 'media' ? '#fbbf24'
                          : sesion.intensidad?.toLowerCase() === 'alta' ? '#f87171'
                          : sportColor,
                        border: `1px solid ${
                          sesion.intensidad?.toLowerCase() === 'suave' ? '#3d6b55'
                          : sesion.intensidad?.toLowerCase() === 'media' ? '#5c4d30'
                          : sesion.intensidad?.toLowerCase() === 'alta' ? '#6b2b2b'
                          : `${sportColor}30`
                        }`,
                        borderRadius: 20,
                        padding: '1px 7px',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                      }}>
                        {sesion.intensidad}
                      </span>
                    )}
                  </div>
                  {(sesion.estructura || sesion.descripcion) && (
                    expanded ? (
                      <div>
                        {sesion.estructura ? (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                            {sesion.estructura.calentamiento && (
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, wordBreak: 'break-word', borderLeft: '2px solid #2a2a2a', paddingLeft: 12, margin: '6px 0' }}>
                                <span style={{ fontWeight: 600 }}>🔥 Calentamiento</span><br />
                                {sesion.estructura.calentamiento}
                              </div>
                            )}
                            {sesion.estructura.principal && (
                              <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.5, wordBreak: 'break-word', borderLeft: '2px solid #2a2a2a', paddingLeft: 12, margin: '6px 0' }}>
                                <span style={{ fontWeight: 600 }}>💪 Principal</span><br />
                                {sesion.estructura.principal}
                              </div>
                            )}
                            {sesion.estructura.vuelta_calma && (
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, wordBreak: 'break-word', borderLeft: '2px solid #2a2a2a', paddingLeft: 12, margin: '6px 0' }}>
                                <span style={{ fontWeight: 600 }}>🧘 Vuelta a la calma</span><br />
                                {sesion.estructura.vuelta_calma}
                              </div>
                            )}
                            {sesion.estructura.rpe_objetivo && (
                              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                                RPE objetivo: <strong>{sesion.estructura.rpe_objetivo}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                            {sesion.descripcion}
                          </p>
                        )}
                        {sesion.tipo !== 'Descanso' && (
                          <button
                            onClick={() => toggleDesc(sesion.dia)}
                            style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-sans)' }}
                          >
                            ∧ Ocultar
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleDesc(sesion.dia)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-sans)', marginTop: 2 }}
                      >
                        ∨ Ver descripción
                      </button>
                    )
                  )}
                </div>

                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {onSessionDetail && sesion.tipo !== 'Descanso' && (
                    <button
                      onClick={() => onSessionDetail(sesion)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted-foreground)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '2px 0',
                        textDecoration: 'underline',
                      }}
                    >
                      Ver detalles
                    </button>
                  )}
                  {sesion.completada ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                      ✓{sesion.rpe ? ` RPE ${sesion.rpe}` : ''}
                    </span>
                  ) : sesion.tipo !== 'Descanso' && !esSemanaPasada && !esPasadoEnSemanaActual && (
                    <button
                      onClick={() => setSesionParaCompletar(sesion)}
                      style={{
                        background: 'var(--secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--foreground)',
                        fontSize: 12,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✓ Completar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal contexto semana */}
      {showContextModal && (
        <div
          onClick={() => setShowContextModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0 0 0 / 0.65)',
            zIndex: 200,
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
              padding: '24px 20px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              width: '100%',
              maxWidth: 480,
            }}
          >
            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 6,
              color: 'var(--foreground)',
            }}>
              ¿Algo que tu coach deba saber esta semana?
            </h3>
            <p style={{
              fontSize: 13,
              color: 'var(--muted-foreground)',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              Viajes, compromisos, cansancio acumulado...
            </p>
            <textarea
              value={contextoSemana}
              onChange={e => setContextoSemana(e.target.value)}
              placeholder="Ej: El miércoles tengo viaje, el viernes llego tarde del trabajo, esta semana me noto cansado..."
              rows={4}
              style={{
                width: '100%',
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                padding: '10px 14px',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.55,
                marginBottom: 16,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleGenerarPlan(null, pendingFechaInicio, null)}
                disabled={generando}
                style={{
                  flex: 1,
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '11px 8px',
                  cursor: generando ? 'not-allowed' : 'pointer',
                  opacity: generando ? 0.6 : 1,
                }}
              >
                Generar sin contexto
              </button>
              <button
                onClick={() => handleGenerarPlan(null, pendingFechaInicio, contextoSemana.trim() || null)}
                disabled={generando}
                style={{
                  flex: 2,
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--primary-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '11px 16px',
                  cursor: generando ? 'not-allowed' : 'pointer',
                  opacity: generando ? 0.7 : 1,
                }}
              >
                {generando ? 'Generando...' : 'Generar con contexto →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sesionParaCompletar && displayedPlan?.id && (
        <ModalCompletarSesion
          sesion={sesionParaCompletar}
          planId={displayedPlan.id}
          profile={profile}
          onClose={() => setSesionParaCompletar(null)}
          onComplete={async (updatedPlan) => {
            if (updatedPlan) {
              onPlanUpdate(updatedPlan)
              // Auto-adjust: check RPE overload and missed sessions on the saved plan
              const { shouldAdjust, reason, signal } = checkShouldAdjust(updatedPlan, profile)
              if (shouldAdjust) {
                try {
                  const result = await autoAdjustPlan(userId, displayedPlan.id, signal)
                  if (result?.sesiones) {
                    onPlanUpdate(result)
                    setAjusteBanner({ reason, mensaje: result.mensaje || 'Tu coach ha ajustado el plan.' })
                  }
                } catch (e) {
                  console.error('Auto-adjust error:', e)
                }
              }
            }
            setSesionParaCompletar(null)
          }}
        />
      )}
    </div>
  )
}
