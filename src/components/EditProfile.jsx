import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EditProfile({ profile, onUpdate, onClose }) {
  const [nombre, setNombre] = useState(profile.nombre || '')
  const [deporte, setDeporte] = useState(profile.deporte || '')
  const [nivel, setNivel] = useState(profile.nivel || '')
  const [objetivo, setObjetivo] = useState(profile.objetivo || '')
  const [fechaCarrera, setFechaCarrera] = useState(profile.fecha_carrera || '')
  const [saving, setSaving] = useState(false)

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
          <button onClick={onClose} disabled={saving}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: '#0070f3', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}