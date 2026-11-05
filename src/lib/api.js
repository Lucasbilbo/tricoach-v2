import { supabase } from './supabase'

// Todas las llamadas a /.netlify/functions/* llevan el token de sesión de Supabase.
// Las functions sacan el usuario del token (netlify/functions/lib/auth.js), así que
// ya no hace falta ningún secreto en el navegador.
//
// Se instala una sola vez desde main.jsx envolviendo window.fetch, para no tener que
// tocar cada llamada. Solo afecta a rutas de functions del propio sitio.

export function esRutaFunction(input) {
  const url = typeof input === 'string' ? input : input?.url || ''
  return url.startsWith('/.netlify/functions/') || url.startsWith(`${globalThis.location?.origin || ''}/.netlify/functions/`)
}

export async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  } catch {
    return null
  }
}

export function instalarAuthFetch() {
  if (typeof window === 'undefined' || window.__tricoachAuthFetch) return
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    if (!esRutaFunction(input)) return originalFetch(input, init)
    const token = await getAccessToken()
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {})
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return originalFetch(input, { ...init, headers })
  }
  window.__tricoachAuthFetch = true
}
