import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StravaConnect from './StravaConnect'

// ─── Datos estáticos ──────────────────────────────────────────────────────────

const DEPORTES = [
  { value: 'triatlon', label: 'Triatlón', emoji: '🏊🚴🏃', desc: 'Natación, ciclismo y running' },
  { value: 'running', label: 'Running', emoji: '🏃', desc: 'Carreras populares y trail' },
  { value: 'hyrox', label: 'Hyrox', emoji: '💪', desc: 'Carrera funcional con estaciones' },
]

const NIVELES = [
  { value: 'principiante', label: 'Principiante', emoji: '🌱', desc: 'Empiezo a entrenar' },
  { value: 'intermedio', label: 'Intermedio', emoji: '🔥', desc: 'Entreno regularmente' },
  { value: 'avanzado', label: 'Avanzado', emoji: '⚡', desc: 'Compito y me exijo' },
]

const PERSONALIDADES = [
  { value: 'cercano', label: '😊 Cercano', desc: 'Empático y motivador' },
  { value: 'estricto', label: '💪 Estricto', desc: 'Directo y exigente' },
  { value: 'gracioso', label: '😄 Gracioso', desc: 'Con humor y energía' },
  { value: 'motivador', label: '🔥 Motivador', desc: 'Intenso y positivo' },
]

const TIPOS_CARRERA = {
  triatlon: ['Sprint', 'Olímpico', '70.3', 'Ironman'],
  running: ['5K', '10K', 'Media Maratón', 'Maratón', 'Trail'],
  hyrox: ['Hyrox Individual', 'Hyrox Dobles'],
}

function getTipos(deporte) {
  const base = TIPOS_CARRERA[deporte]
    || [...TIPOS_CARRERA.running, ...TIPOS_CARRERA.triatlon, ...TIPOS_CARRERA.hyrox]
  return [...base, 'Otro']
}

const EQUIPAMIENTO_OPTIONS = [
  { value: 'piscina', label: '🏊 Piscina' },
  { value: 'bici_carretera', label: '🚴 Bici de carretera' },
  { value: 'bici_montana', label: '🚵 Bici de montaña / gravel' },
  { value: 'gimnasio', label: '🏋️ Gimnasio' },
  { value: 'cinta', label: '🏃 Cinta de correr' },
  { value: 'pesas_casa', label: '💪 Pesas en casa' },
  { value: 'bandas', label: '🎽 Bandas elásticas' },
  { value: 'pulsometro', label: '❤️ Monitor de frecuencia cardíaca' },
  { value: 'reloj_gps', label: '⌚ Reloj GPS' },
  { value: 'rodillo', label: '🔵 Rodillo / trainer' },
]

const DIAS_SLOTS = [
  ['Lunes mañana', 'Lunes tarde'],
  ['Martes mañana', 'Martes tarde'],
  ['Miércoles mañana', 'Miércoles tarde'],
  ['Jueves mañana', 'Jueves tarde'],
  ['Viernes mañana', 'Viernes tarde'],
  ['Sábado mañana', 'Sábado tarde'],
  ['Domingo mañana', 'Domingo tarde'],
]

const TOTAL_STEPS = 8

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 36 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i + 1 === current ? 24 : 8,
          height: 8,
          borderRadius: 4,
          background: i + 1 === current
            ? 'var(--primary)'
            : i + 1 < current
              ? 'oklch(0.7 0.18 45 / 0.4)'
              : 'var(--secondary)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  )
}

function OptionCard({ selected, onClick, emoji, label, desc, small }) {
  return (
    <button onClick={onClick} style={{
      width: '100%',
      background: selected ? 'oklch(0.7 0.18 45 / 0.12)' : 'var(--card)',
      border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: small ? '12px 14px' : '16px 20px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: emoji ? 14 : 0,
      transition: 'border-color 0.15s, background 0.15s',
      fontFamily: 'var(--font-sans)',
    }}>
      {emoji && <span style={{ fontSize: small ? 20 : 28, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: small ? 14 : 15, color: selected ? 'var(--primary)' : 'var(--foreground)' }}>
          {label}
        </div>
        {desc && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{desc}</div>}
      </div>
      {selected && <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 16, marginLeft: 'auto', flexShrink: 0 }}>✓</span>}
    </button>
  )
}

function Toggle({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'oklch(0.7 0.18 45 / 0.2)' : 'var(--card)',
      border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
      color: active ? 'var(--primary)' : 'var(--foreground)',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.12s',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

function IntegracionCard({ logo, nombre, desc, badge, badgeColor, children, disabled }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      opacity: disabled ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {logo}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{nombre}</span>
            {badge && (
              <span style={{
                background: badgeColor || 'var(--secondary)',
                color: badgeColor ? 'oklch(0.13 0.01 60)' : 'var(--muted-foreground)',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 600,
              }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Estilos comunes ─────────────────────────────────────────────────────────

const INPUT_STYLE = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  padding: '12px 16px',
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'none',
}

const PRIMARY_BTN = {
  width: '100%',
  height: 52,
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 8,
}

const BACK_BTN = {
  background: 'none',
  border: 'none',
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  cursor: 'pointer',
  padding: '10px 0 0',
  width: '100%',
  textAlign: 'center',
}

const SKIP_BTN = {
  background: 'none',
  border: 'none',
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '8px 0 0',
  width: '100%',
  textAlign: 'center',
  textDecoration: 'underline',
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nombre: '',
    deporte: '',
    nivel: '',
    personalidad: 'cercano',
    nombre_coach: '',
    historial_deportivo: '',
    lesiones: '',
    equipamiento: [],
  })
  const [carreras, setCarreras] = useState([])
  const [disponibilidadSlots, setDisponibilidadSlots] = useState([])
  const [sinLesiones, setSinLesiones] = useState(false)
  const [nuevaCarrera, setNuevaCarrera] = useState({ nombre: '', tipo: '', fecha: '' })

  // Si volvemos del OAuth de Strava, saltar al paso de integraciones
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('state') === 'strava') {
      setStep(8)
    }
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const handleSelect = (field, value) => setForm({ ...form, [field]: value })

  const toggleSlot = (slot) =>
    setDisponibilidadSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    )

  const toggleEquip = (value) =>
    setForm(prev => ({
      ...prev,
      equipamiento: prev.equipamiento.includes(value)
        ? prev.equipamiento.filter(e => e !== value)
        : [...prev.equipamiento, value],
    }))

  const addCarrera = () => {
    if (!nuevaCarrera.nombre || !nuevaCarrera.tipo) return
    setCarreras(prev => [...prev, { ...nuevaCarrera }])
    setNuevaCarrera({ nombre: '', tipo: '', fecha: '' })
  }

  const handleSubmit = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Sesión en onboarding:', session)

    const { error } = await supabase
      .from('profiles')
      .update({
        ...form,
        nombre_coach: form.nombre_coach || 'Coach',
        lesiones: sinLesiones ? 'Sin lesiones actuales' : form.lesiones,
        disponibilidad: disponibilidadSlots.join(', '),
        carreras,
      })
      .eq('id', userId)

    console.log('Error al actualizar:', error)
    if (!error) onComplete()
  }

  const heading = (text) => (
    <h2 style={{
      fontFamily: 'var(--font-serif)',
      fontSize: 28,
      fontWeight: 700,
      marginBottom: 8,
      textAlign: 'center',
    }}>
      {text}
    </h2>
  )

  const subheading = (text) => (
    <p style={{
      color: 'var(--muted-foreground)',
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 32,
    }}>
      {text}
    </p>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '48px 16px 60px',
    }}>
      <div key={step} className="step-animate" style={{ width: '100%', maxWidth: 480 }}>
        <ProgressDots current={step} total={TOTAL_STEPS} />

        {/* ── Paso 1: Nombre ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            {heading('¿Cómo te llamas?')}
            {subheading('Así me dirigiré a ti durante los entrenamientos')}
            <input
              name="nombre"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={handleChange}
              style={INPUT_STYLE}
              autoFocus
            />
            <button onClick={() => setStep(2)} style={{ ...PRIMARY_BTN, marginTop: 24 }}>
              Siguiente
            </button>
          </div>
        )}

        {/* ── Paso 2: Deporte ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            {heading('¿Qué deporte practicas?')}
            {subheading('Tu coach se especializará en tu disciplina')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {DEPORTES.map(d => (
                <OptionCard
                  key={d.value}
                  selected={form.deporte === d.value}
                  onClick={() => handleSelect('deporte', d.value)}
                  emoji={d.emoji}
                  label={d.label}
                  desc={d.desc}
                />
              ))}
            </div>
            <button onClick={() => setStep(3)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(1)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 3: Nivel ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            {heading('¿Cuál es tu nivel?')}
            {subheading('Adaptaremos la intensidad a ti')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {NIVELES.map(n => (
                <OptionCard
                  key={n.value}
                  selected={form.nivel === n.value}
                  onClick={() => handleSelect('nivel', n.value)}
                  emoji={n.emoji}
                  label={n.label}
                  desc={n.desc}
                />
              ))}
            </div>
            <button onClick={() => setStep(4)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(2)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 4: Carreras ───────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            {heading('¿Cuáles son tus próximas carreras?')}
            {subheading('Puedes añadir varias — adaptaremos el plan a cada objetivo')}

            {/* Lista de carreras añadidas */}
            {carreras.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {carreras.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    marginBottom: 6,
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre}</span>
                      <span style={{ color: 'var(--primary)', fontSize: 12, marginLeft: 8 }}>{c.tipo}</span>
                      {c.fecha && <span style={{ color: 'var(--muted-foreground)', fontSize: 12, marginLeft: 8 }}>{c.fecha}</span>}
                    </div>
                    <button
                      onClick={() => setCarreras(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario añadir carrera */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <input
                placeholder="Nombre de la carrera (ej: Media Maratón Valencia)"
                value={nuevaCarrera.nombre}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, nombre: e.target.value })}
                style={INPUT_STYLE}
              />
              <select
                value={nuevaCarrera.tipo}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, tipo: e.target.value })}
                style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
              >
                <option value="">Tipo de carrera...</option>
                {getTipos(form.deporte).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="date"
                value={nuevaCarrera.fecha}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, fecha: e.target.value })}
                style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
              />
              <button
                onClick={addCarrera}
                style={{
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '10px',
                  cursor: 'pointer',
                }}
              >
                + Añadir carrera
              </button>
            </div>

            <button onClick={() => setStep(5)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(5)} style={SKIP_BTN}>Saltar por ahora</button>
            <button onClick={() => setStep(3)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 5: Contexto personal ──────────────────────────────────── */}
        {step === 5 && (
          <div>
            {heading('Cuéntanos un poco más')}
            {subheading('Esto ayuda al coach a personalizar tu entrenamiento')}

            {/* A. Historial deportivo */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Historial deportivo
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  name="historial_deportivo"
                  placeholder="Ej: Llevo 2 años corriendo, completé mi primera media maratón en 2024..."
                  value={form.historial_deportivo}
                  onChange={e => {
                    if (e.target.value.length <= 300) handleChange(e)
                  }}
                  rows={3}
                  style={{ ...INPUT_STYLE, display: 'block' }}
                />
                <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {form.historial_deportivo.length}/300
                </span>
              </div>
            </div>

            {/* B. Lesiones */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Lesiones o limitaciones
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sinLesiones}
                  onChange={e => setSinLesiones(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No tengo lesiones actuales</span>
              </label>
              {!sinLesiones && (
                <div style={{ position: 'relative' }}>
                  <textarea
                    name="lesiones"
                    placeholder="Ej: Tengo molestias en la rodilla derecha cuando corro más de 10km..."
                    value={form.lesiones}
                    onChange={e => {
                      if (e.target.value.length <= 300) handleChange(e)
                    }}
                    rows={3}
                    style={{ ...INPUT_STYLE, display: 'block' }}
                  />
                  <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {form.lesiones.length}/300
                  </span>
                </div>
              )}
            </div>

            {/* C. Disponibilidad */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                ¿Cuándo puedes entrenar?
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DIAS_SLOTS.map(([man, tar]) => (
                  <div key={man} style={{ display: 'flex', gap: 6 }}>
                    <Toggle active={disponibilidadSlots.includes(man)} onClick={() => toggleSlot(man)} label={man} />
                    <Toggle active={disponibilidadSlots.includes(tar)} onClick={() => toggleSlot(tar)} label={tar} />
                  </div>
                ))}
              </div>
            </div>

            {/* D. Equipamiento */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                ¿Con qué cuentas para entrenar?
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EQUIPAMIENTO_OPTIONS.map(opt => (
                  <Toggle
                    key={opt.value}
                    active={form.equipamiento.includes(opt.value)}
                    onClick={() => toggleEquip(opt.value)}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            <button onClick={() => setStep(6)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(6)} style={SKIP_BTN}>Saltar</button>
            <button onClick={() => setStep(4)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 6: Personalidad del coach ────────────────────────────── */}
        {step === 6 && (
          <div>
            {heading('Tu coach ideal')}
            {subheading('¿Cómo quieres que sea tu entrenador?')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {PERSONALIDADES.map(p => (
                <OptionCard
                  key={p.value}
                  selected={form.personalidad === p.value}
                  onClick={() => handleSelect('personalidad', p.value)}
                  emoji={null}
                  label={p.label}
                  desc={p.desc}
                  small
                />
              ))}
            </div>
            <button onClick={() => setStep(7)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(5)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 7: Nombre del coach ───────────────────────────────────── */}
        {step === 7 && (
          <div>
            {heading('¿Cómo quieres llamar a tu coach?')}
            {subheading('Dale personalidad a tu entrenador')}

            {/* Chips de nombres sugeridos */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {['Javi', 'Alex', 'Sara', 'Marcos'].map(name => (
                <button
                  key={name}
                  onClick={() => handleSelect('nombre_coach', form.nombre_coach === name ? '' : name)}
                  style={{
                    background: form.nombre_coach === name ? 'oklch(0.7 0.18 45 / 0.12)' : 'var(--card)',
                    border: `2px solid ${form.nombre_coach === name ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 24,
                    padding: '10px 24px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: form.nombre_coach === name ? 'var(--primary)' : 'var(--foreground)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>

            <input
              placeholder="O escribe un nombre..."
              value={form.nombre_coach}
              onChange={e => handleSelect('nombre_coach', e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 24 }}
            />

            <button onClick={() => setStep(8)} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(6)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 8: Integraciones ──────────────────────────────────────── */}
        {step === 8 && (
          <div>
            {heading('Conecta tus apps')}
            {subheading('Para que el coach conozca tus entrenamientos reales')}

            {/* Strava */}
            <IntegracionCard
              logo={
                <div style={{
                  width: 36, height: 36, background: '#FC4C02', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg viewBox="0 0 40 64" width="18" height="28" fill="white">
                    <path d="M18 4L2 36h11l5-10 5 10h11zm10 22L17 50h11l4-8.5 4 8.5h10L18 4z" />
                  </svg>
                </div>
              }
              nombre="Strava"
              desc="Importa tus actividades automáticamente"
            >
              <StravaConnect userId={userId} />
            </IntegracionCard>

            {/* Apple Health — próximamente */}
            <IntegracionCard
              disabled
              logo={<div style={{ width: 36, height: 36, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⌚</div>}
              nombre="Apple Health"
              desc="Pasos, sueño y frecuencia cardíaca"
              badge="Próximamente"
            >
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Próximamente</span>
            </IntegracionCard>

            {/* Garmin — próximamente */}
            <IntegracionCard
              disabled
              logo={<div style={{ width: 36, height: 36, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⌚</div>}
              nombre="Garmin Connect"
              desc="Sincroniza tus actividades de Garmin"
              badge="Próximamente"
            >
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Próximamente</span>
            </IntegracionCard>

            {/* Intervals.icu — próximamente Pro */}
            <IntegracionCard
              disabled
              logo={<div style={{ width: 36, height: 36, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📊</div>}
              nombre="Intervals.icu"
              desc="Análisis avanzado y envío al reloj"
              badge="Próximamente · Pro"
              badgeColor="var(--primary)"
            >
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Pro</span>
            </IntegracionCard>

            <button onClick={handleSubmit} style={{ ...PRIMARY_BTN, marginTop: 16 }}>
              ¡Empezar a entrenar!
            </button>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              Puedes conectar estas apps en cualquier momento desde tu perfil
            </p>
            <button onClick={() => setStep(7)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

      </div>
    </div>
  )
}
