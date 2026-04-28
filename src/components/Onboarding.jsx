import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StravaConnect from './StravaConnect'

// ─── Datos estáticos ──────────────────────────────────────────────────────────

const DEPORTES = [
  { value: 'triatlon', label: 'Triatlón', emoji: '🏊🚴🏃', desc: 'Natación, ciclismo y running' },
  { value: 'running', label: 'Running', emoji: '🏃', desc: 'Carreras populares y trail' },
  { value: 'natacion', label: 'Natación', emoji: '🏊', desc: 'Piscina, aguas abiertas, técnica' },
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
  natacion: ['100m', '200m', '400m', '800m', '1500m', 'Aguas abiertas 1km', 'Aguas abiertas 3km', 'Aguas abiertas 5km'],
  hyrox: ['Hyrox Individual', 'Hyrox Dobles'],
}

function getTipos(deporte, deportesArr) {
  if (deportesArr && deportesArr.length > 1) {
    const todos = new Set()
    deportesArr.forEach(d => {
      const tipos = TIPOS_CARRERA[d] || []
      tipos.forEach(t => todos.add(t))
    })
    return [...todos, 'Otro']
  }
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
  { value: 'otro', label: '✏️ Otro' },
]

function formatFecha(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha + 'T00:00:00')
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  const [deportes, setDeportes] = useState([])
  const [nivelesDeportes, setNivelesDeportes] = useState({})
  const [carreras, setCarreras] = useState([])
  const [disponibilidadSlots, setDisponibilidadSlots] = useState([])
  const [sinLesiones, setSinLesiones] = useState(false)
  const [nuevaCarrera, setNuevaCarrera] = useState({ nombre: '', tipo: '', dia: '', mes: '', anio: '', prioridad: 'A' })
  const [mostrarFormCarrera, setMostrarFormCarrera] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [otroEquipamiento, setOtroEquipamiento] = useState('')
  const [sinCarrera, setSinCarrera] = useState(false)
  const [errores, setErrores] = useState({ nombre: '', deportes: '', nivel: '', carreras: '', historial: '', disponibilidad: '', equipamiento: '' })
  const [erroresCarrera, setErroresCarrera] = useState({ nombre: '', tipo: '', fecha: '' })

  // Si volvemos del OAuth de Strava, saltar al paso de integraciones
  // Usar href.includes para compatibilidad con Safari móvil
  useEffect(() => {
    if (window.location.href.includes('state=strava')) {
      setStep(8)
    }
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const handleSelect = (field, value) => setForm({ ...form, [field]: value })

  const toggleDeporte = (value) => {
    const updated = deportes.includes(value)
      ? deportes.filter(d => d !== value)
      : [...deportes, value]
    setDeportes(updated)
    setForm(prev => ({ ...prev, deporte: updated[0] || '' }))
    if (updated.length > 0) setErrores(prev => ({ ...prev, deportes: '' }))
  }

  const toggleSlot = (slot) => {
    const nuevaDisponibilidad = disponibilidadSlots.includes(slot)
      ? disponibilidadSlots.filter(s => s !== slot)
      : [...disponibilidadSlots, slot]
    setDisponibilidadSlots(nuevaDisponibilidad)
    if (nuevaDisponibilidad.length > 0) {
      setErrores(prev => ({ ...prev, disponibilidad: '' }))
    }
  }

  const toggleEquip = (value) => {
    const nuevoEquipamiento = form.equipamiento.includes(value)
      ? form.equipamiento.filter(e => e !== value)
      : [...form.equipamiento, value]
    setForm(prev => ({ ...prev, equipamiento: nuevoEquipamiento }))
    if (nuevoEquipamiento.length > 0) {
      setErrores(prev => ({ ...prev, equipamiento: '' }))
    }
  }

  const addCarrera = () => {
    const errors = { nombre: '', tipo: '', fecha: '' }
    if (!nuevaCarrera.nombre.trim()) errors.nombre = 'El nombre es obligatorio'
    if (!nuevaCarrera.tipo) errors.tipo = 'Selecciona un tipo'
    if (!nuevaCarrera.dia || !nuevaCarrera.mes || !nuevaCarrera.anio) errors.fecha = 'Selecciona día, mes y año'
    if (!errors.nombre && !errors.tipo && !errors.fecha) {
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
      const mesIdx = meses.indexOf(nuevaCarrera.mes)
      const fechaCarrera = new Date(Number(nuevaCarrera.anio), mesIdx, Number(nuevaCarrera.dia))
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      if (fechaCarrera <= hoy) errors.fecha = 'La fecha de la carrera debe ser futura'
    }
    if (errors.nombre || errors.tipo || errors.fecha) {
      setErroresCarrera(errors)
      return
    }
    const fechaStr = `${nuevaCarrera.dia} ${nuevaCarrera.mes} ${nuevaCarrera.anio}`
    setErroresCarrera({ nombre: '', tipo: '', fecha: '' })
    const prioridadGuardada = nuevaCarrera.prioridad || 'A'
    setCarreras(prev => {
      const nuevas = [...prev, { nombre: nuevaCarrera.nombre, tipo: nuevaCarrera.tipo, fecha: fechaStr, prioridad: prioridadGuardada }]
      const yaHayA = nuevas.some(c => c.prioridad === 'A')
      setNuevaCarrera({ nombre: '', tipo: '', dia: '', mes: '', anio: '', prioridad: yaHayA ? 'B' : 'A' })
      return nuevas
    })
    setMostrarFormCarrera(false)
  }

  const handleSubmit = async () => {
    if (submitted) {
      onComplete()
      return
    }
    const equipamientoFinal = form.equipamiento.includes('otro') && otroEquipamiento
      ? [...form.equipamiento.filter(e => e !== 'otro'), otroEquipamiento]
      : form.equipamiento.filter(e => e !== 'otro')

    try {
      const deportesConNivel = deportes.map(d => ({
        deporte: d,
        nivel: nivelesDeportes[d] || form.nivel || 'principiante',
      }))
      const { error } = await supabase
        .from('profiles')
        .update({
          ...form,
          equipamiento: equipamientoFinal,
          nombre_coach: form.nombre_coach || 'Coach',
          lesiones: sinLesiones ? 'Sin lesiones actuales' : form.lesiones,
          disponibilidad: disponibilidadSlots.join(', '),
          carreras,
          deportes: deportesConNivel.length > 0 ? deportesConNivel : null,
        })
        .eq('id', userId)

      if (error) console.error('Error en handleSubmit:', error)
    } catch (e) {
      console.error('Exception en handleSubmit:', e)
    }
    setSubmitted(true)
    setGenerando(true)
    localStorage.setItem('onboarding_just_completed', form.nombre || 'atleta')
    onComplete()
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

  if (generando) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: 32,
    }}>
      <div style={{ fontSize: 48 }}>🏃</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, textAlign: 'center' }}>
        Preparando tu coach...
      </h2>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 15, textAlign: 'center' }}>
        Configurando tu perfil y ciclo de entrenamiento
      </p>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
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
              onChange={e => { handleChange(e); setErrores(prev => ({ ...prev, nombre: '' })) }}
              style={INPUT_STYLE}
              autoFocus
            />
            {errores.nombre && (
              <p style={{ color: 'var(--destructive)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>{errores.nombre}</p>
            )}
            <button onClick={() => {
              if (!form.nombre.trim()) {
                setErrores(prev => ({ ...prev, nombre: 'Tu nombre es obligatorio' }))
                return
              }
              setErrores(prev => ({ ...prev, nombre: '' }))
              setStep(2)
            }} style={{ ...PRIMARY_BTN, marginTop: 24 }}>
              Siguiente
            </button>
          </div>
        )}

        {/* ── Paso 2: Deportes (multi-select) ─────────────────────────────── */}
        {step === 2 && (
          <div>
            {heading('¿Qué deportes practicas?')}
            {subheading('Puedes seleccionar varios — el plan se adaptará a todos')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {DEPORTES.map(d => (
                <OptionCard
                  key={d.value}
                  selected={deportes.includes(d.value)}
                  onClick={() => toggleDeporte(d.value)}
                  emoji={d.emoji}
                  label={d.label}
                  desc={d.desc}
                />
              ))}
            </div>

            {/* Per-sport nivel when multiple selected */}
            {deportes.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Nivel por deporte
                </p>
                {deportes.map(dep => {
                  const deporteObj = DEPORTES.find(d => d.value === dep)
                  return (
                    <div key={dep} style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                        {deporteObj?.emoji} {deporteObj?.label}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {NIVELES.map(n => (
                          <button
                            key={n.value}
                            onClick={() => setNivelesDeportes(prev => ({ ...prev, [dep]: n.value }))}
                            style={{
                              flex: 1,
                              background: nivelesDeportes[dep] === n.value ? 'oklch(0.7 0.18 45 / 0.12)' : 'var(--card)',
                              border: `2px solid ${nivelesDeportes[dep] === n.value ? 'var(--primary)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius)',
                              padding: '10px 8px',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                              fontSize: 13,
                              fontWeight: nivelesDeportes[dep] === n.value ? 700 : 400,
                              color: nivelesDeportes[dep] === n.value ? 'var(--primary)' : 'var(--muted-foreground)',
                              textAlign: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            {n.emoji} {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {errores.deportes && (
              <p style={{ color: 'var(--destructive)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>{errores.deportes}</p>
            )}
            <button onClick={() => {
              if (deportes.length === 0) {
                setErrores(prev => ({ ...prev, deportes: 'Selecciona al menos un deporte para continuar' }))
                return
              }
              if (deportes.length > 1) {
                const sinNivel = deportes.filter(d => !nivelesDeportes[d])
                if (sinNivel.length > 0) {
                  setErrores(prev => ({ ...prev, deportes: 'Indica tu nivel en cada deporte seleccionado' }))
                  return
                }
                const primerNivel = nivelesDeportes[deportes[0]] || 'principiante'
                setForm(prev => ({ ...prev, deporte: deportes[0], nivel: primerNivel }))
                setErrores(prev => ({ ...prev, deportes: '' }))
                setStep(4)
                return
              }
              setErrores(prev => ({ ...prev, deportes: '' }))
              setStep(3)
            }} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(1)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 3: Nivel ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            {heading('¿Cuál es tu nivel?')}
            {subheading('Adaptaremos la intensidad a ti')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {NIVELES.map(n => (
                <OptionCard
                  key={n.value}
                  selected={form.nivel === n.value}
                  onClick={() => { handleSelect('nivel', n.value); setErrores(prev => ({ ...prev, nivel: '' })) }}
                  emoji={n.emoji}
                  label={n.label}
                  desc={n.desc}
                />
              ))}
            </div>
            {errores.nivel && (
              <p style={{ color: 'var(--destructive)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>{errores.nivel}</p>
            )}
            <button onClick={() => {
              if (!form.nivel) {
                setErrores(prev => ({ ...prev, nivel: 'Selecciona tu nivel para continuar' }))
                return
              }
              setErrores(prev => ({ ...prev, nivel: '' }))
              setStep(4)
            }} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(2)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

        {/* ── Paso 4: Carreras ───────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            {heading('¿Cuáles son tus próximas carreras?')}
            {subheading('Puedes añadir varias — adaptaremos el plan a cada objetivo')}

            {/* Lista de carreras confirmadas */}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px',
                          background: c.prioridad === 'A' ? 'oklch(0.25 0.08 145)' : c.prioridad === 'C' ? 'oklch(0.22 0 0)' : 'oklch(0.22 0.06 240)',
                          color: c.prioridad === 'A' ? 'oklch(0.8 0.15 145)' : c.prioridad === 'C' ? 'var(--muted-foreground)' : 'oklch(0.75 0.12 240)',
                          border: `1px solid ${c.prioridad === 'A' ? 'oklch(0.4 0.1 145)' : c.prioridad === 'C' ? 'var(--border)' : 'oklch(0.38 0.1 240)'}`,
                        }}>
                          {c.prioridad === 'A' ? 'Objetivo A' : c.prioridad === 'C' ? 'Entrenamiento C' : 'Secundaria B'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 2 }}>
                        {c.tipo}{c.fecha ? ` · ${c.fecha}` : ''}
                      </div>
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
            {mostrarFormCarrera && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, opacity: sinCarrera ? 0.4 : 1, pointerEvents: sinCarrera ? 'none' : 'auto' }}>
                <div>
                  <input
                    placeholder="Nombre de la carrera (ej: Media Maratón Valencia)"
                    value={nuevaCarrera.nombre}
                    onChange={e => { setNuevaCarrera({ ...nuevaCarrera, nombre: e.target.value }); setErroresCarrera(prev => ({ ...prev, nombre: '' })) }}
                    style={{ ...INPUT_STYLE, borderColor: erroresCarrera.nombre ? 'var(--destructive)' : 'var(--border)' }}
                  />
                  {erroresCarrera.nombre && <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 4 }}>{erroresCarrera.nombre}</p>}
                </div>
                <div>
                  <select
                    value={nuevaCarrera.tipo}
                    onChange={e => { setNuevaCarrera({ ...nuevaCarrera, tipo: e.target.value }); setErroresCarrera(prev => ({ ...prev, tipo: '' })) }}
                    style={{ ...INPUT_STYLE, colorScheme: 'dark', borderColor: erroresCarrera.tipo ? 'var(--destructive)' : 'var(--border)' }}
                  >
                    <option value="">Tipo de carrera...</option>
                    {getTipos(deportes.length > 0 ? deportes[0] : form.deporte, deportes).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {erroresCarrera.tipo && <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 4 }}>{erroresCarrera.tipo}</p>}
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 6 }}>Prioridad</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { value: 'A', label: 'A · Objetivo' },
                      { value: 'B', label: 'B · Secundaria' },
                      { value: 'C', label: 'C · Entrenamiento' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNuevaCarrera({ ...nuevaCarrera, prioridad: value })}
                        style={{
                          background: nuevaCarrera.prioridad === value ? 'var(--primary)' : 'transparent',
                          border: `1px solid ${nuevaCarrera.prioridad === value ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 8,
                          color: nuevaCarrera.prioridad === value ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12,
                          fontWeight: nuevaCarrera.prioridad === value ? 700 : 400,
                          padding: '8px 4px',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 6 }}>
                    <select
                      value={nuevaCarrera.dia}
                      onChange={e => { setNuevaCarrera({ ...nuevaCarrera, dia: e.target.value }); setErroresCarrera(prev => ({ ...prev, fecha: '' })) }}
                      style={{ ...INPUT_STYLE, colorScheme: 'dark', padding: '12px 8px', borderColor: erroresCarrera.fecha ? 'var(--destructive)' : 'var(--border)' }}
                    >
                      <option value="">Día</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={nuevaCarrera.mes}
                      onChange={e => { setNuevaCarrera({ ...nuevaCarrera, mes: e.target.value }); setErroresCarrera(prev => ({ ...prev, fecha: '' })) }}
                      style={{ ...INPUT_STYLE, colorScheme: 'dark', padding: '12px 8px', borderColor: erroresCarrera.fecha ? 'var(--destructive)' : 'var(--border)' }}
                    >
                      <option value="">Mes</option>
                      {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={nuevaCarrera.anio}
                      onChange={e => { setNuevaCarrera({ ...nuevaCarrera, anio: e.target.value }); setErroresCarrera(prev => ({ ...prev, fecha: '' })) }}
                      style={{ ...INPUT_STYLE, colorScheme: 'dark', padding: '12px 8px', borderColor: erroresCarrera.fecha ? 'var(--destructive)' : 'var(--border)' }}
                    >
                      <option value="">Año</option>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  {erroresCarrera.fecha && <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 4 }}>{erroresCarrera.fecha}</p>}
                </div>
                <button onClick={addCarrera} style={{ ...PRIMARY_BTN, marginTop: 0 }}>
                  ✓ Confirmar carrera
                </button>
              </div>
            )}

            {/* Botón añadir otra carrera */}
            {!mostrarFormCarrera && !sinCarrera && (
              <button
                onClick={() => {
                  const yaHayA = carreras.some(c => c.prioridad === 'A')
                  setNuevaCarrera(prev => ({ ...prev, nombre: '', tipo: '', dia: '', mes: '', anio: '', prioridad: yaHayA ? 'B' : 'A' }))
                  setMostrarFormCarrera(true)
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '12px',
                  cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                + Añadir otra carrera
              </button>
            )}

            {/* Checkbox sin carrera */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sinCarrera}
                onChange={e => {
                  setSinCarrera(e.target.checked)
                  setErrores(prev => ({ ...prev, carreras: '' }))
                  if (e.target.checked) setMostrarFormCarrera(false)
                }}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No tengo carrera todavía</span>
            </label>

            {errores.carreras && (
              <p style={{ color: 'var(--destructive)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>{errores.carreras}</p>
            )}

            <button onClick={() => {
              if (carreras.length === 0 && !sinCarrera) {
                setErrores(prev => ({ ...prev, carreras: 'Añade una carrera o indica que no tienes objetivo de carrera' }))
                return
              }
              setErrores(prev => ({ ...prev, carreras: '' }))
              setStep(5)
            }} style={PRIMARY_BTN}>Siguiente</button>
            <button onClick={() => setStep(deportes.length > 1 ? 2 : 3)} style={BACK_BTN}>← Atrás</button>
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
                Historial deportivo <span style={{ color: 'var(--destructive)' }}>*</span>
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
              {errores.historial && (
                <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 4 }}>{errores.historial}</p>
              )}
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
                ¿Cuándo puedes entrenar? <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DIAS_SLOTS.map(([man, tar]) => (
                  <div key={man} style={{ display: 'flex', gap: 6 }}>
                    <Toggle active={disponibilidadSlots.includes(man)} onClick={() => toggleSlot(man)} label={man} />
                    <Toggle active={disponibilidadSlots.includes(tar)} onClick={() => toggleSlot(tar)} label={tar} />
                  </div>
                ))}
              </div>
              {errores.disponibilidad && (
                <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 6 }}>{errores.disponibilidad}</p>
              )}
            </div>

            {/* D. Equipamiento */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                ¿Con qué cuentas para entrenar? <span style={{ color: 'var(--destructive)' }}>*</span>
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
              {form.equipamiento.includes('otro') && (
                <input
                  placeholder="Especifica qué tienes..."
                  value={otroEquipamiento}
                  onChange={e => setOtroEquipamiento(e.target.value)}
                  style={{ ...INPUT_STYLE, marginTop: 10 }}
                />
              )}
              {errores.equipamiento && (
                <p style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 6 }}>{errores.equipamiento}</p>
              )}
            </div>

            <button onClick={() => {
              const newErrors = {}
              if (form.historial_deportivo.trim().length < 20) newErrors.historial = 'Cuéntanos algo sobre tu historial (mínimo 20 caracteres)'
              if (disponibilidadSlots.length === 0) newErrors.disponibilidad = 'Selecciona al menos un horario disponible'
              if (form.equipamiento.length === 0) newErrors.equipamiento = 'Selecciona al menos una opción de equipamiento'
              if (Object.keys(newErrors).length > 0) {
                setErrores(prev => ({ ...prev, ...newErrors }))
                return
              }
              setErrores(prev => ({ ...prev, historial: '', disponibilidad: '', equipamiento: '' }))
              setStep(6)
            }} style={PRIMARY_BTN}>Siguiente</button>
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
