import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EditProfile({ profile, onUpdate, onClose }) {
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 32, width: 400 }}>
        <h3 style={{ marginBottom: 24 }}>Editar perfil</h3>

        <label>Nombre</label>
        <input style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
          value={nombre} onChange={e => setNombre(e.target.value)} />

        <label>Deporte</label>
        <select style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
          value={deporte} onChange={e => setDeporte(e.target.value)}>
          <option value="triatlon">🏊 Triatlón</option>
          <option value="running">🏃 Running</option>
          <option value="hyrox">💪 Hyrox</option>
        </select>

        <label>Nivel</label>
        <select style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
          value={nivel} onChange={e => setNivel(e.target.value)}>
          <option value="principiante">Principiante</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
        </select>

        <label>Objetivo</label>
        <input style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}
          value={objetivo} onChange={e => setObjetivo(e.target.value)} />

        <label>Fecha de carrera</label>
        <input type="date" style={{ display: 'block', width: '100%', marginBottom: 24, padding: 8 }}
          value={fechaCarrera} onChange={e => setFechaCarrera(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving || deleting}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || deleting}
            style={{ background: '#0070f3', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        <hr style={{ margin: '24px 0' }} />

        <div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Zona de peligro — esta acción es irreversible.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}
            >
              Eliminar mi cuenta
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 8 }}>
                ¿Seguro? Se borrarán todos tus datos y conversaciones.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar cuenta'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}