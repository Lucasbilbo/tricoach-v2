import { supabase } from './supabase'
import { planEfectivo } from './planEfectivo'

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

export async function createProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ id: user.id, email: user.email, plan: 'free' }])
    .select()
    .single()

  if (error) return null
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) return null
  return data
}

// Límites diarios de mensajes al coach. La fuente de verdad es el servidor
// (netlify/functions/claude.js, DAILY_LIMIT); estos valores solo sirven para avisar antes.
export const LIMITE_DIARIO = { free: 10, pro: 20 }

export function hoyMadrid() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

export function mensajesHoy(profile, enviadosEnSesion = 0) {
  const base = profile?.last_message_date === hoyMadrid() ? (profile?.messages_today || 0) : 0
  return base + enviadosEnSesion
}

export function limiteDiario(profile) {
  return planEfectivo(profile) === 'pro' ? LIMITE_DIARIO.pro : LIMITE_DIARIO.free
}

export async function canSendMessage(profile, enviadosEnSesion = 0) {
  if (!profile) return true
  return mensajesHoy(profile, enviadosEnSesion) < limiteDiario(profile)
}
// Interruptor "Recordatorios por email" (columna profiles.recordatorios_email, migración 009).
// Sin la columna (migración sin aplicar) `profile.recordatorios_email` es undefined → se considera activado.
export function recordatoriosActivados(profile) {
  return profile?.recordatorios_email !== false
}

// Campo a enviar en el update del perfil: SOLO si el usuario lo ha cambiado. Así, mientras la migración 009
// no esté aplicada, guardar el perfil sin tocar el interruptor no manda una columna que no existe.
export function cambioRecordatorios(profile, activado) {
  return activado === recordatoriosActivados(profile) ? {} : { recordatorios_email: activado }
}
