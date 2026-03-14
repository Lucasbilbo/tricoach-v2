import { supabase } from './supabase'

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

export function getNextWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 1 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

function getLastWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff - 7)
  return monday.toISOString().split('T')[0]
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

export async function generatePlan(userId, planAnterior = null, fechaInicio = null) {
  const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
  const res = await fetch('/.netlify/functions/generate-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tricoach-secret': secret
    },
    body: JSON.stringify({ userId, planAnterior, fechaInicio })
  })
  return res.json()
}

export async function markSessionComplete(planId, dia, rpe) {
  const { data: plan } = await supabase
    .from('plans')
    .select('sesiones')
    .eq('id', planId)
    .single()

  const sesiones = plan.sesiones.map(s =>
    s.dia === dia ? { ...s, completada: true, rpe } : s
  )

  const { data } = await supabase
    .from('plans')
    .update({ sesiones })
    .eq('id', planId)
    .select()
    .single()

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
      if (s.tipo?.toLowerCase() !== 'descanso') {
        total++
        if (s.completada) completadas++
      }
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
