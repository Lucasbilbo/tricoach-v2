import { useState } from 'react'
import { generatePlan, markSessionComplete } from '../lib/plans'

const ICONOS = {
  Correr: '🏃',
  Bici: '🚴',
  Nadar: '🏊',
  Fuerza: '💪',
  Brick: '🧱',
  Descanso: '😴',
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function WeeklyPlan({ userId, plan, onPlanUpdate }) {
  const [generando, setGenerando] = useState(false)
  const [completando, setCompletando] = useState(null)
  const [rpe, setRpe] = useState(5)

  const today = DIAS_SEMANA[new Date().getDay()]

  async function handleGenerarPlan() {
    setGenerando(true)
    try {
      const nuevoPlan = await generatePlan(userId)
      onPlanUpdate(nuevoPlan)
    } catch (e) {
      console.error('Error al generar plan:', e)
    } finally {
      setGenerando(false)
    }
  }

  async function handleCompletar(dia) {
    try {
      const updated = await markSessionComplete(plan.id, dia, rpe)
      onPlanUpdate(updated)
    } catch (e) {
      console.error('Error al completar sesión:', e)
    } finally {
      setCompletando(null)
    }
  }

  if (!plan) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 60px)',
        background: 'var(--background)',
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 8 }}>Plan semanal</h3>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 24, fontSize: 15 }}>
          No tienes un plan para esta semana.
        </p>
        <button
          onClick={handleGenerarPlan}
          disabled={generando}
          style={{
            background: generando ? 'var(--muted)' : 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 24,
            padding: '12px 28px',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 600,
            cursor: generando ? 'not-allowed' : 'pointer',
          }}
        >
          {generando ? 'Generando...' : 'Generar plan de esta semana'}
        </button>
      </div>
    )
  }

  return (
    <div style={{
      height: 'calc(100vh - 60px)',
      overflowY: 'auto',
      background: 'var(--background)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600 }}>
            Semana del {plan.semana}
          </h3>
          <button
            onClick={handleGenerarPlan}
            disabled={generando}
            style={{
              background: 'var(--secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--muted-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {generando ? '...' : '↻ Regenerar'}
          </button>
        </div>
      </div>

      {/* Sessions */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 16px' }}>
        {plan.sesiones.map((sesion) => {
          const esHoy = sesion.dia === today
          return (
            <div
              key={sesion.dia}
              style={{
                background: sesion.completada
                  ? 'oklch(0.7 0.14 180 / 0.06)'
                  : 'var(--card)',
                border: `1px solid ${sesion.completada
                  ? 'oklch(0.7 0.14 180 / 0.35)'
                  : esHoy
                    ? 'var(--primary)'
                    : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                marginBottom: 8,
                boxShadow: esHoy && !sesion.completada ? '0 0 0 2px oklch(0.7 0.18 45 / 0.2)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{ICONOS[sesion.tipo] || '🏋️'}</span>
                    <div>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 15,
                        color: esHoy && !sesion.completada ? 'var(--primary)' : 'var(--foreground)',
                      }}>
                        {sesion.dia}
                      </span>
                      {esHoy && !sesion.completada && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 11,
                          background: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}>
                          HOY
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{sesion.tipo}</span>
                    {sesion.duracion_min > 0 && (
                      <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>· {sesion.duracion_min} min</span>
                    )}
                  </div>
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.4 }}>
                    {sesion.descripcion}
                  </p>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {sesion.completada ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                      ✓{sesion.rpe ? ` RPE ${sesion.rpe}` : ''}
                    </span>
                  ) : sesion.tipo !== 'Descanso' && (
                    completando === sesion.dia ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>RPE</span>
                          <select
                            value={rpe}
                            onChange={e => setRpe(Number(e.target.value))}
                            style={{
                              background: 'var(--input)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              color: 'var(--foreground)',
                              fontFamily: 'var(--font-sans)',
                              fontSize: 13,
                              padding: '2px 6px',
                            }}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => handleCompletar(sesion.dia)}
                            style={{
                              background: 'var(--success)',
                              color: 'var(--success-foreground)',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setCompletando(null)}
                            style={{
                              background: 'var(--secondary)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              color: 'var(--muted-foreground)',
                              padding: '4px 8px',
                              fontSize: 12,
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
                        onClick={() => setCompletando(sesion.dia)}
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
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
