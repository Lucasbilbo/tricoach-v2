import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

const TOTAL_STEPS = 4

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 36 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i + 1 === current
              ? 'var(--primary)'
              : i + 1 < current
                ? 'oklch(0.7 0.18 45 / 0.4)'
                : 'var(--secondary)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

function OptionCard({ selected, onClick, emoji, label, desc, small }) {
  return (
    <button
      onClick={onClick}
      style={{
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
      }}
    >
      {emoji && (
        <span style={{ fontSize: small ? 20 : 28, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      )}
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 600,
          fontSize: small ? 14 : 15,
          color: selected ? 'var(--primary)' : 'var(--foreground)',
        }}>
          {label}
        </div>
        {desc && (
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{desc}</div>
        )}
      </div>
      {selected && (
        <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 16, flexShrink: 0, marginLeft: 'auto' }}>
          ✓
        </span>
      )}
    </button>
  )
}

const INPUT_STYLE = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  padding: '12px 16px',
  outline: 'none',
  boxSizing: 'border-box',
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

export default function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nombre: '',
    deporte: '',
    nivel: '',
    objetivo: '',
    fecha_carrera: '',
    personalidad: 'cercano',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSelect = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  const handleSubmit = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Sesión en onboarding:', session)

    const { error } = await supabase
      .from('profiles')
      .update(form)
      .eq('id', userId)

    console.log('Error al actualizar:', error)
    if (!error) onComplete()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '48px 16px 40px',
    }}>
      <div key={step} className="step-animate" style={{ width: '100%', maxWidth: 480 }}>
        <ProgressDots current={step} total={TOTAL_STEPS} />

        {/* ── Paso 1: Nombre ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              ¿Cómo te llamas?
            </h2>
            <p style={{
              color: 'var(--muted-foreground)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 32,
            }}>
              Así me dirigiré a ti durante los entrenamientos
            </p>
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

        {/* ── Paso 2: Deporte ─────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              ¿Qué deporte practicas?
            </h2>
            <p style={{
              color: 'var(--muted-foreground)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 32,
            }}>
              Tu coach se especializará en tu disciplina
            </p>
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

        {/* ── Paso 3: Nivel ───────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              ¿Cuál es tu nivel?
            </h2>
            <p style={{
              color: 'var(--muted-foreground)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 32,
            }}>
              Adaptaremos la intensidad a ti
            </p>
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

        {/* ── Paso 4: Objetivo + fecha + personalidad ─────────────── */}
        {step === 4 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              Casi listo 🎯
            </h2>
            <p style={{
              color: 'var(--muted-foreground)',
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 28,
            }}>
              Cuéntame tu objetivo y cómo quieres que sea tu coach
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                color: 'var(--muted-foreground)',
                marginBottom: 6,
              }}>
                ¿Cuál es tu objetivo?
              </label>
              <input
                name="objetivo"
                placeholder="Ej: terminar mi primer triatlón"
                value={form.objetivo}
                onChange={handleChange}
                style={INPUT_STYLE}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                color: 'var(--muted-foreground)',
                marginBottom: 6,
              }}>
                ¿Fecha de tu próxima carrera? (opcional)
              </label>
              <input
                type="date"
                name="fecha_carrera"
                value={form.fecha_carrera}
                onChange={handleChange}
                style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <p style={{
                fontSize: 13,
                color: 'var(--muted-foreground)',
                marginBottom: 10,
              }}>
                Estilo del coach
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
            </div>

            <button onClick={handleSubmit} style={PRIMARY_BTN}>Empezar</button>
            <button onClick={() => setStep(3)} style={BACK_BTN}>← Atrás</button>
          </div>
        )}

      </div>
    </div>
  )
}
