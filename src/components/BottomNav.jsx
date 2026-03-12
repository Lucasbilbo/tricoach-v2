const tabs = [
  { id: 'coach', icon: '💬', label: 'Coach' },
  { id: 'plan', icon: '📅', label: 'Plan' },
  { id: 'profile', icon: '👤', label: 'Perfil' },
]

export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      background: 'var(--card)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 50,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            borderTop: `2px solid ${currentScreen === tab.id ? 'var(--primary)' : 'transparent'}`,
            borderRadius: 0,
            cursor: 'pointer',
            color: currentScreen === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: currentScreen === tab.id ? 600 : 400,
            padding: 0,
            transition: 'color 0.2s',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
