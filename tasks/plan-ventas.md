# Plan de ventas — TriCoach AI (auditoría 11-nov-2026)

Criterio único: qué impide que un desconocido llegue, se registre, genere su plan y pague.
Base: commit `0285b12`. Tests 256/256, build limpio. Datos de producción consultados hoy (solo agregados).

## Foto real del embudo (Supabase, 11-nov)

| Paso | Total histórico | Últimos 30 días |
|---|---|---|
| Altas | 51 | 8 |
| Onboarding completado | 40 | 6 |
| Con algún plan generado | 13 | 2 |
| Pro | 3 (2 con cliente Stripe) | 1 |
| Strava conectado | 5 de 10 plazas | — |
| Activos en chat (7 días) | 3 | — |

Lectura:
- **El cuello de botella es el tráfico**: 8 altas al mes. Con eso no hay ventas aunque el embudo fuera perfecto.
- Las 6 altas de octubre (coach roto) se fueron sin plan. Las 2 posteriores al arreglo del 5-nov sí lo tienen. La activación parece arreglada, pero la muestra es mínima.
- Hay 27 personas que hicieron onboarding y nunca tuvieron plan (parte de ellas durante los meses con el coach roto). Es la lista más barata de recuperar.

## P0 — impide cobrar o medir la venta

1. **Tras pagar, el usuario aterriza en la landing, no en la app.**
   `netlify/functions/create-checkout.js:108-109` → `success_url` es `https://www.getricoach.com/?upgrade=success`. La raíz sirve `landing.html` (`scripts/build-static.js`); la app vive en `/app`. Consecuencias: ninguna confirmación de compra, y `upgrade_success` (`src/App.jsx:188-190`) no salta nunca, así que GA4 y Ads no pueden medir ventas.
   Arreglo: `success_url` y `cancel_url` a `https://getricoach.com/app` (+ `?upgrade=success`).

2. **El botón de pago puede fallar en silencio.**
   `src/components/UpgradeModal.jsx:45-48`: si `create-checkout` responde error (400 "Precio no válido", 401, 500) no se muestra nada. Además el precio sale de `VITE_STRIPE_PRICE_*` en el navegador y debe coincidir con `STRIPE_PRICE_*` del servidor; si difieren, nadie puede pagar y nadie se entera.
   Arreglo: el cliente manda `monthly|annual`, el servidor elige el precio; mostrar error si falla.

3. **Durante la prueba no hay forma de comprar desde el chat.**
   `src/components/Chat.jsx:390` usa `planEfectivo` → en prueba `esFree` es falso y desaparecen el botón Pro (`:568`) y el banner (`:786`). Los 7 días de más interés son los únicos sin botón de compra. En cambio `EditProfile.jsx:357` usa `profile.plan` y dice "Estás en el plan gratuito" a quien está en prueba.
   Arreglo: criterio único "no paga" para mostrar la oferta; en prueba, texto "Te quedan N días — sigue en Pro".

4. **La prueba termina sin avisar.**
   No hay ningún aviso en la app al caducar ni en los últimos días (solo un contador en la cabecera del perfil, `App.jsx:488`), y los emails están apagados. El usuario pasa a Free sin enterarse y sin oferta.
   Arreglo: aviso en Dashboard los días 5-7 y pantalla única al caducar con lo que pierde y el botón de compra.

5. **Strava: techo de 10 atletas, 5 ya ocupados.** (decisión/gestión de Lucas)
   La landing vende Strava como titular. Quedan 5 plazas: a partir de la 6.ª venta, el cliente paga y no puede conectar. La solicitud de ampliación es del 28-abr y no consta respuesta.

## P1 — resta conversión

6. `src/components/Login.jsx`: solo un botón de Google. Falta "7 días de prueba Pro sin tarjeta" y 3 puntos de valor.
7. `src/components/EditProfile.jsx:396`: promete "150 mensajes/día". Son 20.
8. `src/components/EditProfile.jsx:873-985`: a los Pro de pago se les muestra el formulario obsoleto de credenciales propias de Strava ("crea tu app en strava.com/settings/api"). Duplica `StravaConnect` y confunde justo a quien ha pagado. Eliminar.
9. Cancelación: `landing.html:1166` dice "cancela en un clic"; en realidad es por email. Añadir Stripe Customer Portal en el perfil.
10. Email de bienvenida Pro apagado (`EMAILS_ENABLED`) y su enlace apunta a `tricoach-v2.netlify.app` (`stripe-webhook.js:100`). Separar emails transaccionales (pago, fin de prueba) de los automáticos.
11. Retención: sin crons ni emails nada trae de vuelta al usuario en la semana 2. Reactivar al menos `auto-plans` + "plan listo".
12. La prueba no incluye Strava, que es el argumento principal de Pro: el usuario nunca prueba lo que se le quiere vender. Con 5 plazas libres no se puede abrir; depende del punto 5.

## P2 — mejora

- Bundle de 612 kB en un solo chunk (carga lenta en móvil).
- Documentación desfasada: `ESTADO_PROYECTO.md` fechado en mayo; `CLAUDE.md` cita `stripe_subscription_id`, columna que no existe.
- Coste IA: Free ya usa Haiku y Pro Sonnet con `effort: low`; no es un bloqueo hoy.

## No merece la pena ahora

App nativa, más integraciones, rediseños. Con 8 altas/mes no mueven ventas.

## Orden de ejecución propuesto

- **PR 1 (código, sin decisiones):** puntos 1, 2, 3, 4, 6, 7, 8. Rama `ventas/embudo-pago`, un commit por arreglo, tests y build en verde.
- **PR 2 (requiere OK):** Customer Portal (9), emails transaccionales (10), reactivar `auto-plans` (11).
- **Captación:** lanzar las campañas y posts del informe SEO en cuanto el PR 1 esté en producción y `upgrade_success` medido.

## Decisiones que necesito de Lucas

1. Strava: reclamar la ampliación (o confirmar el límite actual en strava.com/settings/api).
2. OK para encender emails transaccionales (bienvenida Pro, fin de prueba).
3. OK para un único email de recuperación a las 27 personas con onboarding y sin plan, con 7 días de prueba Pro.
4. OK para reactivar el cron de planes semanales.
5. Comprobar en Netlify que `VITE_STRIPE_PRICE_MONTHLY/ANNUAL` = `STRIPE_PRICE_MONTHLY/ANNUAL` (el PR 1 elimina esta dependencia).
