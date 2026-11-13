-- Migración 012: baja de emails de TriCoach (nov-2026)
--
-- emails_baja_at → momento en que la persona se dio de baja de los emails de TriCoach
-- (enlace de baja del pie, firmado, vía netlify/functions/baja-emails.js). NULL = recibe emails.
-- Todas las functions que mandan emails a usuarios filtran por emails_baja_at IS NULL.
-- No hace falta tocar el trigger profiles_proteger_campos: el usuario solo puede darse de baja a sí mismo.
--
-- ORDEN: aplicar esta migración ANTES de fusionar el PR (las consultas de los crons usan la columna).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emails_baja_at timestamptz;
