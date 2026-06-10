// Fechas Europe/Madrid para Netlify Functions (CJS).
// Espejo parcial de src/lib/fechas.js — test de paridad en src/test/fechas-madrid.test.js.
// ⚠️ El cron corre en UTC: estas funciones garantizan la semana correcta en Madrid
// (UTC+1 invierno / UTC+2 verano) siempre que se usen en vez de toISOString().

// sv-SE da YYYY-MM-DD en zona Madrid; T12:00:00Z ancla a mediodía UTC para que
// getUTCDay() caiga siempre en el mismo día que la fecha de Madrid (seguro ante DST)
function getMondayOfCurrentWeek() {
  const madridDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const d = new Date(madridDateStr + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

// Fecha de hoy (YYYY-MM-DD) en Europe/Madrid — NUNCA toISOString() para "hoy"
function getHoyMadrid() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

module.exports = { getMondayOfCurrentWeek, getHoyMadrid };
