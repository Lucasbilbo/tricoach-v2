import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../prompts/buildSystemPrompt'

describe('System Prompt dinámico', () => {
  it('incluye el nombre del usuario', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar mi primer triatlón' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('Lucas')
  })

  it('incluye el deporte correcto', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('triatlón olímpico')
  })

  it('incluye el deporte running', () => {
    const profile = { nombre: 'Ana', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50 min en 10K' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('running')
  })

  it('incluye el deporte hyrox', () => {
    const profile = { nombre: 'Pedro', deporte: 'hyrox', nivel: 'avanzado', objetivo: 'terminar en menos de 1h' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('Hyrox')
  })

  it('incluye la fecha de carrera si existe', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar', fecha_carrera: '2026-07-23' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('23 de julio de 2026')
  })

  it('funciona sin fecha de carrera', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toBeDefined()
  })
  it('usa personalidad cercana por defecto', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('amigo')
  })

  it('usa personalidad estricta', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile, 'estricto')
    expect(prompt).toContain('exigente')
  })

  it('usa personalidad graciosa', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile, 'gracioso')
    expect(prompt).toContain('humor')
  })

  it('usa personalidad motivadora', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile, 'motivador')
    expect(prompt).toContain('energía')
  })

  it('incluye protocolo de seguridad en todas las personalidades', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    for (const p of ['cercano', 'estricto', 'gracioso', 'motivador', 'cientifico']) {
      const prompt = buildSystemPrompt(profile, p)
      expect(prompt).toContain('PROTOCOLO DE SEGURIDAD')
      expect(prompt).toContain('RICE')
    }
  })

  it('incluye alerta zona 2 cuando hay actividades de Strava', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const actividades = { resumen: 'Última semana: 3 salidas, 25km', actividades: [] }
    const prompt = buildSystemPrompt(profile, 'cercano', actividades)
    expect(prompt).toContain('zona 2')
    expect(prompt).toContain('sobreentrenamiento')
  })

  it('no incluye alerta zona 2 cuando no hay actividades', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const prompt = buildSystemPrompt(profile, 'cercano', null)
    expect(prompt).not.toContain('sobreentrenamiento')
  })

  it('activa modo taper cuando la carrera es en menos de 14 días', () => {
    const proxima = new Date()
    proxima.setDate(proxima.getDate() + 7)
    const profile = {
      nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min',
      fecha_carrera: proxima.toISOString().split('T')[0],
    }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toContain('MODO TAPER ACTIVO')
    expect(prompt).toContain('llegar fresco')
  })

  it('no activa modo taper cuando la carrera es en más de 14 días', () => {
    const lejana = new Date()
    lejana.setDate(lejana.getDate() + 30)
    const profile = {
      nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min',
      fecha_carrera: lejana.toISOString().split('T')[0],
    }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).not.toContain('MODO TAPER ACTIVO')
  })

  it('activa alerta fatiga cuando RPE medio > 8 en últimas 2 semanas', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const historial = [
      { sesiones: [{ tipo: 'Correr', completada: true, rpe: 9 }, { tipo: 'Bici', completada: true, rpe: 9 }] },
      { sesiones: [{ tipo: 'Correr', completada: true, rpe: 9 }, { tipo: 'Nadar', completada: true, rpe: 9 }] },
    ]
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, historial)
    expect(prompt).toContain('ALERTA FATIGA')
    expect(prompt).toContain('RPE elevado')
  })

  it('activa alerta fatiga cuando adherencia < 60%', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const historial = [
      {
        sesiones: [
          { tipo: 'Correr', completada: true, rpe: 5 },
          { tipo: 'Bici', completada: false },
          { tipo: 'Nadar', completada: false },
          { tipo: 'Correr', completada: false },
        ]
      },
    ]
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, historial)
    expect(prompt).toContain('ALERTA FATIGA')
    expect(prompt).toContain('baja adherencia')
  })

  it('no activa alerta fatiga con RPE y adherencia normales', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const historial = [
      { sesiones: [{ tipo: 'Correr', completada: true, rpe: 6 }, { tipo: 'Bici', completada: true, rpe: 6 }] },
      { sesiones: [{ tipo: 'Correr', completada: true, rpe: 6 }, { tipo: 'Nadar', completada: true, rpe: 6 }] },
    ]
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, historial)
    expect(prompt).not.toContain('ALERTA FATIGA')
  })
})