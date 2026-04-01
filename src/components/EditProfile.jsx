import { useState } from 'react'
import { supabase } from '../lib/supabase'

function StravaDisconnect({ userId, onDisconnected }) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDisconnect() {
    setDisconnecting(true)
    const { error } = await supabase
      .from('profiles')
      .update({ strava_token: null, strava_refresh_token: null, strava_token_expires_at: null })
      .eq('id', userId)
    setDisconnecting(false)
    if (!error) {
      setDone(true)
      if (onDisconnected) onDisconnected()
    }
  }

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 16,
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: 14, color: done ? 'var(--muted-foreground)' : '#fc4c02', fontWeight: 600 }}>
        {done ? 'Strava desconectado' : '✓ Strava conectado'}
      </span>
      {!done && (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--muted-foreground)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            padding: '6px 14px',
            cursor: disconnecting ? 'not-allowed' : 'pointer',
          }}
        >
          {disconnecting ? '...' : 'Desconectar Strava'}
        </button>
      )}
    </div>
  )
}

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
  const [nombreCoach, setNombreCoach] = useState(profile.nombre_coach || '')
  const [historialDeportivo, setHistorialDeportivo] = useState(profile.historial_deportivo || '')
  const [lesiones, setLesiones] = useState(profile.lesiones || '')
  const [disponibilidad, setDisponibilidad] = useState(profile.disponibilidad || '')
  const [personalidad, setPersonalidad] = useState(profile.personalidad || 'cercano')
  const [edad, setEdad] = useState(profile.edad || '')
  const [fcMaxima, setFcMaxima] = useState(profile.fc_maxima || '')
  // Nutrición
  const [peso, setPeso] = useState(profile.peso || '')
  const [objetivoNutricional, setObjetivoNutricional] = useState(profile.objetivo_nutricional || '')
  const [preferenciasAlimentarias, setPreferenciasAlimentarias] = useState(profile.preferencias_alimentarias || '')
  const [intolerancias, setIntolerancias] = useState(profile.intolerancias || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState(null) // { msg, type: 'success'|'error' }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        nombre,
        deporte,
        nivel,
        objetivo,
        fecha_carrera: fechaCarrera,
        nombre_coach: nombreCoach,
        historial_deportivo: historialDeportivo,
        lesiones,
        disponibilidad,
        personalidad,
        edad: edad !== '' ? parseInt(edad) : null,
        fc_maxima: fcMaxima !== '' ? parseInt(fcMaxima) : null,
        peso: peso !== '' ? parseFloat(peso) : null,
        objetivo_nutricional: objetivoNutricional || null,
        preferencias_alimentarias: preferenciasAlimentarias || null,
        intolerancias: intolerancias || null,
        // pass-through jsonb fields unchanged
        equipamiento: profile.equipamiento ?? null,
        carreras: profile.carreras ?? null,
        contexto: profile.contexto ?? null,
      })
      .eq('id', profile.id)
      .select()
      .single()

    setSaving(false)

    if (error) {
      console.error('[EditProfile] Error al guardar:', error)
      showToast('Error al guardar. Inténtalo de nuevo.', 'error')
      return
    }

    onUpdate(data)
    showToast('Perfil actualizado', 'success')
    setTimeout(() => onClose(), 1200)
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
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' ? 'oklch(0.45 0.2 140)' : 'var(--destructive)',
          color: '#fff',
          borderRadius: 'var(--radius)',
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
          zIndex: 200,
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 4px 20px oklch(0 0 0 / 0.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

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
        <input type="date" style={inputStyle} value={fechaCarrera} onChange={e => setFechaCarrera(e.target.value)} />

        <label style={labelStyle}>Nombre del coach</label>
        <input style={inputStyle} value={nombreCoach} onChange={e => setNombreCoach(e.target.value)} placeholder="Ej: Alex" />

        <label style={labelStyle}>Estilo del coach</label>
        <select style={inputStyle} value={personalidad} onChange={e => setPersonalidad(e.target.value)}>
          <option value="cercano">😊 Cercano</option>
          <option value="estricto">💪 Estricto</option>
          <option value="gracioso">😄 Gracioso</option>
          <option value="motivador">🔥 Motivador</option>
          <option value="cientifico">🔬 Científico</option>
        </select>

        <label style={labelStyle}>Historial deportivo</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
          value={historialDeportivo}
          onChange={e => setHistorialDeportivo(e.target.value)}
          placeholder="Ej: 3 años corriendo, primer triatlón en 2023..."
        />

        <label style={labelStyle}>Lesiones o limitaciones</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          value={lesiones}
          onChange={e => setLesiones(e.target.value)}
          placeholder="Ej: Tendinitis rodilla derecha, evitar impactos altos"
        />

        <label style={labelStyle}>Disponibilidad semanal</label>
        <input
          style={inputStyle}
          value={disponibilidad}
          onChange={e => setDisponibilidad(e.target.value)}
          placeholder="Ej: 8 horas/semana, mañanas entre semana"
        />

        <label style={labelStyle}>Edad</label>
        <input
          type="number"
          min={18}
          max={80}
          style={inputStyle}
          value={edad}
          onChange={e => setEdad(e.target.value)}
          placeholder="Tu edad"
        />

        <label style={labelStyle}>FC Máxima</label>
        <input
          type="number"
          min={150}
          max={220}
          style={{ ...inputStyle, marginBottom: 4 }}
          value={fcMaxima}
          onChange={e => setFcMaxima(e.target.value)}
          placeholder="Ej: 185 — de tu reloj Garmin"
        />
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 20, marginTop: 0 }}>
          Opcional. Si no la conoces, la estimamos con tu edad.
        </p>

        {/* Nutrición */}
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 14, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          🥗 Nutrición
        </p>

        <label style={labelStyle}>Peso actual (kg)</label>
        <input
          type="number"
          min={30}
          max={200}
          step={0.1}
          style={inputStyle}
          value={peso}
          onChange={e => setPeso(e.target.value)}
          placeholder="Ej: 72.5 — para personalizar gramos"
        />

        <label style={labelStyle}>Objetivo nutricional</label>
        <select style={inputStyle} value={objetivoNutricional} onChange={e => setObjetivoNutricional(e.target.value)}>
          <option value="">Sin preferencia</option>
          <option value="rendimiento">Rendimiento deportivo</option>
          <option value="perdida_grasa">Pérdida de grasa + rendimiento</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="ganancia_muscular">Ganancia muscular</option>
        </select>

        <label style={labelStyle}>Preferencias alimentarias</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          value={preferenciasAlimentarias}
          onChange={e => setPreferenciasAlimentarias(e.target.value)}
          placeholder="Ej: mediterránea, vegetariana, no me gusta el picante..."
        />

        <label style={labelStyle}>Intolerancias / alergias</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56, marginBottom: 20 }}
          value={intolerancias}
          onChange={e => setIntolerancias(e.target.value)}
          placeholder="Ej: intolerante al gluten, alérgico a los frutos secos..."
        />

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

      {/* Strava disconnect */}
      {profile.strava_token && (
        <StravaDisconnect userId={profile.id} onDisconnected={() => {}} />
      )}

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

      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <a
          href="https://tally.so/r/VL8pyl"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: 'var(--muted-foreground)', textDecoration: 'none' }}
        >
          ¿Algo no funciona? → Reportar problema
        </a>
      </div>
    </div>
  )
}
