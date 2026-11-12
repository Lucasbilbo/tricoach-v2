
export default function Privacidad() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1>Política de Privacidad</h1>
      <p><em>Última actualización: 12 de noviembre de 2026</em></p>

      <h2>1. Responsable del tratamiento</h2>
      <p>TriCoach AI es responsable del tratamiento de tus datos personales. Contacto: tricoach@email.com</p>

      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>Email y nombre (a través de Google OAuth)</li>
        <li>Datos deportivos que nos das: deporte, nivel, objetivo, carreras, lesiones, disponibilidad y, si quieres, datos de rendimiento (pulso máximo, ritmos, potencia, peso, edad)</li>
        <li>Historial de conversaciones con el coach y planes de entrenamiento generados</li>
        <li>Resultado de tus sesiones: si las has hecho, esfuerzo percibido, notas y los datos que confirmas al completarlas (duración, distancia y pulso medio)</li>
        <li>Datos de actividad de Strava, solo en las cuentas que ya estaban conectadas (ver apartado 4)</li>
        <li>Datos de pago: los gestiona Stripe. Nosotros solo guardamos el identificador de cliente en Stripe y el plan contratado; nunca vemos ni guardamos el número de tu tarjeta</li>
      </ul>

      <h2>3. Finalidad del tratamiento</h2>
      <p>Usamos tus datos para ofrecerte el servicio de coaching personalizado: generar y ajustar tu plan, responder en el chat, gestionar tu suscripción y enviarte los correos descritos en el apartado 6. No vendemos tus datos. Los compartimos solo con los proveedores técnicos necesarios para prestar el servicio: Supabase (base de datos y acceso), Anthropic (modelos de IA que responden al chat, generan el plan y leen las capturas), Netlify (alojamiento), Stripe (pagos), Resend (envío de correos) y Google (inicio de sesión y, si lo aceptas, analítica).</p>

      <h2>4. Capturas de entreno y Strava</h2>
      <p><strong>Capturas de entreno.</strong> Cuando subes la captura de pantalla de un entreno (por ejemplo, del resumen de tu reloj), la imagen se envía a Anthropic (Claude) para leer la duración, la distancia y el pulso medio. La imagen no se almacena en nuestros servidores ni la guardamos después de leerla. Antes de guardar nada, tú revisas los datos leídos; solo se guardan los datos que confirmas.</p>
      <p><strong>Strava.</strong> Ya no admitimos nuevas conexiones con Strava. Si tu cuenta de Strava estaba conectada antes, sigue funcionando como hasta ahora y puedes desconectarla desde tu perfil; si la desconectas, no podrás volver a conectarla.</p>

      <h2>5. Base legal</h2>
      <p>El tratamiento se basa en la ejecución del contrato de servicio (Art. 6.1.b RGPD) y tu consentimiento para las cookies analíticas (Art. 6.1.a RGPD).</p>

      <h2>6. Correos electrónicos</h2>
      <p>Enviamos correos a través de Resend a la dirección de tu cuenta. Los correos son los siguientes:</p>
      <ul>
        <li>Bienvenida a Pro, cuando contratas el plan</li>
        <li>Aviso de fin de la prueba de Pro, cuando te quedan menos de 48 horas</li>
        <li>Aviso de que tu plan de la semana está listo (cuentas Pro y en prueba)</li>
        <li>Revisión semanal de tu entrenamiento, los domingos (cuentas Pro y en prueba)</li>
        <li>Recordatorio el día de una sesión de entrenamiento que tienes pendiente</li>
      </ul>
      <p>Para darte de baja de los correos, responde a cualquiera de ellos y te damos de baja. El recordatorio de sesión además se puede desactivar con un interruptor en tu perfil. Los correos relacionados con tu pago o con tu cuenta se pueden seguir enviando.</p>

      <h2>7. Pagos y suscripción</h2>
      <p>Los pagos los procesa Stripe. Desde tu perfil, en &laquo;Gestionar suscripción&raquo;, accedes al portal de cliente de Stripe, donde puedes cambiar tu tarjeta, ver tus facturas y cancelar la suscripción.</p>

      <h2>8. Planes y límites</h2>
      <p>Las cuentas nuevas disfrutan de 7 días de prueba de Pro, sin tarjeta. Después pasan al plan Free, salvo que contraten Pro (14,99 € al mes o 119 € al año).</p>
      <ul>
        <li>Free: 10 mensajes al día, 2 capturas de entreno por semana y plan semanal que generas tú.</li>
        <li>Pro (de pago o en prueba): 20 mensajes al día, capturas sin tope semanal, plan nuevo cada lunes, revisión semanal por correo y modelo de IA más avanzado.</li>
      </ul>

      <h2>9. Conservación de datos</h2>
      <p>Conservamos tus datos mientras tengas cuenta activa. Puedes eliminar tu cuenta desde tu perfil: se borran tus mensajes, planes, ciclos de entrenamiento, perfil y usuario, se cancela tu suscripción y se revoca la conexión con Strava si la tenías. También puedes pedir el borrado escribiéndonos.</p>

      <h2>10. Tus derechos</h2>
      <p>Tienes derecho a acceder, rectificar, suprimir, oponerte y portabilidad de tus datos. Escríbenos a tricoach@email.com para ejercerlos.</p>

      <h2>11. Cookies</h2>
      <p>Usamos cookies esenciales para el funcionamiento de la app y cookies analíticas para mejorar el servicio. Puedes rechazar las cookies analíticas sin afectar al funcionamiento.</p>
    </div>
  )
}
