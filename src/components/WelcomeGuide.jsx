import { useState } from 'react'

const STEPS = [
  {
    tab: 'dashboard',
    tabIndex: 0,
    icon: '🏠',
    title: 'Tu entrenamiento de hoy',
    desc: 'Aquí verás exactamente qué tienes que hacer cada día. Márcalo como completado cuando acabes.',
  },
  {
    tab: 'plan',
    tabIndex: 1,
    icon: '📅',
    title: 'Tu semana completa',
    desc: 'Consulta y ajusta tu plan semanal. Si algo cambia, tu coach lo adapta.',
  },
  {
    tab: 'progress',
    tabIndex: 2,
    icon: '📈',
    title: 'Sigue tu evolución',
    desc: 'Tu consistencia, volumen y adherencia al plan semana a semana.',
  },
  {
    tab: 'coach',
    tabIndex: 3,
    icon: '💬',
    title: 'Tu entrenador personal',
    desc: 'Pregúntale cualquier cosa — dudas sobre el entreno, cómo te sientes, cambios de última hora.',
  },
  {
    tab: 'profile',
    tabIndex: 4,
    icon: '👤',
    title: 'Todo sobre ti',
    desc: 'Aquí el coach ve toda tu información. Cuanto más completo, mejor el plan.',
  },
]

export default function WelcomeGuide({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(true)

  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
      return
    }
    setVisible(false)
    setTimeout(() => {
      setCurrentStep(prev => prev + 1)
      setVisible(true)
    }, 200)
  }

  return (
    <>
      {/* Spotlight — transparent div on the active tab, box-shadow darkens everything else */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: `${step.tabIndex * 20}%`,
        width: '20%',
        height: '60px',
        zIndex: 200,
        borderRadius: 4,
        boxShadow: [
          '0 0 0 3px var(--primary)',
          '0 0 24px oklch(0.7 0.18 45 / 0.5)',
          '0 0 0 9999px rgba(0,0,0,0.75)',
        ].join(', '),
        transition: 'left 0.3s ease',
        pointerEvents: 'none',
      }} />

      {/* Floating card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, calc(-50% - 40px)) translateY(${visible ? 0 : -10}px)`,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          zIndex: 300,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '28px 24px 24px',
          width: 'calc(100% - 48px)',
          maxWidth: 360,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 52, marginBottom: 12, lineHeight: 1 }}>{step.icon}</div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 10,
          color: 'var(--foreground)',
        }}>
          {step.title}
        </h2>

        {/* Description */}
        <p style={{
          color: 'var(--muted-foreground)',
          fontSize: 15,
          lineHeight: 1.55,
          marginBottom: 24,
        }}>
          {step.desc}
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === currentStep ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i <= currentStep ? 'var(--primary)' : 'var(--secondary)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            height: 48,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isLast ? '¡Empezar!' : 'Siguiente →'}
        </button>
      </div>
    </>
  )
}
