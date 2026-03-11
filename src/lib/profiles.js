import { supabase } from './supabase'

export async function getProfile(userId) {
  const session = await supabase.auth.getSession()
  console.log('Session:', session)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  console.log('Profile data:', data, 'Error:', error)
  if (error) return null
  return data
}

export async function createProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        id: user.id,
        email: user.email,
        plan: 'free',
      },
    ])
    .select()
    .single()

  if (error) return null
  return data
}