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

const COLORES_INTENSIDAD = {
  suave: '#dbeafe',
  moderada: '#fef9c3',
  fuerte: '#fee2e2',
  descanso: '#f3f4f6',
}

export default function WeeklyPlan({ userId, plan, onPlanUpdate }) {
  const [generando, setGenerando] = useState(false)
  const [completando, setCompletando] = useState(null)
  const [rpe, setRpe] = useState(5)

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
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Plan semanal</h3>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>No tienes un plan para esta semana.</p>
        <button
          onClick={handleGenerarPlan}
          disabled={generando}
          style={{ padding: '10px 20px', background: '#0070f3', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          {generando ? 'Generando...' : 'Generar plan de esta semana'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Plan semanal — {plan.semana}</h3>
      {plan.sesiones.map((sesion) => (
        <div
          key={sesion.dia}
          style={{
            border: `1px solid ${sesion.completada ? '#86efac' : '#e5e7eb'}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            background: sesion.completada ? '#f0fdf4' : (COLORES_INTENSIDAD[sesion.intensidad] || 'white')
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{sesion.dia}</strong>
              {' '}{ICONOS[sesion.tipo] || '🏋️'} {sesion.tipo}
              {sesion.duracion_min > 0 && (
                <span style={{ color: '#6b7280', marginLeft: 4 }}>· {sesion.duracion_min} min</span>
              )}
            </div>
            <div>
              {sesion.completada ? (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  ✓ Completada{sesion.rpe ? ` (RPE ${sesion.rpe})` : ''}
                </span>
              ) : sesion.tipo !== 'Descanso' && (
                completando === sesion.dia ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      RPE:
                      <select
                        value={rpe}
                        onChange={e => setRpe(Number(e.target.value))}
                        style={{ marginLeft: 4 }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => handleCompletar(sesion.dia)}
                      style={{ padding: '4px 8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setCompletando(null)}
                      style={{ padding: '4px 8px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCompletando(sesion.dia)}
                    style={{ padding: '4px 10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer' }}
                  >
                    ✓ Completar
                  </button>
                )
              )}
            </div>
          </div>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>{sesion.descripcion}</p>
        </div>
      ))}
    </div>
  )
}
