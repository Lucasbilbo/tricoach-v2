import { supabase } from './supabase'

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

export async function canSendMessage(profile) {
  if (profile.plan !== 'free') return true

  const today = new Date().toISOString().split('T')[0]
  const lastDate = profile.last_message_date

  if (lastDate !== today) return true
  return profile.messages_today < 10
}

export async function incrementMessageCount(userId, profile) {
  const today = new Date().toISOString().split('T')[0]
  const lastDate = profile.last_message_date

  const newCount = lastDate === today ? profile.messages_today + 1 : 1

  const { error } = await supabase
    .from('profiles')
    .update({ messages_today: newCount, last_message_date: today })
    .eq('id', userId)

  if (error) return null
  return newCount
}