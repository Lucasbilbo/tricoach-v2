import { supabase } from './supabase'

export async function getMessages(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function saveMessage(userId, role, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{ user_id: userId, role, content }])
    .select()
    .single()

  if (error) return null
  return data
}

export async function getMessageCountToday(userId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', today.toISOString())

  if (error) return 0
  return count || 0
}