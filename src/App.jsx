import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, createProfile } from './lib/profiles'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Chat from './components/Chat'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadOrCreateProfile(user) {
    console.log('Cargando perfil para:', user.id)
    let profile = await getProfile(user.id)
    console.log('Perfil obtenido:', profile)
    if (!profile) {
      profile = await createProfile(user)
      console.log('Perfil creado:', profile)
    }
    setProfile(profile)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Sesión:', session)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #eee' }}>
        <h2>TriCoach AI</h2>
        <div>
          <span style={{ marginRight: 16 }}>{profile?.nombre}</span>
          <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>
      <Chat userId={session.user.id} profile={profile} />
    </div>
  )
}

export default App