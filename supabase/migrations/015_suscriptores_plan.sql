-- Migración 015: captura de email antes del registro (motor B del plan de ventas, nov-2026)
--
-- Tabla NUEVA: no toca ninguna tabla ni dato existente, así que no necesita copia previa de datos.
-- Guarda a quien deja su email en una guía o herramienta (doble confirmación, baja en un clic).
-- Solo la usan las functions con la service key: RLS activado y SIN políticas (el navegador no la ve).
--
--   estado: 'pendiente' (falta confirmar) | 'confirmado' | 'baja'
--   Una persona de baja NO se vuelve a escribir, ni siquiera si vuelve a dejar su email.
--   secuencia_n / secuencia_ultimo_at: reservados para la secuencia de emails (siguiente sesión).

CREATE TABLE IF NOT EXISTS suscriptores_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  origen text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'baja')),
  creado_at timestamptz NOT NULL DEFAULT now(),
  confirmacion_enviada_at timestamptz,
  confirmado_at timestamptz,
  baja_at timestamptz,
  secuencia_n int NOT NULL DEFAULT 0,
  secuencia_ultimo_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS suscriptores_plan_email_unico ON suscriptores_plan (lower(email));
ALTER TABLE suscriptores_plan ENABLE ROW LEVEL SECURITY;
