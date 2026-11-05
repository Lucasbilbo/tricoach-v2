// Analítica (GA4) sin datos personales: solo nombres de evento y parámetros genéricos.
// Nunca enviar email, nombre, ids de usuario ni texto escrito por el usuario.
// Con Consent Mode (index.html) Google no guarda cookies hasta que el usuario acepta.

export function track(evento, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', evento, params)
  } catch {
    /* la analítica nunca debe romper la app */
  }
}

export function setAnalyticsConsent(concedido) {
  try {
    localStorage.setItem('cookies_analytics', concedido ? 'granted' : 'denied')
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: concedido ? 'granted' : 'denied' })
    }
  } catch {
    /* sin localStorage */
  }
}
