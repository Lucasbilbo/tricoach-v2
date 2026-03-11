import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('cookies_accepted')
    if (!accepted) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookies_accepted', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#1a1a1a',
      color: 'white',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      zIndex: 1000
    }}>
      <p style={{ margin: 0, fontSize: 14 }}>
        Usamos cookies esenciales para el funcionamiento de la app y cookies analíticas para mejorar el servicio.
        Al continuar, aceptas nuestra{' '}
        <a href="/privacidad" style={{ color: '#60a5fa' }}>política de privacidad</a> y{' '}
<a href="/terminos" style={{ color: '#60a5fa' }}>términos de uso</a>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={accept}
          style={{
            background: '#0070f3',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}