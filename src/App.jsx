import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, createProfile } from './lib/profiles'
import Login from './components/Login'
import Onboarding from './components/Onboarding'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadOrCreateProfile(user) {
    let profile = await getProfile(user.id)
    if (!profile) {
      profile = await createProfile(user)
    }
    setProfile(profile)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadOrCreateProfile(session.user)
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadOrCreateProfile(session.user)
    })
  }, [])

  if (loading) return <p>Cargando...</p>
  if (!session) return <Login />
  if (!profile?.deporte) {
    return (
      <Onboarding
        userId={session.user.id}
        onComplete={() => loadOrCreateProfile(session.user)}
      />
    )
  }

  return (
    <div>
      <h1>Bienvenido, {profile?.nombre || profile?.email}</h1>
      <p>Deporte: {profile?.deporte}</p>
      <p>Nivel: {profile?.nivel}</p>
      <p>Plan: {profile?.plan}</p>
      <button onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
    </div>
  )
}

export default App