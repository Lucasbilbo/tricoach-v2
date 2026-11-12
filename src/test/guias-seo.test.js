// Guías SEO: cada guía publicada tiene su par de redirects, su entrada en sitemap y en llms.txt,
// canonical correcto y no menciona Strava (nov-2026).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '../..')
const leer = r => readFileSync(join(raiz, r), 'utf8')
const guias = readdirSync(raiz).filter(f => f.endsWith('.html') && !['index.html', 'landing.html'].includes(f)).map(f => f.replace('.html', ''))

describe('guías SEO', () => {
  it('hay guías', () => expect(guias.length).toBeGreaterThanOrEqual(15))
  for (const slug of guias) {
    it(`${slug}: redirects, sitemap, llms.txt, canonical y sin Strava`, () => {
      const toml = leer('netlify.toml')
      expect(toml).toContain(`from = "/${slug}.html"\n  to = "/${slug}"\n  status = 301`)
      expect(toml).toContain(`from = "/${slug}"\n  to = "/${slug}.html"\n  status = 200`)
      expect(leer('sitemap.xml')).toContain(`<loc>https://getricoach.com/${slug}</loc>`)
      expect(leer('static/llms.txt')).toContain(`https://getricoach.com/${slug})`)
      const html = leer(`${slug}.html`)
      expect(html).toContain(`<link rel="canonical" href="https://getricoach.com/${slug}" />`)
      expect(html).not.toMatch(/strava/i)
    })
  }
})
