import { useState } from 'react'
import { supabase } from '../lib/supabase'

const RPE_COLORS = {
  1: '#22c55e', 2: '#22c55e', 3: '#22c55e',
  4: '#eab308', 5: '#eab308', 6: '#eab308',
  7: '#f97316', 8: '#f97316',
  9: '#ef4444', 10: '#ef4444',
}

const TIPOS_SIN_DISTANCIA = new Set(['Fuerza', 'Descanso'])

async function patchSesionCompleta(planId, dia, campos) {
  const { data: plan } = await supabase
    .from('plans')
    .select('sesiones, volumen_real_min')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) throw new Error('Plan no encontrado')

  const sesionesActualizadas = plan.sesiones.map(s =>
    s.dia === dia ? { ...s, completada: true, ...campos } : s
  )

  const volumenReal = sesionesActualizadas
    .filter(s => s.completada && s.tipo?.toLowerCase() !== 'descanso')
    .reduce((acc, s) => acc + (s.tiempo_real_min || s.duracion_min || 0), 0)

  const { data } = await supabase
    .from('plans')
    .update({ sesiones: sesionesActualizadas, volumen_real_min: volumenReal })
    .eq('id', planId)
    .select()
    .maybeSingle()

  return data
}

export default function ModalCompletarSesion({ sesion, planId, profile, onClose, onComplete }) {
  const [rpe, setRpe] = useState(sesion.estructura?.rpe_objetivo
    ? parseInt(sesion.estructura.rpe_objetivo.split('-')[0], 10) || 6
    : 6)
  const [tiempoReal, setTiempoReal] = useState(sesion.duracion_min || '')
  const [distanciaReal, setDistanciaReal] = useState(sesion.distancia_km || '')
  const [fcMedia, setFcMedia] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const mostrarDistancia = !TIPOS_SIN_DISTANCIA.has(sesion.tipo)
  const mostrarFc = !!profile?.fc_maxima

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
      const updated = await patchSesionCompleta(planId, sesion.dia, campos)
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
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 20 }}>
          {sesion.dia} · {sesion.duracion_min} min planificados
        </p>

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
