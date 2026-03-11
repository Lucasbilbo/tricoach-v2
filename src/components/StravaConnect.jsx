import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_STRAVA_REDIRECT_URI || `${window.location.origin}`

export default function StravaConnect({ userId, onConnected }) {
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('strava_token')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.strava_token) setConnected(true)
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
        body: JSON.stringify({ code })
      })

      const data = await response.json()
    

      if (data.access_token) {
        await supabase
          .from('profiles')
          .update({
            strava_token: data.access_token,
            strava_refresh_token: data.refresh_token,
            strava_token_expires_at: data.expires_at
          })
          .eq('id', userId)

        setConnected(true)
        if (onConnected) onConnected()
      }
    } catch (error) {
      console.error('Error conectando Strava:', error)
    } finally {
      setConnecting(false)
    }
  }

  function connectStrava() {
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=auto&scope=read,activity:read&state=strava`
    window.location.href = url
  }

  if (connected) {
    return <span style={{ color: '#fc4c02', fontWeight: 600 }}>✓ Strava conectado</span>
  }

  return (
    <button
      onClick={connectStrava}
      disabled={connecting}
      style={{
        background: '#fc4c02',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        fontWeight: 600
      }}
    >
      {connecting ? 'Conectando...' : '🔗 Conectar Strava'}
    </button>
  )
}