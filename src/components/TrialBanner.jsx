import { useState } from 'react'
import { enPrueba, diasPruebaRestantes } from '../lib/planEfectivo'
import { estadoPrueba } from '../lib/estadoPrueba'
import { LIMITE_DIARIO } from '../lib/profiles'

// Aviso de la prueba Pro en la pantalla "Hoy":
//  - últimos DIAS_AVISO días de prueba → cuántos quedan y botón para seguir en Pro
//  - prueba terminada (hasta DIAS_TRAS_FIN días después) → qué cambia y botón Pro; se puede cerrar
// Antes la prueba caducaba sin ningún aviso y el usuario pasaba a Free sin oferta.
const CLAVE_VISTO = 'trial_fin_visto'

function yaVisto() {
  try { return localStorage.getItem(CLAVE_VISTO) === '1' } catch { return false }
}

export default function TrialBanner({ profile, onShowUpgrade }) {
  const [cerrado, setCerrado] = useState(yaVisto)
  const estado = estadoPrueba(profile)
  if (!estado || !onShowUpgrade) return null
  if (estado === 'terminada' && cerrado) return null

  const dias = enPrueba(profile) ? diasPruebaRestantes(profile) : 0
  const titulo = estado === 'aviso'
    ? `Te ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`} de prueba Pro`
    : 'Tu prueba Pro ha terminado'
  const texto = estado === 'aviso'
    ? `Después pasarás al plan gratuito: ${LIMITE_DIARIO.free} mensajes al día, coach básico y 2 capturas de entreno por semana. Con Pro el coach sigue leyendo todos tus entrenos, con plan nuevo cada lunes, revisión semanal y ${LIMITE_DIARIO.pro} mensajes al día.`
    : `Ahora estás en el plan gratuito: ${LIMITE_DIARIO.free} mensajes al día, coach básico y 2 capturas de entreno por semana. Tu plan y tu historial siguen aquí. Con Pro el coach vuelve a leer todos tus entrenos, con plan nuevo cada lunes, revisión semanal y ${LIMITE_DIARIO.pro} mensajes al día.`

  function cerrar() {
    try { localStorage.setItem(CLAVE_VISTO, '1') } catch { /* sin localStorage */ }
    setCerrado(true)
  }

  return (
    <div style={{
      background: 'oklch(0.7 0.18 45 / 0.1)',
      border: '1px solid oklch(0.7 0.18 45 / 0.4)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      margin: '12px 16px 0',
      fontFamily: 'var(--font-sans)',
    }}>
      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', marginBottom: 4 }}>{titulo}</p>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 12 }}>{texto}</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onShowUpgrade}
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 24,
            padding: '8px 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {estado === 'aviso' ? 'Seguir en Pro' : 'Hazte Pro'}
        </button>
        {estado === 'terminada' && (
          <button
            onClick={cerrar}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 4px',
            }}
          >
            Ahora no
          </button>
        )}
      </div>
    </div>
  )
}
