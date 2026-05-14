import { describe, it, expect, vi, afterEach } from 'vitest'
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

  // ── Regresión: carreras futuras UTC midnight bug ────────────────────────────
  describe('carrerasFuturas: comparación por string ISO, no por Date UTC', () => {
    afterEach(() => { vi.useRealTimers() })

    it('carrera en fecha de hoy se incluye en el prompt (no filtrada como pasada)', () => {
      // Bug: new Date('2026-05-14') = UTC midnight. Si hoy es 10:00 UTC (12:00 Madrid)
      // la carrera quedaba excluida porque UTC midnight < 10:00 UTC.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z')) // 12:00 Madrid (UTC+2)

      const profile = {
        nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar',
        carreras: [{ nombre: 'Carrera Hoy', tipo: 'running', fecha: '2026-05-14' }]
      }
      const prompt = buildSystemPrompt(profile)
      expect(prompt).toContain('Carrera Hoy')
    })

    it('carrera de ayer NO se incluye en el prompt', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z'))

      const profile = {
        nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar',
        carreras: [{ nombre: 'Carrera Ayer', tipo: 'running', fecha: '2026-05-13' }]
      }
      const prompt = buildSystemPrompt(profile)
      expect(prompt).not.toContain('Carrera Ayer')
    })

    it('carrera mañana siempre se incluye', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z'))

      const profile = {
        nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar',
        carreras: [{ nombre: 'Carrera Mañana', tipo: 'running', fecha: '2026-05-15' }]
      }
      const prompt = buildSystemPrompt(profile)
      expect(prompt).toContain('Carrera Mañana')
    })
  })

  // ── Regresión: offset de días (semana lunes-based) ─────────────────────────
  describe('etiquetas hoy/pasado/pendiente en plan semanal', () => {
    const SEMANA = '2026-05-11' // lunes 11 mayo 2026
    const profile = { nombre: 'Lucas', deporte: 'running', nivel: 'intermedio', objetivo: 'bajar' }
    const sesionesBase = [
      { dia: 'Lunes',      tipo: 'Correr',   descripcion: 'Rodaje Z2',   completada: false },
      { dia: 'Martes',     tipo: 'Descanso', descripcion: 'Descanso',    completada: false },
      { dia: 'Miércoles',  tipo: 'Bici',     descripcion: 'Rodaje fácil',completada: false },
      { dia: 'Jueves',     tipo: 'Correr',   descripcion: 'Fartlek',     completada: false },
      { dia: 'Viernes',    tipo: 'Nadar',    descripcion: 'Técnica',     completada: false },
      { dia: 'Sábado',     tipo: 'Bici',     descripcion: 'Ruta larga',  completada: false },
      { dia: 'Domingo',    tipo: 'Descanso', descripcion: 'Descanso',    completada: false },
    ]

    afterEach(() => { vi.useRealTimers() })

    it('jueves: etiqueta [HOY] en Jueves, [pasado] en Lun/Mar/Mié, (pendiente) en Vie/Sáb/Dom', () => {
      // 2026-05-14 = jueves (getDay()=4 en JS, índice 3 en lunes-based)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z')) // 10:00 UTC = 12:00 Madrid

      const plan = { id: 'p1', semana: SEMANA, sesiones: sesionesBase, volumen_planificado_min: 250 }
      const prompt = buildSystemPrompt(profile, 'cercano', null, plan)

      // Jueves es hoy
      expect(prompt).toContain('Jueves (2026-05-14): Correr - Fartlek [HOY - pendiente]')
      // Días pasados sin completar
      expect(prompt).toContain('Lunes (2026-05-11): Correr - Rodaje Z2 [pasado - no realizada]')
      expect(prompt).toContain('Martes (2026-05-12): Descanso - Descanso [pasado - no realizada]')
      expect(prompt).toContain('Miércoles (2026-05-13): Bici - Rodaje fácil [pasado - no realizada]')
      // Días futuros
      expect(prompt).toContain('Viernes (2026-05-15): Nadar - Técnica (pendiente)')
      expect(prompt).toContain('Sábado (2026-05-16): Bici - Ruta larga (pendiente)')
      expect(prompt).toContain('Domingo (2026-05-17): Descanso - Descanso (pendiente)')
    })

    it('lunes: solo lunes es [HOY], el resto (pendiente)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-11T10:00:00Z')) // lunes

      const plan = { id: 'p1', semana: SEMANA, sesiones: sesionesBase, volumen_planificado_min: 250 }
      const prompt = buildSystemPrompt(profile, 'cercano', null, plan)

      expect(prompt).toContain('Lunes (2026-05-11): Correr - Rodaje Z2 [HOY - pendiente]')
      expect(prompt).toContain('Martes (2026-05-12): Descanso - Descanso (pendiente)')
      expect(prompt).not.toContain('[pasado')
    })

    it('sesión completada en día pasado muestra ✓ completada, no [pasado]', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z')) // jueves

      const sesionesConCompletada = sesionesBase.map(s =>
        s.dia === 'Lunes' ? { ...s, completada: true } : s
      )
      const plan = { id: 'p1', semana: SEMANA, sesiones: sesionesConCompletada, volumen_planificado_min: 250 }
      const prompt = buildSystemPrompt(profile, 'cercano', null, plan)

      expect(prompt).toContain('Lunes (2026-05-11): Correr - Rodaje Z2 ✓ completada')
      expect(prompt).not.toContain('Lunes (2026-05-11): Correr - Rodaje Z2 [pasado')
    })

    it('plan de semana anterior activa advertencia de semana anterior', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z')) // jueves semana 11-17 mayo

      const planAnterior = { id: 'p-old', semana: '2026-05-04', sesiones: sesionesBase, volumen_planificado_min: 250 }
      const prompt = buildSystemPrompt(profile, 'cercano', null, planAnterior)

      expect(prompt).toContain('ADVERTENCIA')
      expect(prompt).toContain('semana anterior')
      expect(prompt).toContain('2026-05-04')
    })

    it('plan de semana actual NO activa advertencia de semana anterior', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-14T10:00:00Z'))

      const plan = { id: 'p1', semana: SEMANA, sesiones: sesionesBase, volumen_planificado_min: 250 }
      const prompt = buildSystemPrompt(profile, 'cercano', null, plan)

      expect(prompt).not.toContain('semana anterior')
    })
  })
})