import { describe, it, expect } from 'vitest'
import { AJUSTE_RE } from '../components/Chat.jsx'

describe('AJUSTE_RE — patrón día + tipo de sesión', () => {
  // Casos que SÍ deben hacer match (ajustes reales al plan)
  it('detecta día seguido de tipo de sesión', () => {
    expect(AJUSTE_RE.test('el lunes cambia el correr por bici')).toBe(true)
  })

  it('detecta tipo de sesión seguido de día', () => {
    expect(AJUSTE_RE.test('quiero mover el nadar al martes')).toBe(true)
  })

  it('detecta con acentos en miércoles', () => {
    expect(AJUSTE_RE.test('el miércoles haz fuerza en vez de bici')).toBe(true)
  })

  it('detecta sábado con acento', () => {
    expect(AJUSTE_RE.test('el sábado quiero descansar en lugar de correr')).toBe(true)
  })

  it('detecta brick ligado a un día', () => {
    expect(AJUSTE_RE.test('el domingo haz un brick suave')).toBe(true)
  })

  it('detecta jueves con nadar', () => {
    expect(AJUSTE_RE.test('pon nadar el jueves')).toBe(true)
  })

  it('detecta descansar ligado a día', () => {
    expect(AJUSTE_RE.test('el viernes quiero descansar')).toBe(true)
  })

  // Casos que NO deben hacer match (frases irrelevantes)
  it('NO hace match con "cambia tu mentalidad"', () => {
    expect(AJUSTE_RE.test('cambia tu mentalidad')).toBe(false)
  })

  it('NO hace match con "actualiza la app"', () => {
    expect(AJUSTE_RE.test('actualiza la app')).toBe(false)
  })

  it('NO hace match con "modificar mi dieta"', () => {
    expect(AJUSTE_RE.test('modificar mi dieta')).toBe(false)
  })

  it('NO hace match con solo un día sin tipo', () => {
    expect(AJUSTE_RE.test('el lunes fue difícil')).toBe(false)
  })

  it('NO hace match con solo tipo sin día', () => {
    expect(AJUSTE_RE.test('el correr me cansa mucho')).toBe(false)
  })

  it('NO hace match cuando día y tipo están muy separados (>150 chars)', () => {
    const filler = 'x'.repeat(160)
    expect(AJUSTE_RE.test(`el lunes ${filler} correr`)).toBe(false)
  })

  it('SÍ hace match dentro del límite de 150 chars', () => {
    const filler = 'x'.repeat(140)
    expect(AJUSTE_RE.test(`el lunes ${filler} correr`)).toBe(true)
  })
})
