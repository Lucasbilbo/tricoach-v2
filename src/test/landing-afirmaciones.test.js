// La landing solo afirma lo que la app hace hoy (nov-2026): sin Apple Health, sin descarga
// "directa" al reloj (es un archivo TCX) y con las guías publicadas enlazadas.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '../..')
const landing = readFileSync(join(raiz, 'landing.html'), 'utf8')

describe('afirmaciones de la landing', () => {
  it('no anuncia Apple Health como disponible', () => {
    expect(landing).not.toMatch(/Apple Health/i)
  })
  it('no promete descarga directa al reloj ni "sin copiar nada"', () => {
    expect(landing).not.toMatch(/directamente al reloj|descarga directa|sin copiar nada/i)
  })
  it('no ofrece MTB como caso de uso soportado', () => {
    expect(landing).not.toMatch(/<h3>[^<]*MTB[^<]*<\/h3>/)
  })
  it('enlaza todas las guías publicadas', () => {
    const guias = readdirSync(raiz).filter(f => f.endsWith('.html') && !['index.html', 'landing.html'].includes(f)).map(f => f.replace('.html', ''))
    for (const slug of guias) expect(landing, slug).toContain(`href="/${slug}"`)
  })
})
