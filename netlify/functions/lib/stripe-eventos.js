// Lógica pura del webhook de Stripe: qué hacer con cada evento y verificación de firma.
// El 6-jul-2026 falló la renovación de la única clienta de pago ("Cuenta no válida") y nadie
// se enteró: el webhook solo conocía checkout.session.completed y subscription.deleted.

const crypto = require('crypto');

const TOLERANCIA_FIRMA_S = 5 * 60;
const ESTADOS_ACTIVOS = ['active', 'trialing'];
const ESTADOS_QUE_AUN_CUENTAN = ['active', 'trialing', 'past_due']; // past_due: Stripe aún reintenta
const ESTADOS_DE_BAJA = ['canceled', 'unpaid', 'incomplete_expired'];

function verificarFirma(rawBody, signature, secret, ahoraS = Math.floor(Date.now() / 1000)) {
  if (!signature || !secret) return false;
  const partes = String(signature).split(',');
  const t = (partes.find(p => p.startsWith('t=')) || '').slice(2);
  const v1s = partes.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!t || v1s.length === 0) return false;
  if (!Number.isFinite(Number(t)) || Math.abs(ahoraS - Number(t)) > TOLERANCIA_FIRMA_S) return false;
  const esperado = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return v1s.some(v1 => v1.length === esperado.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1)));
}

// Devuelve { accion, customerId, ... }:
//  activar          → checkout completado
//  reactivar        → suscripción vuelve a active/trialing (p. ej. tras reintento de cobro)
//  revisar_baja     → suscripción terminada: bajar a Free solo si no le queda ninguna viva
//  avisar_pago      → cobro fallido: avisar a Lucas, NO bajar (Stripe reintenta)
//  ignorar
function decidirAccion(ev) {
  const obj = ev?.data?.object || {};
  switch (ev?.type) {
    case 'checkout.session.completed':
      return { accion: 'activar', userId: obj.metadata?.userId || null, customerId: obj.customer || null };
    case 'customer.subscription.updated':
      if (ESTADOS_ACTIVOS.includes(obj.status)) return { accion: 'reactivar', customerId: obj.customer };
      if (ESTADOS_DE_BAJA.includes(obj.status)) return { accion: 'revisar_baja', customerId: obj.customer };
      return { accion: 'ignorar' };
    case 'customer.subscription.deleted':
      return { accion: 'revisar_baja', customerId: obj.customer };
    case 'invoice.payment_failed':
      return {
        accion: 'avisar_pago',
        customerId: obj.customer,
        email: obj.customer_email || null,
        importe: typeof obj.amount_due === 'number' ? obj.amount_due / 100 : null,
        intento: obj.attempt_count || null,
      };
    default:
      return { accion: 'ignorar' };
  }
}

// ¿Queda alguna suscripción viva? (lista de suscripciones del cliente en Stripe)
function quedaSuscripcionViva(suscripciones) {
  return (suscripciones || []).some(s => ESTADOS_QUE_AUN_CUENTAN.includes(s.status));
}

module.exports = { verificarFirma, decidirAccion, quedaSuscripcionViva, TOLERANCIA_FIRMA_S };
