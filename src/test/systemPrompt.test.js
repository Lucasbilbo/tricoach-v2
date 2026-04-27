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

  it('con cycle activo, el prompt incluye MACROCICLO', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const cycle = {
      fecha_inicio: '2026-01-05',
      semanas_totales: 16,
      carrera_nombre: 'Maratón Valencia',
      fases: [
        { nombre: 'base',  sem_inicio: 1,  sem_fin: 5,  objetivo: 'Construir base aeróbica' },
        { nombre: 'build', sem_inicio: 6,  sem_fin: 11, objetivo: 'Desarrollar umbral' },
        { nombre: 'peak',  sem_inicio: 12, sem_fin: 14, objetivo: 'Máxima intensidad' },
        { nombre: 'taper', sem_inicio: 15, sem_fin: 16, objetivo: 'Reducir volumen' },
      ],
    }
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, [], cycle)
    expect(prompt).toContain('MACROCICLO')
    expect(prompt).toContain('Maratón Valencia')
  })

  it('con cycle en fase taper, el prompt incluye TAPER', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    // Set fecha_inicio so current week falls in taper (week 15-16 of 16)
    const hoy = new Date()
    const fechaInicioTaper = new Date(hoy)
    fechaInicioTaper.setDate(hoy.getDate() - 14 * 7) // 14 weeks ago → we're at week 15
    const cycle = {
      fecha_inicio: fechaInicioTaper.toISOString().split('T')[0],
      semanas_totales: 16,
      carrera_nombre: 'Carrera test',
      fases: [
        { nombre: 'base',  sem_inicio: 1,  sem_fin: 5,  objetivo: 'Base' },
        { nombre: 'build', sem_inicio: 6,  sem_fin: 11, objetivo: 'Build' },
        { nombre: 'peak',  sem_inicio: 12, sem_fin: 14, objetivo: 'Peak' },
        { nombre: 'taper', sem_inicio: 15, sem_fin: 16, objetivo: 'Taper' },
      ],
    }
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, [], cycle)
    expect(prompt).toContain('TAPER')
  })

  it('con fc_maxima en perfil, el prompt incluye las zonas calculadas', () => {
    const profile = {
      nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min',
      fc_maxima: 180,
    }
    const cycle = {
      fecha_inicio: '2026-01-05',
      semanas_totales: 12,
      carrera_nombre: null,
      fases: [
        { nombre: 'base',  sem_inicio: 1, sem_fin: 6,  objetivo: 'Base' },
        { nombre: 'build', sem_inicio: 7, sem_fin: 10, objetivo: 'Build' },
        { nombre: 'peak',  sem_inicio: 11, sem_fin: 11, objetivo: 'Peak' },
        { nombre: 'taper', sem_inicio: 12, sem_fin: 12, objetivo: 'Taper' },
      ],
    }
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, [], cycle)
    expect(prompt).toContain('180bpm')
    expect(prompt).toContain('ZONAS DE ENTRENAMIENTO')
  })

  it('sin cycle, el prompt NO incluye MACROCICLO', () => {
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar de 50min' }
    const prompt = buildSystemPrompt(profile, 'cercano', null, null, null, [], null)
    expect(prompt).not.toContain('MACROCICLO')
  })
})