export default function Terminos() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1>Términos de Uso</h1>
      <p><em>Última actualización: 12 de noviembre de 2026</em></p>

      <h2>1. Descripción del servicio</h2>
      <p>TriCoach AI es un asistente de coaching deportivo basado en inteligencia artificial. No sustituye el consejo médico ni de un entrenador profesional certificado.</p>

      <h2>2. Uso del servicio</h2>
      <ul>
        <li>Debes tener al menos 18 años para usar el servicio</li>
        <li>Eres responsable de la información que proporcionas</li>
        <li>No uses el servicio para fines ilegales o dañinos</li>
      </ul>

      <h2>3. Plan Free y Pro</h2>
      <p>Las cuentas nuevas disfrutan de 7 días de prueba de Pro sin tarjeta; al terminar pasan automáticamente al plan Free salvo que contraten Pro. Los precios actuales de Pro son 14,99 € al mes o 119 € al año.</p>
      <ul>
        <li>Free: 10 mensajes diarios, 2 capturas de entreno por semana y plan semanal que genera el propio usuario.</li>
        <li>Pro (de pago o en prueba): 20 mensajes diarios con un modelo de IA más avanzado, capturas de entreno sin tope semanal, plan nuevo cada lunes y revisión semanal por correo.</li>
      </ul>
      <p>La suscripción y los pagos se gestionan a través de Stripe. Puedes cambiar tu tarjeta, ver tus facturas y cancelar cuando quieras desde tu perfil, en &laquo;Gestionar suscripción&raquo;.</p>

      <h2>4. Capturas de entreno y Strava</h2>
      <p>Puedes subir la captura de pantalla de un entreno para que el coach lea la duración, la distancia y el pulso. La imagen se envía a Anthropic (Claude) para leerla y no se almacena; solo se guardan los datos leídos que confirmas. Strava solo está disponible para las cuentas que ya estaban conectadas: no se admiten conexiones nuevas.</p>

      <h2>5. Correos del servicio</h2>
      <p>Te enviamos correos sobre tu cuenta y tu entrenamiento: bienvenida a Pro, aviso de fin de prueba, plan listo, revisión semanal y recordatorio el día de una sesión pendiente. Puedes darte de baja respondiendo a cualquiera de ellos; el recordatorio de sesión también se desactiva desde tu perfil.</p>

      <h2>6. Limitación de responsabilidad</h2>
      <p>TriCoach AI proporciona recomendaciones generales de entrenamiento. Consulta siempre con un médico antes de iniciar un programa de ejercicio intenso. No nos responsabilizamos de lesiones derivadas del uso del servicio.</p>

      <h2>7. Cancelación</h2>
      <p>Puedes cancelar tu suscripción cuando quieras desde tu perfil. Puedes eliminar tu cuenta en cualquier momento desde tu perfil: se borran tus datos y se cancela tu suscripción. Más detalles en la Política de Privacidad.</p>

      <h2>8. Modificaciones</h2>
      <p>Podemos modificar estos términos con previo aviso de 15 días por email.</p>

      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por la legislación española. Cualquier disputa se someterá a los tribunales de Bilbao.</p>
    </div>
  )
}