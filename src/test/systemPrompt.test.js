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
    expect(prompt).toContain('2026-07-23')
  })

  it('funciona sin fecha de carrera', () => {
    const profile = { nombre: 'Lucas', deporte: 'triatlon', nivel: 'principiante', objetivo: 'terminar' }
    const prompt = buildSystemPrompt(profile)
    expect(prompt).toBeDefined()
  })
})