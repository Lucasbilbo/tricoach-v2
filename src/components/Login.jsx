import { supabase } from '../lib/supabase'

export default function Login() {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) console.error('Error al iniciar sesión:', error)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>TriCoach AI</h1>
      <p>Tu entrenador personal con IA</p>
      <button onClick={handleGoogleLogin}>
        Iniciar sesión con Google
      </button>
    </div>
  )
}