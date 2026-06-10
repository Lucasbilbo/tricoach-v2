import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { decidirAccionPlan } = require('../../netlify/functions/lib/planes.js')

describe('generate-plan — idempotencia (decidirAccionPlan)', () => {
  it('sin plan existente → crear (con o sin forzar)', () => {
    expect(decidirAccionPlan(null, false)).toBe('crear')
    expect(decidirAccionPlan(null, true)).toBe('crear')
    expect(decidirAccionPlan(undefined, false)).toBe('crear')
  })

  it('con plan existente y sin forzar → devolver_existente (no llama a Claude)', () => {
    expect(decidirAccionPlan({ id: 'p1', semana: '2026-06-08' }, false)).toBe('devolver_existente')
    expect(decidirAccionPlan({ id: 'p1' }, undefined)).toBe('devolver_existente')
  })

  it('con plan existente y forzar → actualizar (PATCH sobre la misma fila, no duplica)', () => {
    expect(decidirAccionPlan({ id: 'p1', semana: '2026-06-08' }, true)).toBe('actualizar')
  })
})
