import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = {
  display: 'block',
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  padding: '9px 12px',
  marginTop: 6,
  marginBottom: 14,
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: 'var(--muted-foreground)',
  fontWeight: 500,
}

export default function EditProfile({ profile, onUpdate, onClose, onShowUpgrade }) {
  const [nombre, setNombre] = useState(profile.nombre || '')
  const [deporte, setDeporte] = useState(profile.deporte || '')
  const [nivel, setNivel] = useState(profile.nivel || '')
  const [objetivo, setObjetivo] = useState(profile.objetivo || '')
  const [fechaCarrera, setFechaCarrera] = useState(profile.fecha_carrera || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ nombre, deporte, nivel, objetivo, fecha_carrera: fechaCarrera })
      .eq('id', profile.id)
      .select()
      .single()

    if (!error) onUpdate(data)
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tricoach-secret': import.meta.env.VITE_TRICOACH_SECRET || ''
        },
        body: JSON.stringify({ userId: profile.id })
      })
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error borrando cuenta:', error)
    } finally {
      setDeleting(false)
    }
  }

  const esFree = !profile?.plan || profile?.plan === 'free'

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Upgrade banner */}
      {esFree && onShowUpgrade && (
        <div style={{
          background: 'oklch(0.7 0.18 45 / 0.1)',
          border: '1px solid oklch(0.7 0.18 45 / 0.4)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px',
          marginBottom: 12,
        }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', marginBottom: 4 }}>
            Estás en el plan gratuito
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
            Hazte Pro y desbloquea planes adaptativos con Strava, 150 mensajes/día y mucho más
          </p>
          <button
            onClick={onShowUpgrade}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 24,
              padding: '10px 20px',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hazte Pro — 9,99€/mes
          </button>
        </div>
      )}

      {/* Datos del perfil */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14, fontWeight: 600 }}>Datos del perfil</p>

        {profile?.plan === 'pro' && (
          <span style={{
            display: 'inline-block',
            background: 'oklch(0.7 0.18 45 / 0.2)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 14,
          }}>
            ✦ Pro
          </span>
        )}

        <label style={labelStyle}>Nombre</label>
        <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} />

        <label style={labelStyle}>Deporte</label>
        <select style={inputStyle} value={deporte} onChange={e => setDeporte(e.target.value)}>
          <option value="triatlon">🏊 Triatlón</option>
          <option value="running">🏃 Running</option>
          <option value="hyrox">💪 Hyrox</option>
        </select>

        <label style={labelStyle}>Nivel</label>
        <select style={inputStyle} value={nivel} onChange={e => setNivel(e.target.value)}>
          <option value="principiante">Principiante</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
        </select>

        <label style={labelStyle}>Objetivo</label>
        <input style={inputStyle} value={objetivo} onChange={e => setObjetivo(e.target.value)} />

        <label style={labelStyle}>Fecha de carrera</label>
        <input type="date" style={{ ...inputStyle, marginBottom: 20 }} value={fechaCarrera} onChange={e => setFechaCarrera(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving || deleting}
            style={{
              background: 'var(--secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            style={{
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--primary-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 20px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Zona de peligro */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          Zona de peligro — esta acción es irreversible.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              background: 'none',
              border: '1px solid var(--destructive)',
              borderRadius: 8,
              color: 'var(--destructive)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--destructive)', marginBottom: 10 }}>
              ¿Seguro? Se borrarán todos tus datos y conversaciones.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                style={{
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  padding: '7px 14px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--destructive-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 14px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar cuenta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
