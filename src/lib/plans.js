import { supabase } from './supabase'

function getWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

export async function getPlan(userId) {
  const semana = getWeekStart()
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('semana', semana)
    .single()
  return data
}

export async function generatePlan(userId) {
  const secret = import.meta.env.VITE_TRICOACH_SECRET || ''
  const res = await fetch('/.netlify/functions/generate-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tricoach-secret': secret
    },
    body: JSON.stringify({ userId })
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
