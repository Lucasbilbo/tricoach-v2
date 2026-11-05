// Red de seguridad de duraciones del plan semanal (se aplica tras generar con Claude).
//
// - Atletas con nivel distinto de principiante: mínimos por fase y deporte (el prompt ya los pide).
// - Principiante: NO se aplican mínimos y se limita a 60 min. Antes se les subía a 80 min de bici
//   o 65 de carrera en fase build, contradiciendo la propia regla "máximo 60 min, todo en Z1-Z2"
//   del prompt (y dejando la duración incoherente con la estructura de la sesión).

const MAX_PRINCIPIANTE_MIN = 60;

const MINIMOS = {
  base:  { Correr: 55, Bici: 80,  Nadar: 45, Fuerza: 50 },
  build: { Correr: 65, Bici: 90,  Nadar: 55, Fuerza: 55 },
  peak:  { Correr: 70, Bici: 100, Nadar: 60, Fuerza: 55 },
  taper: { Correr: 35, Bici: 50,  Nadar: 35, Fuerza: 40 },
};

function validarDuracion(sesion, fase, nivel) {
  const duracion = sesion.duracion_min || 0;
  if (sesion.tipo?.toLowerCase() === 'descanso') return duracion;
  if (String(nivel || '').toLowerCase() === 'principiante') return Math.min(duracion, MAX_PRINCIPIANTE_MIN);
  const min = MINIMOS[fase]?.[sesion.tipo] || 45;
  return Math.max(duracion, min);
}

module.exports = { validarDuracion, MAX_PRINCIPIANTE_MIN, MINIMOS };
