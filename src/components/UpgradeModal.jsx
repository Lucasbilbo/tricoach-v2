import { useState } from 'react'

const PRICES = [
  {
    id: 'monthly',
    label: 'Mensual',
    price: '9,99€',
    period: '/mes',
    popular: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_MONTHLY,
  },
  {
    id: 'annual',
    label: 'Anual',
    price: '79€',
    period: '/año',
    popular: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ANNUAL,
    savings: 'Ahorras 40€',
  },
]

export default function UpgradeModal({ userId, onClose }) {
  const [loading, setLoading] = useState(null)

  async function handleUpgrade(priceId, planId) {
    console.log('handleUpgrade called', { priceId, planId, userId })
    if (!priceId) {
      console.error('priceId is undefined - check VITE_STRIPE_PRICE_MONTHLY env var')
      return
    }
    setLoading(planId)
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
        },
        body: JSON.stringify({ userId, priceId })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Error al crear checkout:', e)
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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
            Hazte Pro
          </h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            Mensajes ilimitados, análisis de Strava y planes adaptativos
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PRICES.map(plan => (
            <button
              key={plan.id}
              onClick={() => handleUpgrade(plan.priceId, plan.id)}
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
