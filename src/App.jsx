import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, createProfile, updateProfile } from './lib/profiles'
import { getPlanActual, getPlanProximaSemana, getHistorialPlanes, generatePlan, markSessionComplete, getNextWeekStart } from './lib/plans'
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
  const [planProximaSemana, setPlanProximaSemana] = useState(null)
  const [historialPlanes, setHistorialPlanes] = useState([])
  const [planActualizadoPorCoach, setPlanActualizadoPorCoach] = useState(null)
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

  function handleCoachPlanUpdate(updated) {
    setPlan(updated)
    setPlanActualizadoPorCoach(Date.now())
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        await loadOrCreateProfile(session.user)
        getPlanActual(session.user.id).then(p => { setPlan(p); setPlanLoading(false) }).catch(() => setPlanLoading(false))
        getPlanProximaSemana(session.user.id).then(setPlanProximaSemana).catch(() => {})
        getHistorialPlanes(session.user.id).then(setHistorialPlanes).catch(() => {})
      } else {
        setPlanLoading(false)
      }
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadOrCreateProfile(session.user)
        getPlanActual(session.user.id).then(setPlan).catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const channel = supabase
      .channel(`plans:${uid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'plans',
        filter: `user_id=eq.${uid}`
      }, (payload) => {
        const updated = payload.new
        if (!updated?.semana) return
        const nextMonday = getNextWeekStart()
        if (updated.semana === nextMonday) {
          setPlanProximaSemana(updated)
        } else {
          const today = new Date().toISOString().split('T')[0]
          const sixDaysAgo = new Date()
          sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
          if (updated.semana <= today && updated.semana >= sixDaysAgo.toISOString().split('T')[0]) {
            setPlan(updated)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

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
        onComplete={async (generatedPlan) => {
          await loadOrCreateProfile(session.user)
          if (generatedPlan?.sesiones) {
            setPlan(generatedPlan)
          } else {
            const newPlan = await generatePlan(session.user.id).catch(() => null)
            if (newPlan) setPlan(newPlan)
          }
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
            plan={plan}
            planProximaSemana={planProximaSemana}
            historialPlanes={historialPlanes}
            personalidad={profile?.personalidad || 'cercano'}
            onPersonalidadChange={handlePersonalidadChange}
            onShowUpgrade={() => setShowUpgradeModal(true)}
            onPlanUpdate={handleCoachPlanUpdate}
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
            onPlanProximaSemanaUpdate={setPlanProximaSemana}
            planActualizadoPorCoach={planActualizadoPorCoach}
            planProximaSemana={planProximaSemana}
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
        <div className="screen-enter" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))', minHeight: '100vh', overflowY: 'auto' }}>
          {/* Profile header with gradient */}
          <div style={{
            background: 'radial-gradient(ellipse at 0% 0%, rgba(255,107,43,0.1) 0%, transparent 60%), var(--background)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
            padding: '20px 20px 18px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontSize: 20, fontWeight: 700, flexShrink: 0,
              }}>
                {(profile?.nombre?.[0] || session.user.email?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
                  {profile?.nombre || 'Mi perfil'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  {profile?.plan === 'pro' ? '✦ Plan Pro' : 'Plan Free'}
                  {profile?.deporte ? ` · ${profile.deporte}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 0' }}>
            {/* Coach style section */}
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 10, paddingLeft: 2 }}>
                Estilo del coach
              </p>
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '4px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
              }}>
                {[
                  { value: 'cercano', label: '😊 Cercano' },
                  { value: 'estricto', label: '💪 Estricto' },
                  { value: 'gracioso', label: '😄 Gracioso' },
                  { value: 'motivador', label: '🔥 Motivador' },
                ].map(({ value, label }) => {
                  const isActive = (profile?.personalidad || 'cercano') === value
                  return (
                    <button
                      key={value}
                      onClick={() => handlePersonalidadChange({ target: { value } })}
                      style={{
                        background: isActive ? 'var(--primary)' : 'transparent',
                        border: 'none',
                        borderRadius: 8,
                        color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 400,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 10, paddingLeft: 2 }}>
                Integraciones
              </p>
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
              }}>
                <StravaConnect
                  userId={session.user.id}
                  plan={profile?.plan}
                  onConnected={() => loadOrCreateProfile(session.user)}
                  onShowUpgrade={() => setShowUpgradeModal(true)}
                />
              </div>
            </div>
          </div>

          <EditProfile
            profile={profile}
            onUpdate={(updated) => setProfile(updated)}
            onClose={() => handleNavigate('coach')}
            onShowUpgrade={() => setShowUpgradeModal(true)}
          />

          <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 16px 16px', textAlign: 'center' }}>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 99,
                color: 'var(--muted-foreground)',
                padding: '10px 28px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--destructive)'; e.currentTarget.style.color = 'var(--foreground)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
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
