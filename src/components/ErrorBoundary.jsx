import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--muted-foreground)'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px',
                      color: 'var(--foreground)', marginBottom: '8px' }}>
            Algo salió mal
          </p>
          <p style={{ fontSize: '14px', marginBottom: '20px' }}>
            {this.props.fallbackMessage || 'Esta sección no pudo cargarse'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
