-- Migration 005: prueba gratuita de Pro (7 días, sin tarjeta) para cuentas nuevas
--
-- `trial_ends_at` marca hasta cuándo una cuenta Free disfruta de Pro (Sonnet, 20 mensajes/día).
-- Strava, Intervals y el feedback post-entreno siguen reservados a plan='pro' de pago
-- (Strava limita la app a 10 atletas conectados).
--
-- Importante: la columna se crea SIN default y el default se añade después, así las filas
-- que ya existen (usuarios antiguos y atletas del Coach Dashboard) quedan en NULL = sin prueba.
-- Solo las cuentas creadas a partir de ahora reciben now() + 7 días.
-- Para regalar la prueba a alguien concreto:
--   update profiles set trial_ends_at = now() + interval '7 days' where email = '...';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE profiles ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');
