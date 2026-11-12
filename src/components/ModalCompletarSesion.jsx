import { useState, useEffect, useRef } from 'react'
import { analizarCaptura, capturasRestantes, LIMITE_SEMANAL_FREE } from '../lib/captura'
import { track } from '../lib/analytics'
import { completarSesion } from '../lib/plans'

const RPE_COLORS = {
  1: '#22c55e', 2: '#22c55e', 3: '#22c55e',
  4: '#eab308', 5: '#eab308', 6: '#eab308',
  7: '#f97316', 8: '#f97316',
  9: '#ef4444', 10: '#ef4444',
}

const TIPOS_SIN_DISTANCIA = new Set(['Fuerza', 'Descanso'])

export default function ModalCompletarSesion({ sesion, planId, profile, onClose, onComplete, onShowUpgrade }) {
  const [rpe, setRpe] = useState(sesion.estructura?.rpe_objetivo
    ? parseInt(sesion.estructura.rpe_objetivo.split('-')[0], 10) || 6
    : 6)
  const [tiempoReal, setTiempoReal] = useState(sesion.duracion_min || '')
  const [distanciaReal, setDistanciaReal] = useState(sesion.distancia_km || '')
  const [fcMedia, setFcMedia] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [stravaLoading, setStravaLoading] = useState(false)
  const [stravaImportado, setStravaImportado] = useState(false)
  // Captura del entreno: 'idle' | 'leyendo' | 'leida' | 'error'
  const [captura, setCaptura] = useState({ estado: 'idle', mensaje: '' })
  // Capturas que le quedan esta semana a un Free; null = sin tope (Pro)
  const [restantes, setRestantes] = useState(() => capturasRestantes(profile))
  const inputCaptura = useRef(null)

  useEffect(() => {
    if (!profile?.strava_token || !sesion.fecha || !sesion.tipo) return

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    setStravaLoading(true)

    fetch('/.netlify/functions/strava-match-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, sessionDate: sesion.fecha, sessionTipo: sesion.tipo }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          if (data.duracion_min) setTiempoReal(data.duracion_min)
          if (data.distancia_km) setDistanciaReal(data.distancia_km)
          if (data.fc_media)    setFcMedia(data.fc_media)
          setStravaImportado(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeoutId)
        setStravaLoading(false)
      })

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mostrarDistancia = !TIPOS_SIN_DISTANCIA.has(sesion.tipo)
  // Si la captura trae pulso se enseña el campo aunque el perfil no tenga FC máxima
  const mostrarFc = !!profile?.fc_maxima || fcMedia !== ''

  // El coach lee la captura y rellena los campos; el usuario los revisa antes de guardar.
  async function handleCaptura(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile?.id) return
    setCaptura({ estado: 'leyendo', mensaje: '' })
    try {
      const datos = await analizarCaptura(profile.id, file, sesion)
      if (datos.duracion_min != null) setTiempoReal(datos.duracion_min)
      if (datos.distancia_km != null) setDistanciaReal(datos.distancia_km)
      if (datos.fc_media != null) setFcMedia(datos.fc_media)
      setCaptura({ estado: 'leida', mensaje: datos.comentario || '' })
      if (datos.capturas_restantes != null) setRestantes(datos.capturas_restantes)
      track('captura_leida')
    } catch (err) {
      if (err?.limiteSemanal) {
        setRestantes(0)
        setCaptura({ estado: 'idle', mensaje: '' })
      } else {
        setCaptura({ estado: 'error', mensaje: err?.message || 'No se ha podido leer la captura. Inténtalo de nuevo.' })
      }
    }
  }

  async function guardar(soloMarcar) {
    setSaving(true)
    try {
      const campos = { rpe }
      if (!soloMarcar) {
        if (tiempoReal !== '') campos.tiempo_real_min = Number(tiempoReal)
        if (mostrarDistancia && distanciaReal !== '') campos.distancia_real_km = Number(distanciaReal)
        if (mostrarFc && fcMedia !== '') campos.fc_media_real = Number(fcMedia)
        if (notas.trim()) campos.notas_usuario = notas.trim()
      }
      const updated = await completarSesion(planId, sesion.dia, campos)
      onComplete(updated)
    } catch {
      // silently close — caller handles UI state
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(0 0 0 / 0.65)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 16px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 -4px 40px oklch(0 0 0 / 0.3)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 20px' }} />

        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {sesion.subtipo || sesion.tipo}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: stravaLoading || stravaImportado ? 10 : 20 }}>
          {sesion.dia} · {sesion.duracion_min} min planificados
        </p>

        {stravaLoading && (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--muted-foreground)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            Buscando en Strava...
          </p>
        )}

        {stravaImportado && !stravaLoading && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'oklch(0.25 0.05 145)',
            border: '1px solid oklch(0.45 0.12 145)',
            borderRadius: 99,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'oklch(0.85 0.15 145)',
            marginBottom: 16,
          }}>
            Datos importados de Strava 🟠
          </div>
        )}

        {/* Captura del entreno */}
        {!stravaImportado && (
          <div style={{ marginBottom: 20 }}>
            <input ref={inputCaptura} type="file" accept="image/*" onChange={handleCaptura} style={{ display: 'none' }} data-testid="input-captura" />
            <button
              onClick={() => inputCaptura.current?.click()}
              disabled={captura.estado === 'leyendo' || restantes === 0}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'var(--secondary)',
                border: '1px dashed var(--border)',
                borderRadius: 10,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                padding: '11px 12px',
                opacity: restantes === 0 ? 0.5 : 1,
                cursor: captura.estado === 'leyendo' || restantes === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {captura.estado === 'leyendo' ? 'Leyendo tu captura...' : captura.estado === 'leida' ? 'Subir otra captura' : 'Subir captura del entreno'}
            </button>
            {captura.estado === 'idle' && restantes !== 0 && (
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6, textAlign: 'center' }}>
                El resumen de tu reloj o de tu app. El coach rellena los datos por ti.
                {restantes != null && ` Te ${restantes === 1 ? 'queda 1 captura' : `quedan ${restantes} capturas`} esta semana.`}
              </p>
            )}
            {restantes === 0 && (
              <div style={{ marginTop: 10, background: 'oklch(0.7 0.18 45 / 0.08)', border: '1px solid oklch(0.7 0.18 45 / 0.35)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, marginBottom: onShowUpgrade ? 8 : 0 }}>
                  Has usado tus {LIMITE_SEMANAL_FREE} capturas de esta semana. Con Pro el coach lee todos tus entrenos y ajusta el plan con ellos.
                </p>
                {onShowUpgrade && (
                  <button
                    onClick={() => { onClose(); onShowUpgrade() }}
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 24, padding: '7px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Hazte Pro
                  </button>
                )}
              </div>
            )}
            {captura.estado === 'leida' && (
              <div style={{ marginTop: 10, background: 'oklch(0.7 0.18 45 / 0.08)', border: '1px solid oklch(0.7 0.18 45 / 0.35)', borderRadius: 10, padding: '10px 12px' }}>
                {captura.mensaje && (
                  <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, marginBottom: 6 }}>{captura.mensaje}</p>
                )}
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Datos leídos de tu captura. Revísalos antes de guardar.</p>
              </div>
            )}
            {captura.estado === 'error' && (
              <p role="alert" style={{ fontSize: 12, color: 'var(--destructive, #ef4444)', marginTop: 8, lineHeight: 1.4 }}>{captura.mensaje}</p>
            )}
          </div>
        )}

        {/* RPE selector */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            ¿Cómo fue el esfuerzo? (RPE)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                style={{
                  background: rpe === n ? RPE_COLORS[n] : 'var(--secondary)',
                  border: rpe === n ? 'none' : '1px solid var(--border)',
                  borderRadius: 8,
                  color: rpe === n ? '#fff' : 'var(--muted-foreground)',
                  fontWeight: rpe === n ? 700 : 400,
                  fontSize: 13,
                  padding: '8px 2px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, textAlign: 'center' }}>
            {rpe <= 3 ? 'Muy fácil' : rpe <= 5 ? 'Moderado' : rpe <= 7 ? 'Duro' : rpe <= 8 ? 'Muy duro' : 'Máximo esfuerzo'}
          </p>
        </div>

        {/* Tiempo real */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>
            Duración real (min)
          </label>
          <input
            type="number"
            value={tiempoReal}
            onChange={e => setTiempoReal(e.target.value)}
            placeholder={`${sesion.duracion_min} min`}
            style={{
              width: '100%',
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              padding: '10px 12px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Distancia real */}
        {mostrarDistancia && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>
              Distancia real (km)
            </label>
            <input
              type="number"
              step="0.1"
              value={distanciaReal}
              onChange={e => setDistanciaReal(e.target.value)}
              placeholder={sesion.distancia_km ? `${sesion.distancia_km} km` : 'Opcional'}
              style={{
                width: '100%',
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                padding: '10px 12px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* FC media */}
        {mostrarFc && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>
              FC media (ppm)
            </label>
            <input
              type="number"
              value={fcMedia}
              onChange={e => setFcMedia(e.target.value)}
              placeholder="ej: 145"
              style={{
                width: '100%',
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                padding: '10px 12px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Notas */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="¿Algo que quieras recordar de esta sesión?"
            rows={2}
            style={{
              width: '100%',
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              padding: '10px 12px',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => guardar(false)}
            disabled={saving}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Guardando...' : 'Guardar sesión'}
          </button>
          <button
            onClick={() => guardar(true)}
            disabled={saving}
            style={{
              background: 'transparent',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px',
              fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Solo marcar completada
          </button>
        </div>
      </div>
    </div>
  )
}
