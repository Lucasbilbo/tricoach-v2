import { useState } from 'react'

const ICONOS = {
  Correr: '🏃',
  Bici: '🚴',
  Nadar: '🏊',
  Fuerza: '💪',
  Brick: '🧱',
  Descanso: '😴',
}

const COLORES_TIPO = {
  Correr: 'oklch(0.6 0.2 25)',
  Bici: 'oklch(0.6 0.18 250)',
  Nadar: 'oklch(0.6 0.18 210)',
  Fuerza: 'oklch(0.6 0.18 300)',
  Brick: 'var(--primary)',
  Descanso: 'var(--muted-foreground)',
}

const RITMOS = {
  principiante: '6:30 /km',
  intermedio: '5:30 /km',
  avanzado: '4:30 /km',
}

function getMetrica(tipo, nivel) {
  if (tipo === 'Correr') return `Ritmo objetivo: ${RITMOS[nivel] || RITMOS.principiante}`
  if (tipo === 'Bici') return 'Cadencia objetivo: 80-90 rpm'
  if (tipo === 'Nadar') return 'Descanso entre series: 20-30 seg'
  if (tipo === 'Fuerza' || tipo === 'Brick') return '3-4 series × 8-12 repeticiones'
  return null
}

export default function SessionDetail({ sesion, profile, onClose, onComplete }) {
  const [completando, setCompletando] = useState(false)
  const [rpe, setRpe] = useState(6)

  const duracion = sesion.duracion_min || 0
  const calentamiento = Math.max(5, Math.round(duracion * 0.1))
  const vuelta = Math.max(5, Math.round(duracion * 0.1))
  const principal = Math.max(0, duracion - calentamiento - vuelta)

  const color = COLORES_TIPO[sesion.tipo] || 'var(--primary)'
  const metrica = getMetrica(sesion.tipo, profile?.nivel)

  const bloques = [
    { label: 'Calentamiento', duracion: calentamiento, desc: 'Activa el cuerpo progresivamente. Movilidad articular y ritmo suave.' },
    { label: 'Bloque principal', duracion: principal, desc: sesion.descripcion || '' },
    { label: 'Vuelta a la calma', duracion: vuelta, desc: 'Reduce la intensidad gradualmente. Estiramientos suaves 5-10 min.' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--background)',
      zIndex: 80,
      overflowY: 'auto',
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 90,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--foreground)',
            fontSize: 22,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px 8px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600 }}>
            {ICONOS[sesion.tipo] || '🏋️'} {sesion.tipo}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {sesion.dia} · {sesion.duracion_min} min · {sesion.intensidad}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>

        {/* Time blocks */}
        {bloques.map(bloque => (
          <div
            key={bloque.label}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${color}`,
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{bloque.label}</span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>{bloque.duracion} min</span>
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.4 }}>{bloque.desc}</p>
          </div>
        ))}

        {/* Metric */}
        {metrica && (
          <div style={{
            background: 'oklch(0.7 0.18 45 / 0.08)',
            border: '1px solid oklch(0.7 0.18 45 / 0.3)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>🎯 {metrica}</p>
          </div>
        )}

        {/* Complete */}
        {sesion.completada ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 18 }}>
              ✓ Sesión completada{sesion.rpe ? ` · RPE ${sesion.rpe}` : ''}
            </span>
          </div>
        ) : sesion.tipo !== 'Descanso' && (
          completando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '8px 0' }}>
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
                  fontSize: 15,
                  padding: '6px 12px',
                }}
              >
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button
                  onClick={() => onComplete(rpe)}
                  style={{
                    flex: 1,
                    background: 'var(--success)',
                    color: 'oklch(0.13 0.01 60)',
                    border: 'none',
                    borderRadius: 24,
                    padding: '12px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
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
                    padding: '12px 16px',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
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
                width: '100%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: 24,
                padding: '14px',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              ✓ Completar sesión
            </button>
          )
        )}
      </div>
    </div>
  )
}
