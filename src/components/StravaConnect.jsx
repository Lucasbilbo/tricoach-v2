import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StravaConnect({ userId, plan, onConnected, onShowUpgrade }) {
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast] = useState(null)

  // Per-user Strava app credentials
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [hasCreds, setHasCreds] = useState(false)
  const [savingCreds, setSavingCreds] = useState(false)

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
      .select('strava_token, strava_client_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.strava_token) setConnected(true)
        if (data?.strava_client_id) {
          setHasCreds(true)
          setClientId(data.strava_client_id)
        }
      })

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code && state === 'strava') {
      window.history.replaceState({}, '', window.location.pathname)
      handleCallback(code)
    }
  }, [userId])

  async function handleCallback(code) {
    setConnecting(true)
    try {
      const response = await fetch('/.netlify/functions/strava-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId })
      })

      if (response.status === 403) {
        console.warn('Strava requiere plan Pro')
        return
      }

      const data = await response.json()

      if (data.ok) {
        setConnected(true)
        if (onConnected) onConnected()
      }
    } catch (error) {
      console.error('Error conectando Strava:', error)
    } finally {
      setConnecting(false)
    }
  }

  async function handleSaveCreds() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setSavingCreds(true)
    const { error } = await supabase
      .from('profiles')
      .update({ strava_client_id: clientId.trim(), strava_client_secret: clientSecret.trim() })
      .eq('id', userId)
    setSavingCreds(false)
    if (!error) {
      setHasCreds(true)
      connectStrava()
    }
  }

  function connectStrava() {
    if (esFree) {
      if (onShowUpgrade) onShowUpgrade()
      return
    }
    const redirectUri = window.location.origin
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

  // Pro user — no credentials yet: show form
  if (!hasCreds) {
    return (
      <div>
        {toast && (
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8, fontWeight: 500 }}>
            {toast}
          </div>
        )}
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.5 }}>
          Crea tu app gratis en{' '}
          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>strava.com/settings/api</span>
          {' '}y pega aquí tus credenciales.
        </p>
        <input
          style={{
            display: 'block',
            width: '100%',
            background: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            color: '#e0e0e0',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            padding: '10px 12px',
            marginBottom: 8,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="Client ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          autoComplete="off"
        />
        <input
          type="password"
          style={{
            display: 'block',
            width: '100%',
            background: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            color: '#e0e0e0',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            padding: '10px 12px',
            marginBottom: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="Client Secret"
          value={clientSecret}
          onChange={e => setClientSecret(e.target.value)}
          autoComplete="off"
        />
        <button
          onClick={handleSaveCreds}
          disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
          style={{
            background: '#fc4c02',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: (savingCreds || !clientId.trim() || !clientSecret.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            opacity: (!clientId.trim() || !clientSecret.trim()) ? 0.5 : 1,
          }}
        >
          {savingCreds ? 'Guardando...' : 'Guardar y conectar'}
        </button>
      </div>
    )
  }

  // Pro user — has credentials but not connected: show connect button
  return (
    <div>
      {connecting && (
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>Conectando...</p>
      )}
      <button
        onClick={connectStrava}
        disabled={connecting}
        style={{
          background: '#fc4c02',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 6,
          cursor: connecting ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Conectar Strava
      </button>
    </div>
  )
}
