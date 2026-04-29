import { useState } from 'react'

export default function CicloCompletadoBanner({ semanasTotales, onRenovar, renovando }) {
  const [dismissed, setDismissed] = useState(() => {
    const hoy = new Date().toISOString().split('T')[0]
    return localStorage.getItem('ciclo_completado_dismissed') === hoy
  })

  function handleDismiss() {
    const hoy = new Date().toISOString().split('T')[0]
    localStorage.setItem('ciclo_completado_dismissed', hoy)
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div style={{
      background: 'oklch(0.18 0.04 260)',
      border: '1px solid oklch(0.35 0.1 260)',
      borderRadius: 14,
      padding: '18px 18px 16px',
      marginBottom: 12,
    }}>
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--foreground)',
        marginBottom: 6,
      }}>
        🎉 ¡Has completado tu ciclo de entrenamiento!
      </p>
      <p style={{
        fontSize: 13,
        color: 'var(--muted-foreground)',
        lineHeight: 1.5,
        marginBottom: 14,
      }}>
        Llevas {semanasTotales || 16} semanas de trabajo consistente. ¿Empezamos el siguiente ciclo?
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRenovar}
          disabled={renovando}
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: renovando ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
            opacity: renovando ? 0.7 : 1,
            flex: 1,
          }}
        >
          {renovando ? 'Creando ciclo...' : 'Empezar nuevo ciclo'}
        </button>
        <button
          onClick={handleDismiss}
          disabled={renovando}
          style={{
            background: 'transparent',
            color: 'var(--muted-foreground)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            cursor: renovando ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
