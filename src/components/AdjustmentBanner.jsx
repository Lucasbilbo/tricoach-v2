export default function AdjustmentBanner({ reason, mensaje, onVerCambios, onDismiss }) {
  return (
    <div style={{
      background: 'rgba(255,107,53,0.08)',
      borderLeft: '3px solid #FF6B35',
      borderRadius: '0 10px 10px 0',
      padding: '12px 16px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600, lineHeight: 1.4, marginBottom: mensaje ? 4 : 0 }}>
          Tu coach ajustó el plan · {reason}
        </p>
        {mensaje && (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            {mensaje}
          </p>
        )}
        {onVerCambios && (
          <button
            onClick={onVerCambios}
            style={{
              background: 'none',
              border: 'none',
              color: '#FF6B35',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginTop: 6,
              textDecoration: 'underline',
            }}
          >
            Ver cambios →
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted-foreground)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
