import { useState } from 'react'
import { track } from '../lib/analytics'

const PRICES = [
  {
    id: 'monthly',
    label: 'Mensual',
    price: '14,99€',
    period: '/mes',
    popular: false,
  },
  {
    id: 'annual',
    label: 'Anual',
    price: '119€',
    period: '/año',
    popular: true,
    savings: 'Ahorras 61€',
  },
]

export default function UpgradeModal({ userId, onClose }) {
  const [loading, setLoading] = useState(null)
  const [errorToast, setErrorToast] = useState(false)

  function mostrarError() {
    setErrorToast(true)
    setTimeout(() => setErrorToast(false), 6000)
  }

  // El precio lo decide el servidor a partir del plan: el navegador no necesita conocer los ids de Stripe.
  async function handleUpgrade(planId) {
    setLoading(planId)
    track('begin_checkout', { plan: planId })
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, plan: planId })
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.url) {
        window.location.href = data.url
        return
      }
      console.error('Error al crear checkout:', res.status, data?.error)
      mostrarError()
    } catch (e) {
      console.error('Error al crear checkout:', e)
      mostrarError()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(0 0 0 / 0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        padding: '0 0 60px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 24,
          width: '100%',
          maxWidth: 480,
          margin: '0 16px',
        }}
      >
        {errorToast && (
          <div style={{
            background: 'var(--destructive)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            No se ha podido abrir el pago. Inténtalo de nuevo o escribe a coach@getricoach.com
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
            Hazte Pro
          </h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            20 mensajes al día con el modelo más avanzado y un plan nuevo cada lunes, sin pedirlo
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PRICES.map(plan => (
            <button
              key={plan.id}
              onClick={() => handleUpgrade(plan.id)}
              disabled={loading !== null}
              style={{
                background: plan.popular ? 'var(--primary)' : 'var(--secondary)',
                color: plan.popular ? 'var(--primary-foreground)' : 'var(--foreground)',
                border: plan.popular ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px 20px',
                cursor: loading !== null ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {plan.label}
                  {plan.popular && (
                    <span style={{
                      background: 'oklch(0.13 0.01 60 / 0.3)',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      Más popular
                    </span>
                  )}
                </div>
                {plan.savings && (
                  <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{plan.savings}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>
                  {loading === plan.id ? '...' : plan.price}
                </span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{plan.period}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--muted-foreground)',
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            padding: '8px 0',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
