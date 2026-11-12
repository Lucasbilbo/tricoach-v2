import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StravaConnect({ userId }) {
  const [connected, setConnected] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toast, setToast] = useState(null)


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
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8, lineHeight: 1.4 }}>
          Si desconectas no podrás volver a conectar: ya no admitimos conexiones nuevas con Strava.
        </p>
      </div>
    )
  }

  // Strava está cerrado a conexiones nuevas (nov-2026): su política de API prohíbe usar
  // sus datos con IA y la app no puede crecer por ahí. Quien ya está conectado sigue igual;
  // el resto no ve nada aquí y enseña su entreno con una captura (ModalCompletarSesion).
  return null
}
