import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nombre: '',
    deporte: '',
    nivel: '',
    objetivo: '',
    fecha_carrera: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    const { error } = await supabase
      .from('profiles')
      .update(form)
      .eq('id', userId)

    if (!error) onComplete()
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      {step === 1 && (
        <div>
          <h2>¿Cómo te llamas?</h2>
          <input
            name="nombre"
            placeholder="Tu nombre"
            value={form.nombre}
            onChange={handleChange}
          />
          <button onClick={() => setStep(2)}>Siguiente</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>¿Qué deporte practicas?</h2>
          <select name="deporte" value={form.deporte} onChange={handleChange}>
            <option value="">Selecciona...</option>
            <option value="triatlon">Triatlón</option>
            <option value="running">Running</option>
            <option value="hyrox">Hyrox</option>
          </select>
          <button onClick={() => setStep(3)}>Siguiente</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>¿Cuál es tu nivel?</h2>
          <select name="nivel" value={form.nivel} onChange={handleChange}>
            <option value="">Selecciona...</option>
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
          <button onClick={() => setStep(4)}>Siguiente</button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>¿Cuál es tu objetivo?</h2>
          <input
            name="objetivo"
            placeholder="Ej: terminar mi primer triatlón"
            value={form.objetivo}
            onChange={handleChange}
          />
          <h2>¿Fecha de tu próxima carrera?</h2>
          <input
            type="date"
            name="fecha_carrera"
            value={form.fecha_carrera}
            onChange={handleChange}
          />
          <button onClick={handleSubmit}>Empezar</button>
        </div>
      )}
    </div>
  )
}