const HomeIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
)

const CalendarIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)

const ChartIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 20h18M5 20V14m4 6V10m4 10V6m4 10V4"/>
  </svg>
)

const ChatIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

const UserIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const tabs = [
  { id: 'dashboard', Icon: HomeIcon, label: 'Hoy' },
  { id: 'plan', Icon: CalendarIcon, label: 'Plan' },
  { id: 'progress', Icon: ChartIcon, label: 'Progreso' },
  { id: 'coach', Icon: ChatIcon, label: 'Coach' },
  { id: 'profile', Icon: UserIcon, label: 'Perfil' },
]

export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: 'oklch(0.13 0.01 60 / 0.96)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom, 12px)',
    }}>
      {tabs.map(({ id, Icon, label }) => {
        const active = currentScreen === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              height: 58,
              background: 'none',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              color: active ? 'var(--primary)' : 'oklch(0.42 0.01 60)',
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              padding: 0,
              letterSpacing: '0.04em',
              transition: 'color 0.18s ease',
            }}
          >
            <Icon active={active} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
