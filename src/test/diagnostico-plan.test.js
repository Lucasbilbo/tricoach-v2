import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { buildDiagnosticoUserMessage } = require('../../netlify/functions/generate-plan')

const DIAS = ['Jueves', 'Viernes', 'Sábado', 'Domingo']
const INFO = { triatlon: 'triatlón', running: 'running' }
const build = (deportes, extras) => buildDiagnosticoUserMessage(deportes, '2026-11-05', INFO, DIAS, 'mejorar', extras)

describe('semana de diagnóstico (primer plan de los usuarios nuevos)', () => {
  it('pide rodajes suaves en los días sin test y limita los descansos', () => {
    const msg = build([{ deporte: 'triatlon', nivel: 'avanzado' }], {})
    expect(msg).toContain('RODAJES SUAVES')
    expect(msg).toContain('Máximo 2 días de descanso real')
  })

  it('incluye disponibilidad, lesiones y lo que cuenta el atleta en la bienvenida', () => {
    const msg = build([{ deporte: 'running', nivel: 'intermedio' }], {
      disponibilidad: 'Martes tarde, Jueves tarde',
      lesiones: 'rodilla izquierda',
      contextoSemana: 'esta semana solo martes y jueves',
    })
    expect(msg).toContain('Martes tarde, Jueves tarde')
    expect(msg).toContain('RESPETAR SIEMPRE): rodilla izquierda')
    expect(msg).toContain('esta semana solo martes y jueves')
    expect(msg).toContain('tiene prioridad sobre la plantilla')
  })

  it('sin datos extra no inventa secciones de lesiones ni de contexto', () => {
    const msg = build([{ deporte: 'running', nivel: 'intermedio' }], {})
    expect(msg).not.toContain('Lesiones o limitaciones')
    expect(msg).not.toContain('ACABA DE CONTAR')
    expect(msg).not.toContain('NIVEL PRINCIPIANTE')
  })

  it('a un principiante no se le piden tests a máximo esfuerzo', () => {
    const msg = build([{ deporte: 'running', nivel: 'principiante' }], {})
    expect(msg).toContain('NIVEL PRINCIPIANTE')
    expect(msg).toContain('ningún test a "máximo esfuerzo"')
  })

  it('el camino multi-deporte también recibe los ajustes', () => {
    const msg = build([{ deporte: 'triatlon', nivel: 'avanzado' }, { deporte: 'running', nivel: 'avanzado' }], { lesiones: 'tendón de Aquiles' })
    expect(msg).toContain('tendón de Aquiles')
    expect(msg).toContain('alternando disciplinas')
  })
})
