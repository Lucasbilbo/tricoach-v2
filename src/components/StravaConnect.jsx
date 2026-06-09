import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StravaConnect({ userId, plan, onConnected, onShowUpgrade }) {
  const [connected, setConnected] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast] = useState(null)

  const esFree = !plan || plan === 'free'

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    const { error } = await supabase
      .from('profiles')
      .update({ strava_token: null, strava_refresh_token: null, strava_token_expires_at: null })
      .eq('id', userId)
    setDisconnecting(false)
    if (!error) {
      setConnected(false)
      showToast('Strava desconectado')
    }
  }

  useEffect(() => {
    supabase
      .from('profiles')
      .select('strava_token')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.strava_token) setConnected(true)
      })
  }, [userId])

  function connectStrava() {
    if (esFree) {
      if (onShowUpgrade) onShowUpgrade()
      return
    }
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID
    const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI || import.meta.env.VITE_APP_URL || window.location.origin
    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read&state=strava`
    window.location.href = url
  }

  if (connected) {
    return (
      <div>
        {toast && (
          <div style={{
            fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8, fontWeight: 500,
          }}>
            {toast}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#fc4c02', fontWeight: 600, fontSize: 14 }}>✓ Strava conectado</span>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--muted-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              padding: '4px 10px',
              cursor: disconnecting ? 'not-allowed' : 'pointer',
            }}
          >
            {disconnecting ? '...' : 'Desconectar'}
          </button>
        </div>
      </div>
    )
  }

  if (esFree) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Strava</span>
          <span style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}>
            Pro
          </span>
        </div>
        <button
          onClick={() => { if (onShowUpgrade) onShowUpgrade() }}
          style={{
            background: 'var(--secondary)',
            color: 'var(--muted-foreground)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          Conectar Strava
        </button>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>
          Disponible en Pro
        </p>
      </div>
    )
  }

  // Pro user — not connected: show connect button
  return (
    <div>
      <button
        onClick={connectStrava}
        style={{
          background: '#fc4c02',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Conectar Strava
      </button>
    </div>
  )
}
