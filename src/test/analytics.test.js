// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { track, setAnalyticsConsent } from '../lib/analytics'

afterEach(() => { delete window.gtag; localStorage.clear() })

describe('analítica', () => {
  it('track no falla si Google Analytics no está cargado', () => {
    expect(() => track('sign_up')).not.toThrow()
  })
  it('track manda el evento a gtag', () => {
    window.gtag = vi.fn()
    track('onboarding_complete', { n_deportes: 2 })
    expect(window.gtag).toHaveBeenCalledWith('event', 'onboarding_complete', { n_deportes: 2 })
  })
  it('el consentimiento se guarda y se comunica a Google', () => {
    window.gtag = vi.fn()
    setAnalyticsConsent(true)
    expect(localStorage.getItem('cookies_analytics')).toBe('granted')
    expect(window.gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' })
    setAnalyticsConsent(false)
    expect(localStorage.getItem('cookies_analytics')).toBe('denied')
  })
  it('index.html arranca con el consentimiento analítico denegado', () => {
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8')
    expect(html).toMatch(/gtag\('consent', 'default', \{ analytics_storage: 'denied'/)
    expect(html.indexOf("'consent', 'default'")).toBeLessThan(html.indexOf("gtag('config'"))
  })
  it('los eventos no llevan datos personales', () => {
    const dir = join(__dirname, '..')
    const archivos = ['App.jsx', 'components/Onboarding.jsx', 'components/Chat.jsx', 'components/UpgradeModal.jsx']
    for (const f of archivos) {
      const llamadas = readFileSync(join(dir, f), 'utf8').match(/track\([^)]*\)/g) || []
      for (const l of llamadas) expect(l).not.toMatch(/email|nombre|userId|user\.id|texto|userMessage/i)
    }
  })
})
