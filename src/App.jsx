import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, createProfile } from './lib/profiles'
import { getPlan, generatePlan } from './lib/plans'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Chat from './components/Chat'
import WeeklyPlan from './components/WeeklyPlan'
import EditProfile from './components/EditProfile'
import StravaConnect from './components/StravaConnect'
import BottomNav from './components/BottomNav'
import CookieBanner from './components/CookieBanner'
import UpgradeModal from './components/UpgradeModal'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentScreen, setCurrentScreen] = useState('coach')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  async function loadOrCreateProfile(user) {
    let profile = await getProfile(user.id)
    if (!profile) {
      profile = await createProfile(user)
    }
    setProfile(profile)
  }

  async function handlePersonalidadChange(e) {
    const nueva = e.target.value
    await supabase.from('profiles').update({ personalidad: nueva }).eq('id', session.user.id)
    setProfile({ ...profile, personalidad: nueva })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgrade') === 'success') {
      setUpgradeSuccess(true)
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setUpgradeSuccess(false), 4000)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadOrCreateProfile(session.user)
        getPlan(session.user.id).then(setPlan).catch(() => {})
      }
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadOrCreateProfile(session.user)
        getPlan(session.user.id).then(setPlan).catch(() => {})
      }
    })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted-foreground)' }}>
      Cargando...
    </div>
  )

  if (!session) return <Login />

  if (!profile?.deporte) {
    return (
      <Onboarding
        userId={session.user.id}
        onComplete={async () => {
          await loadOrCreateProfile(session.user)
          const newPlan = await generatePlan(session.user.id).catch(() => null)
          if (newPlan) setPlan(newPlan)
        }}
      />
    )
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
      {upgradeSuccess && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--success)',
          color: 'oklch(0.13 0.01 60)',
          borderRadius: 'var(--radius)',
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
          zIndex: 200,
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 4px 20px oklch(0 0 0 / 0.3)',
        }}>
          🏆 ¡Ya eres Pro! Bienvenido/a al plan completo.
        </div>
      )}

      {currentScreen === 'coach' && (
        <Chat
          userId={session.user.id}
          profile={profile}
          personalidad={profile?.personalidad || 'cercano'}
          onPersonalidadChange={handlePersonalidadChange}
          onShowUpgrade={() => setShowUpgradeModal(true)}
        />
      )}

      {currentScreen === 'plan' && (
        <WeeklyPlan
          userId={session.user.id}
          plan={plan}
          onPlanUpdate={setPlan}
        />
      )}

      {currentScreen === 'profile' && (
        <div style={{ paddingBottom: 60, minHeight: '100vh', overflowY: 'auto' }}>
          <div style={{
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            padding: '20px 16px 16px',
          }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600 }}>Perfil</h2>
          </div>

          <div style={{ padding: '16px 16px 0' }}>
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginBottom: 12,
            }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>Estilo del coach</p>
              <select
                value={profile?.personalidad || 'cercano'}
                onChange={handlePersonalidadChange}
                style={{
                  width: '100%',
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                }}
              >
                <option value="cercano">😊 Cercano</option>
                <option value="estricto">💪 Estricto</option>
                <option value="gracioso">😄 Gracioso</option>
                <option value="motivador">🔥 Motivador</option>
              </select>
            </div>

            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginBottom: 12,
            }}>
              <StravaConnect userId={session.user.id} onConnected={() => loadOrCreateProfile(session.user)} />
            </div>
          </div>

          <EditProfile
            profile={profile}
            onUpdate={(updated) => setProfile(updated)}
            onClose={() => setCurrentScreen('coach')}
          />

          <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--muted-foreground)',
                padding: '8px 20px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <BottomNav currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      <CookieBanner />

      {showUpgradeModal && (
        <UpgradeModal
          userId={session.user.id}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  )
}

export default App
