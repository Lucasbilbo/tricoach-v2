import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, createProfile, updateProfile } from './lib/profiles'
import { getPlan, generatePlan, markSessionComplete } from './lib/plans'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Chat from './components/Chat'
import WeeklyPlan from './components/WeeklyPlan'
import EditProfile from './components/EditProfile'
import StravaConnect from './components/StravaConnect'
import BottomNav from './components/BottomNav'
import CookieBanner from './components/CookieBanner'
import UpgradeModal from './components/UpgradeModal'
import Dashboard from './components/Dashboard'
import Progress from './components/Progress'
import SessionDetail from './components/SessionDetail'
import ErrorBoundary from './components/ErrorBoundary'
import WelcomeGuide from './components/WelcomeGuide'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [currentScreen, setCurrentScreen] = useState('dashboard')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [chatPrefill, setChatPrefill] = useState('')

  async function loadOrCreateProfile(user) {
    let profile = await getProfile(user.id)
    if (!profile) {
      profile = await createProfile(user)
    }
    setProfile(profile)
  }

  function handleNavigate(screen) {
    window.scrollTo(0, 0)
    setCurrentScreen(screen)
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
        getPlan(session.user.id).then(p => { setPlan(p); setPlanLoading(false) }).catch(() => setPlanLoading(false))
      } else {
        setPlanLoading(false)
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

      {currentScreen === 'dashboard' && (
        <ErrorBoundary fallbackMessage="No se pudo cargar el entrenamiento de hoy">
          <Dashboard
            userId={session.user.id}
            plan={plan}
            profile={profile}
            loading={planLoading}
            onPlanUpdate={setPlan}
            onNavigate={handleNavigate}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'coach' && (
        <ErrorBoundary fallbackMessage="No se pudo cargar el chat con tu coach">
          <Chat
            userId={session.user.id}
            profile={profile}
            personalidad={profile?.personalidad || 'cercano'}
            onPersonalidadChange={handlePersonalidadChange}
            onShowUpgrade={() => setShowUpgradeModal(true)}
            prefillMessage={chatPrefill}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'plan' && (
        <ErrorBoundary fallbackMessage="No se pudo cargar el plan semanal">
          <WeeklyPlan
            userId={session.user.id}
            profile={profile}
            plan={plan}
            onPlanUpdate={setPlan}
            onSessionDetail={setSelectedSession}
            onNavigate={handleNavigate}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'progress' && (
        <Progress
          userId={session.user.id}
          profile={profile}
          plan={plan}
          onNavigate={handleNavigate}
        />
      )}

      {currentScreen === 'profile' && (
        <div style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))', minHeight: '100vh', overflowY: 'auto' }}>
          <div style={{
            background: 'var(--background)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
            padding: '16px 20px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
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
              <StravaConnect
                userId={session.user.id}
                plan={profile?.plan}
                onConnected={() => loadOrCreateProfile(session.user)}
                onShowUpgrade={() => setShowUpgradeModal(true)}
              />
            </div>
          </div>

          <EditProfile
            profile={profile}
            onUpdate={(updated) => setProfile(updated)}
            onClose={() => handleNavigate('coach')}
            onShowUpgrade={() => setShowUpgradeModal(true)}
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

      {profile && !profile.onboarding_visto && (
        <WelcomeGuide
          onComplete={async () => {
            await updateProfile(session.user.id, { onboarding_visto: true })
            setProfile(prev => ({ ...prev, onboarding_visto: true }))
          }}
        />
      )}

      <BottomNav currentScreen={currentScreen} onNavigate={handleNavigate} />
      <CookieBanner />

      {selectedSession && (
        <SessionDetail
          sesion={selectedSession}
          profile={profile}
          onClose={() => setSelectedSession(null)}
          onAskCoach={(text) => {
            setSelectedSession(null)
            setChatPrefill(text)
            handleNavigate('coach')
          }}
          onComplete={async (rpe) => {
            if (plan?.id) {
              const updated = await markSessionComplete(plan.id, selectedSession.dia, rpe).catch(() => null)
              if (updated) setPlan(updated)
            }
            setSelectedSession(null)
          }}
        />
      )}

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
