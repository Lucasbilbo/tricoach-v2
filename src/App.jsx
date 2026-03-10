import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (!session) {
    return <Login />
  }

  return (
    <div>
      <h1>Bienvenido, {session.user.email}</h1>
      <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}

export default App
