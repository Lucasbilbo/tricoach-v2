import { supabase } from './supabase'
import { calcularVolumenReal } from './volumen'

export function esFormatoAntiguo(sesiones) {
  if (!sesiones || !sesiones.length) return false
  const activas = sesiones.filter(s => s.intensidad !== 'descanso' && s.tipo !== 'Descanso')
  return activas.length > 0 && activas.every(s => !s.estructura)
}

function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return formatLocalDate(monday)
}

export function getNextWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 1 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return formatLocalDate(monday)
}

function getLastWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff - 7)
  return formatLocalDate(monday)
}

export async function getPlanActual(userId) {
  const today = formatLocalDate(new Date())
  const sixDaysAgo = new Date()
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
  const sixDaysAgoStr = formatLocalDate(sixDaysAgo)
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .lte('semana', today)
    .gte('semana', sixDaysAgoStr)
    .order('semana', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getPlanProximaSemana(userId) {
  return getPlanForWeek(userId, getNextWeekStart())
}

export async function getHistorialPlanes(userId, semanas = 4) {
  const sixDaysAgo = new Date()
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
  const cutoff = formatLocalDate(sixDaysAgo) // usar fecha local, no UTC (evita desfase nocturno)
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .lt('semana', cutoff)
    .order('semana', { ascending: false })
    .limit(semanas)
  return data || []
}

export async function getPlan(userId) {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('semana', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getLastWeekPlan(userId) {
  const semana = getLastWeekStart()
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('semana', semana)
    .maybeSingle()
  return data
}

export async function getPlanForWeek(userId, semana) {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('semana', semana)
    .maybeSingle()
  return data
}

/**
 * @param {boolean} forzar — true en regeneraciones explícitas: salta el check de
 * idempotencia del backend y actualiza el plan existente de la semana en vez de
 * devolverlo con { ya_existe: true }.
 */
export async function generatePlan(userId, planAnterior = null, fechaInicio = null, contextoSemana = null, forzar = false) {
  const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
  const res = await fetch('/.netlify/functions/generate-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tricoach-secret': secret
    },
    body: JSON.stringify({ userId, planAnterior, fechaInicio, contexto_semana: contextoSemana || undefined, forzar: forzar || undefined })
  })
  return res.json()
}

/**
 * Función canónica para completar una sesión — ÚNICA vía desde el frontend.
 * Reemplaza a markSessionComplete (plans.js) y patchSesionCompleta (ModalCompletarSesion).
 *
 * @param {string} planId
 * @param {string} dia — nombre del día ('Lunes'...'Domingo')
 * @param {object} campos — opcionales: rpe, tiempo_real_min, distancia_real_km,
 *                          fc_media_real, notas_usuario, via_strava
 * @returns plan actualizado
 * @throws Error('Plan no encontrado') si el plan no existe
 */
export async function completarSesion(planId, dia, campos = {}) {
  const { data: plan } = await supabase
    .from('plans')
    .select('sesiones, volumen_real_min')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) throw new Error('Plan no encontrado')

  const sesiones = plan.sesiones.map(s =>
    s.dia === dia ? { ...s, completada: true, ...campos } : s
  )

  const volumenReal = calcularVolumenReal(sesiones)

  const { data } = await supabase
    .from('plans')
    .update({ sesiones, volumen_real_min: volumenReal })
    .eq('id', planId)
    .select()
    .maybeSingle()

  return data
}

export async function adjustPlan(userId, planId, motivo, descripcion) {
  const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
  const response = await fetch('/.netlify/functions/adjust-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tricoach-secret': secret
    },
    body: JSON.stringify({ userId, planId, motivo, descripcion })
  })
  return response.json()
}

export async function autoAdjustPlan(userId, planId, signal) {
  const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
  const response = await fetch('/.netlify/functions/adjust-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tricoach-secret': secret
    },
    body: JSON.stringify({ userId, planId, signal })
  })
  return response.json()
}

export async function getRecentPlans(userId, numSemanas = 4) {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('semana', { ascending: false })
    .limit(numSemanas)
  return data || []
}

export function calcularConsistencia(planes) {
  if (!planes || planes.length === 0) return null
  let completadas = 0
  let total = 0
  for (const plan of planes) {
    for (const s of (plan.sesiones || [])) {
      const tipo = s.tipo?.toLowerCase()
      // Skip rest days and sessions with no type
      if (!tipo || tipo === 'descanso' || s.intensidad === 'descanso') continue
      total++
      // Robust check: handle boolean true, number 1, or string "true"
      if (s.completada === true || s.completada === 1 || s.completada === 'true') completadas++
    }
  }
  if (total === 0) return null
  return Math.round((completadas / total) * 100)
}

export function analizarPlan(plan) {
  if (!plan?.sesiones) return null

  const sesiones = plan.sesiones
  const completadas = sesiones.filter(s => s.completada)
  const saltadas = sesiones.filter(s => !s.completada && s.tipo?.toLowerCase() !== 'descanso')

  const getRpe = s => s.rpe ?? s.rpe_usuario
  const rpesValidos = completadas.filter(s => getRpe(s) != null)
  const rpeMedia = rpesValidos.length > 0
    ? Math.round(rpesValidos.reduce((acc, s) => acc + getRpe(s), 0) / rpesValidos.length * 10) / 10
    : null

  return {
    sesionesCompletadas: completadas.length,
    sesionesTotales: sesiones.length,
    rpeMedia,
    sesionesSaltadas: saltadas.map(s => ({ dia: s.dia, tipo: s.tipo }))
  }
}
