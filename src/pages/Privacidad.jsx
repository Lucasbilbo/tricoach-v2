export default function Privacidad() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1>Política de Privacidad</h1>
      <p><em>Última actualización: marzo 2026</em></p>

      <h2>1. Responsable del tratamiento</h2>
      <p>TriCoach AI es responsable del tratamiento de tus datos personales. Contacto: tricoach@email.com</p>

      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>Email y nombre (a través de Google OAuth)</li>
        <li>Datos deportivos: deporte, nivel, objetivo y fecha de carrera</li>
        <li>Historial de conversaciones con el coach</li>
        <li>Datos de actividad de Strava (solo si conectas tu cuenta)</li>
      </ul>

      <h2>3. Finalidad del tratamiento</h2>
      <p>Usamos tus datos exclusivamente para ofrecerte el servicio de coaching personalizado. No vendemos ni compartimos tus datos con terceros salvo los proveedores técnicos necesarios (Supabase, Anthropic, Netlify).</p>

      <h2>4. Base legal</h2>
      <p>El tratamiento se basa en la ejecución del contrato de servicio (Art. 6.1.b RGPD) y tu consentimiento para las cookies analíticas (Art. 6.1.a RGPD).</p>

      <h2>5. Conservación de datos</h2>
      <p>Conservamos tus datos mientras tengas cuenta activa. Puedes solicitar el borrado en cualquier momento.</p>

      <h2>6. Tus derechos</h2>
      <p>Tienes derecho a acceder, rectificar, suprimir, oponerte y portabilidad de tus datos. Escríbenos a tricoach@email.com para ejercerlos.</p>

      <h2>7. Cookies</h2>
      <p>Usamos cookies esenciales para el funcionamiento de la app y cookies analíticas para mejorar el servicio. Puedes rechazar las cookies analíticas sin afectar al funcionamiento.</p>
    </div>
  )
}