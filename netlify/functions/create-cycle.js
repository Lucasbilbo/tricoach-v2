const https = require('https');

const FUNCTION_SECRET = process.env.TRICOACH_SECRET;
const SUPABASE_HOST = 'luqpjgzpydquqturgjmt.supabase.co';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-tricoach-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Supabase helpers ────────────────────────────────────────────────────────

function supabaseGet(path, key) {
  return new Promise((resolve) => {
    const options = {
      hostname: SUPABASE_HOST,
      path: `/rest/v1/${path}`,
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function supabasePost(path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname: SUPABASE_HOST,
      path: `/rest/v1/${path}`,
      method: 'POST',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Prefer: 'return=representation',
      },
    };
    const req = https.request(options, (r) => {
      let d = '';
      r.on('data', chunk => d += chunk);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

function supabasePatch(path, key, body) {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve) => {
    const options = {
      hostname: SUPABASE_HOST,
      path: `/rest/v1/${path}`,
      method: 'PATCH',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Prefer: 'return=minimal',
      },
    };
    const req = https.request(options, (r) => {
      r.on('data', () => {});
      r.on('end', () => resolve(r.statusCode));
    });
    req.on('error', () => resolve(500));
    req.write(bodyStr);
    req.end();
  });
}

// ─── Macrocycle logic (inline — no import from src/) ────────────────────────

const OBJETIVOS = {
  base:  'Construir base aeróbica y volumen progresivo',
  build: 'Desarrollar umbral y capacidad de trabajo',
  peak:  'Máxima intensidad y simulacros de carrera',
  taper: 'Reducir volumen, llegar fresco a la carrera',
};

function calcularFases(fechaInicio, fechaFin) {
  const totalSemanas = Math.round(
    (new Date(fechaFin) - new Date(fechaInicio)) / (7 * 24 * 60 * 60 * 1000)
  );

  function withObj(fase) {
    return { ...fase, objetivo: OBJETIVOS[fase.nombre] };
  }

  if (totalSemanas <= 6) {
    return [
      { nombre: 'peak',  sem_inicio: 1, sem_fin: totalSemanas - 2 },
      { nombre: 'taper', sem_inicio: totalSemanas - 1, sem_fin: totalSemanas },
    ].map(withObj);
  }

  if (totalSemanas <= 10) {
    const buildSem = totalSemanas - 2;
    return [
      { nombre: 'build', sem_inicio: 1,            sem_fin: buildSem - 2 },
      { nombre: 'peak',  sem_inicio: buildSem - 1, sem_fin: buildSem },
      { nombre: 'taper', sem_inicio: buildSem + 1, sem_fin: totalSemanas },
    ].map(withObj);
  }

  if (totalSemanas <= 16) {
    const taper = 2, peak = 3;
    const build = Math.round((totalSemanas - taper - peak) * 0.55);
    const base  = totalSemanas - taper - peak - build;
    return [
      { nombre: 'base',  sem_inicio: 1,                sem_fin: base },
      { nombre: 'build', sem_inicio: base + 1,          sem_fin: base + build },
      { nombre: 'peak',  sem_inicio: base + build + 1,  sem_fin: totalSemanas - taper },
      { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
    ].map(withObj);
  }

  const taper = 2, peak = 4;
  const build = Math.round((totalSemanas - taper - peak) * 0.4);
  const base  = totalSemanas - taper - peak - build;
  return [
    { nombre: 'base',  sem_inicio: 1,                sem_fin: base },
    { nombre: 'build', sem_inicio: base + 1,          sem_fin: base + build },
    { nombre: 'peak',  sem_inicio: base + build + 1,  sem_fin: totalSemanas - taper },
    { nombre: 'taper', sem_inicio: totalSemanas - taper + 1, sem_fin: totalSemanas },
  ].map(withObj);
}

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const secret = (event.headers['x-tricoach-secret'] || '').trim();
  const expected = (FUNCTION_SECRET || '').trim();
  if (expected && secret !== expected) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { userId } = parsed;
  if (!userId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId requerido' }) };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(userId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'userId inválido' }) };
  }

  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  // 1. Obtener perfil
  const profiles = await supabaseGet(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
    key
  );
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Perfil no encontrado' }) };
  }

  // 2. Buscar ciclo activo existente
  const existing = await supabaseGet(
    `training_cycles?user_id=eq.${encodeURIComponent(userId)}&estado=eq.active&order=created_at.desc&limit=1`,
    key
  );
  if (Array.isArray(existing) && existing[0]) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycle: existing[0] }),
    };
  }

  // 3. Determinar fecha de carrera objetivo
  const today = new Date().toISOString().split('T')[0];
  let fechaCarrera = null;
  let carreraNombre = null;
  let carreraTipo = null;

  // Buscar en profile.carreras (array jsonb) si existe
  if (Array.isArray(profile.carreras) && profile.carreras.length > 0) {
    const futuras = profile.carreras
      .filter(c => c.fecha && c.fecha > today)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    // Prioridad: A > sin prioridad (legado) > cualquier otra
    const carreraObj = futuras.find(c => c.prioridad === 'A')
      || futuras.find(c => !c.prioridad)
      || futuras[0]
      || null;
    if (carreraObj) {
      fechaCarrera  = carreraObj.fecha;
      carreraNombre = carreraObj.nombre || null;
      carreraTipo   = carreraObj.tipo   || null;
    }
  }

  // Fallback: profile.fecha_carrera (campo existente)
  if (!fechaCarrera && profile.fecha_carrera && profile.fecha_carrera > today) {
    fechaCarrera  = profile.fecha_carrera;
    carreraNombre = profile.objetivo || null;
  }

  const fechaInicio   = getMondayOfCurrentWeek();
  const fechaFin      = fechaCarrera || addWeeks(fechaInicio, 16);
  const semanasTotales = Math.round(
    (new Date(fechaFin) - new Date(fechaInicio)) / (7 * 24 * 60 * 60 * 1000)
  );
  const fases = calcularFases(fechaInicio, fechaFin);

  // 7. INSERT en training_cycles
  const inserted = await supabasePost('training_cycles', key, {
    user_id:         userId,
    carrera_nombre:  carreraNombre,
    carrera_tipo:    carreraTipo,
    fecha_carrera:   fechaCarrera,
    fecha_inicio:    fechaInicio,
    semanas_totales: semanasTotales,
    fases,
    estado:          'active',
  });

  const cycle = Array.isArray(inserted) ? inserted[0] : null;
  if (!cycle) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al crear el ciclo' }) };
  }

  // 8. UPDATE profiles.active_cycle_id
  await supabasePatch(
    `profiles?id=eq.${encodeURIComponent(userId)}`,
    key,
    { active_cycle_id: cycle.id }
  );

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycle }),
  };
};
