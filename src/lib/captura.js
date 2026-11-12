// Captura de un entreno: reduce la imagen en el navegador y la manda a analizar-captura.
// La imagen no se guarda en ningún sitio.

import { getHoyMadrid } from './fechas'
import { planEfectivo } from './planEfectivo'

const LADO_MAX = 1568
const CALIDAD = 0.85

// Devuelve { imagen (base64 sin prefijo), mediaType }. Reduce a JPEG para que una foto
// de móvil de varios MB quepa en la petición y cueste menos de leer.
export async function prepararImagen(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Elige una imagen')
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', CALIDAD)
  return { imagen: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' }
}

// Solo lo que el coach necesita para comparar con lo planificado
export function resumenSesion(sesion) {
  if (!sesion) return null
  const { tipo, subtipo, duracion_min, distancia_km, zona_objetivo, intensidad } = sesion
  return { tipo, subtipo, duracion_min, distancia_km, zona_objetivo, intensidad }
}

// Devuelve { duracion_min, distancia_km, fc_media, ritmo, deporte, comentario } o lanza Error con mensaje para el usuario.
export async function analizarCaptura(userId, file, sesion) {
  const { imagen, mediaType } = await prepararImagen(file)
  const res = await fetch('/.netlify/functions/analizar-captura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, imagen, mediaType, sesion: resumenSesion(sesion) }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(data?.error || 'No se ha podido leer la captura. Inténtalo de nuevo.')
    error.limiteSemanal = data?.limite_semanal === true
    if (error.limiteSemanal) recordar(userId, 0)
    throw error
  }
  if (data?.capturas_restantes != null) recordar(userId, data.capturas_restantes)
  return data
}

// Espejo de functions/lib/captura.js (test de paridad en captura.test.js)
export const LIMITE_SEMANAL_FREE = 2

// Lunes de la semana actual en Madrid (YYYY-MM-DD)
export function lunesDeHoy(hoy = getHoyMadrid()) {
  const d = new Date(`${hoy}T12:00:00Z`)
  const dia = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (dia === 0 ? -6 : 1 - dia))
  return d.toISOString().slice(0, 10)
}

// Lo último que dijo el servidor en esta sesión: el perfil en memoria no se recarga tras cada captura.
let ultimo = null
function recordar(userId, restantes) {
  ultimo = { userId, lunes: lunesDeHoy(), restantes }
}
export function olvidarCapturas() { ultimo = null }

// null = sin tope (Pro o prueba Pro). Para Free, las capturas que le quedan esta semana.
export function capturasRestantes(profile, hoy = getHoyMadrid()) {
  if (planEfectivo(profile) === 'pro') return null
  const usadas = profile?.capturas_semana_inicio === lunesDeHoy(hoy) && Number.isFinite(profile?.capturas_semana) ? profile.capturas_semana : 0
  const segunPerfil = Math.max(0, LIMITE_SEMANAL_FREE - usadas)
  if (ultimo && ultimo.userId === profile?.id && ultimo.lunes === lunesDeHoy(hoy)) return Math.min(segunPerfil, ultimo.restantes)
  return segunPerfil
}
