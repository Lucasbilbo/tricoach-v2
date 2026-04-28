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

const DEPORTES_EDIT = [
  { value: 'triatlon', label: '🏊 Triatlón' },
  { value: 'running', label: '🏃 Running' },
  { value: 'natacion', label: '🏊 Natación' },
  { value: 'hyrox', label: '💪 Hyrox' },
]

function initDeportesSeleccionados(profile) {
  if (profile.deportes && profile.deportes.length > 0) {
    return profile.deportes.map(d => d.deporte || d)
  }
  return profile.deporte ? [profile.deporte] : []
}

function carreraAHaCambiado(prevCarreras, nextCarreras) {
  const prevA = (prevCarreras || []).find(c => c.prioridad === 'A')
  const nextA = (nextCarreras || []).find(c => c.prioridad === 'A')
  if (!prevA && !nextA) return false
  if (!prevA || !nextA) return true
  return prevA.fecha !== nextA.fecha || prevA.nombre !== nextA.nombre
}

export default function EditProfile({ profile, onUpdate, onClose, onShowUpgrade, onCycleUpdated }) {
  const [nombre, setNombre] = useState(profile.nombre || '')
  const [deporte, setDeporte] = useState(profile.deporte || '')
  const [deportesSeleccionados, setDeportesSeleccionados] = useState(() => initDeportesSeleccionados(profile))
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
  // Intervals.icu
  const [pace5k, setPace5k] = useState(profile.pace_5k || '')
  const [pace10k, setPace10k] = useState(profile.pace_10k || '')
  const [ftpBici, setFtpBici] = useState(profile.ftp_bici || '')
  const [ritmoNatacion, setRitmoNatacion] = useState(profile.ritmo_natacion_100m || '')
  const [intervalsAthleteId, setIntervalsAthleteId] = useState(profile.intervals_athlete_id || '')
  const [intervalsApiKey, setIntervalsApiKey] = useState(profile.intervals_api_key || '')
  const [showIntervalsKey, setShowIntervalsKey] = useState(false)
  const [intervalsSaving, setIntervalsSaving] = useState(false)
  const [intervalsConnected, setIntervalsConnected] = useState(!!(profile.intervals_athlete_id && profile.intervals_api_key))
  const [carreras, setCarreras] = useState(profile.carreras || [])
  const [saving, setSaving] = useState(false)
  const [savingRendimiento, setSavingRendimiento] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState(null) // { msg, type: 'success'|'error' }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave() {
    setSaving(true)
    const deportesParaGuardar = deportesSeleccionados.map(d => ({
      deporte: d,
      nivel: profile.deportes?.find(x => (x.deporte || x) === d)?.nivel || nivel,
    }))
    const { data, error } = await supabase
      .from('profiles')
      .update({
        nombre,
        deporte: deportesSeleccionados[0] || deporte,
        deportes: deportesParaGuardar.length > 0 ? deportesParaGuardar : null,
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
        carreras: carreras.length > 0 ? carreras : null,
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

    // Recalcular ciclo si cambió la carrera A
    if (onCycleUpdated && carreraAHaCambiado(profile.carreras, carreras)) {
      const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
      fetch('/.netlify/functions/recalculate-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tricoach-secret': secret },
        body: JSON.stringify({ userId: profile.id }),
      })
        .then(r => r.json())
        .then(res => {
          if (res.cycle) {
            onCycleUpdated(res.cycle)
            showToast('Tu plan de temporada se ha actualizado con la nueva fecha de carrera', 'success')
          }
        })
        .catch(err => console.error('[EditProfile] recalculate-cycle error:', err))
      return // toast shown async above
    }

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

  async function handleSaveIntervals() {
    setIntervalsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ intervals_athlete_id: intervalsAthleteId || null, intervals_api_key: intervalsApiKey || null })
      .eq('id', profile.id)
    setIntervalsSaving(false)
    if (error) {
      showToast('Error al guardar. Inténtalo de nuevo.', 'error')
      return
    }
    setIntervalsConnected(!!(intervalsAthleteId && intervalsApiKey))
    showToast('Intervals.icu guardado', 'success')
  }

  async function handleSaveRendimiento() {
    setSavingRendimiento(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        fc_maxima: fcMaxima !== '' ? parseInt(fcMaxima) : null,
        pace_5k: pace5k || null,
        pace_10k: pace10k || null,
        ftp_bici: ftpBici !== '' ? parseInt(ftpBici) : null,
        ritmo_natacion_100m: ritmoNatacion || null,
      })
      .eq('id', profile.id)
      .select()
      .single()
    setSavingRendimiento(false)
    if (error) {
      console.error('[EditProfile] Error al guardar rendimiento:', error)
      showToast('Error al guardar. Inténtalo de nuevo.', 'error')
      return
    }
    onUpdate(data)
    showToast('Datos de rendimiento guardados', 'success')
  }

  async function handleDisconnectIntervals() {
    setIntervalsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ intervals_athlete_id: null, intervals_api_key: null })
      .eq('id', profile.id)
    setIntervalsSaving(false)
    if (!error) {
      setIntervalsAthleteId('')
      setIntervalsApiKey('')
      setIntervalsConnected(false)
      showToast('Intervals.icu desconectado', 'success')
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

        <label style={labelStyle}>Deportes</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {DEPORTES_EDIT.map(({ value, label }) => {
            const checked = deportesSeleccionados.includes(value)
            return (
              <label key={value} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '8px 12px',
                background: checked ? 'oklch(0.7 0.18 45 / 0.1)' : 'var(--secondary)',
                border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 8,
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...deportesSeleccionados, value]
                      : deportesSeleccionados.filter(d => d !== value)
                    setDeportesSeleccionados(next)
                    if (next.length > 0) setDeporte(next[0])
                  }}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }}
                />
                <span style={{ fontSize: 14, fontWeight: checked ? 600 : 400, color: checked ? 'var(--primary)' : 'var(--foreground)' }}>
                  {label}
                </span>
              </label>
            )
          })}
        </div>

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

        {/* Carreras con prioridad A/B/C */}
        {carreras.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Carreras</p>
            {carreras.map((c, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: 6,
                gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.nombre}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', flexShrink: 0,
                      background: c.prioridad === 'A' ? 'oklch(0.25 0.08 145)' : c.prioridad === 'C' ? 'oklch(0.22 0 0)' : 'oklch(0.22 0.06 240)',
                      color: c.prioridad === 'A' ? 'oklch(0.8 0.15 145)' : c.prioridad === 'C' ? 'var(--muted-foreground)' : 'oklch(0.75 0.12 240)',
                      border: `1px solid ${c.prioridad === 'A' ? 'oklch(0.4 0.1 145)' : c.prioridad === 'C' ? 'var(--border)' : 'oklch(0.38 0.1 240)'}`,
                    }}>
                      {c.prioridad === 'A' ? 'Objetivo A' : c.prioridad === 'C' ? 'Entrenamiento C' : 'Secundaria B'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{c.tipo}{c.fecha ? ` · ${c.fecha}` : ''}</p>
                </div>
                <select
                  value={c.prioridad || 'A'}
                  onChange={e => setCarreras(prev => prev.map((r, idx) => idx === i ? { ...r, prioridad: e.target.value } : r))}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--foreground)', fontFamily: 'var(--font-sans)', fontSize: 12,
                    padding: '4px 6px', cursor: 'pointer', colorScheme: 'dark', flexShrink: 0,
                  }}
                >
                  <option value="A">A · Objetivo</option>
                  <option value="B">B · Secundaria</option>
                  <option value="C">C · Entrenamiento</option>
                </select>
              </div>
            ))}
          </div>
        )}

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

      {/* Datos de rendimiento */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8, fontWeight: 600 }}>
          ⚡ Datos de rendimiento
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
          Estos datos permiten al coach calcular tus zonas de entrenamiento exactas. Cuantos más rellenes, más precisas serán las sesiones y los consejos.
        </p>

        {!fcMaxima && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'oklch(0.7 0.18 45 / 0.12)',
            border: '1px solid oklch(0.7 0.18 45 / 0.4)',
            color: 'oklch(0.65 0.18 45)',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}>
            ⚡ Añade tu FC máxima para personalizar las zonas
          </div>
        )}

        <label style={labelStyle}>FC máxima (bpm)</label>
        <input
          type="number"
          min={150}
          max={220}
          style={{ ...inputStyle, marginBottom: 4 }}
          value={fcMaxima}
          onChange={e => setFcMaxima(e.target.value)}
          placeholder="Ej: 185"
        />
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, marginTop: 0 }}>
          Si no la sabes, haz un test de 20min a máximo esfuerzo
        </p>

        <label style={labelStyle}>Pace 5K (min:seg/km)</label>
        <input
          style={{ ...inputStyle, marginBottom: 4 }}
          value={pace5k}
          onChange={e => setPace5k(e.target.value)}
          placeholder="Ej: 4:30"
        />
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, marginTop: 0 }}>
          Tu mejor tiempo reciente en 5K
        </p>

        <label style={labelStyle}>Pace 10K (min:seg/km)</label>
        <input
          style={inputStyle}
          value={pace10k}
          onChange={e => setPace10k(e.target.value)}
          placeholder="Ej: 4:50"
        />

        {deportesSeleccionados.includes('triatlon') && (
          <>
            <label style={labelStyle}>FTP bici (vatios)</label>
            <input
              type="number"
              min={50}
              max={600}
              style={inputStyle}
              value={ftpBici}
              onChange={e => setFtpBici(e.target.value)}
              placeholder="Ej: 220"
            />
          </>
        )}

        {(deportesSeleccionados.includes('triatlon') || deportesSeleccionados.includes('natacion')) && (
          <>
            <label style={labelStyle}>Ritmo natación cada 100m (min:seg)</label>
            <input
              style={inputStyle}
              value={ritmoNatacion}
              onChange={e => setRitmoNatacion(e.target.value)}
              placeholder="Ej: 1:45"
            />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={handleSaveRendimiento}
            disabled={savingRendimiento}
            style={{
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--primary-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 20px',
              cursor: savingRendimiento ? 'not-allowed' : 'pointer',
            }}
          >
            {savingRendimiento ? 'Guardando...' : 'Guardar datos de rendimiento'}
          </button>
        </div>
      </div>

      {/* Strava disconnect */}
      {profile.strava_token && (
        <StravaDisconnect userId={profile.id} onDisconnected={() => {}} />
      )}

      {/* Intervals.icu — solo Pro */}
      {!esFree && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 12,
        }}>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14, fontWeight: 600 }}>
            ⌚ Intervals.icu
          </p>
          {intervalsConnected ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#10B981', fontWeight: 600 }}>
                ✓ Intervals conectado
              </span>
              <button
                onClick={handleDisconnectIntervals}
                disabled={intervalsSaving}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  padding: '6px 14px',
                  cursor: intervalsSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {intervalsSaving ? '...' : 'Desconectar'}
              </button>
            </div>
          ) : (
            <>
              <label style={labelStyle}>Athlete ID</label>
              <input
                style={inputStyle}
                value={intervalsAthleteId}
                onChange={e => setIntervalsAthleteId(e.target.value)}
                placeholder="Ej: i524242"
              />
              <label style={labelStyle}>API Key</label>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                <input
                  type={showIntervalsKey ? 'text' : 'password'}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }}
                  value={intervalsApiKey}
                  onChange={e => setIntervalsApiKey(e.target.value)}
                  placeholder="Tu API key de Intervals.icu"
                />
                <button
                  type="button"
                  onClick={() => setShowIntervalsKey(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    color: 'var(--muted-foreground)',
                    padding: 4,
                  }}
                >
                  {showIntervalsKey ? '🙈' : '👁'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, marginTop: 6 }}>
                Encuéntralo en intervals.icu → Settings → API
              </p>
              <button
                onClick={handleSaveIntervals}
                disabled={intervalsSaving || !intervalsAthleteId || !intervalsApiKey}
                style={{
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--primary-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 20px',
                  cursor: (intervalsSaving || !intervalsAthleteId || !intervalsApiKey) ? 'not-allowed' : 'pointer',
                  opacity: (!intervalsAthleteId || !intervalsApiKey) ? 0.5 : 1,
                }}
              >
                {intervalsSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
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
