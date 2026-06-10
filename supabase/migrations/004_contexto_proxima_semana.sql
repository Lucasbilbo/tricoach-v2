-- Migration 004: nota semanal para la generación automática de planes (Fase 1)
-- Ejecutar A MANO en el SQL Editor: supabase.com/dashboard/project/luqpjgzpydquqturgjmt/editor
--
-- El usuario escribe "Notas para la próxima semana" en WeeklyPlan; el cron del
-- lunes (auto-plans) la pasa a generate-plan como contexto_semana y la LIMPIA
-- tras usarla (lo temporal no debe sangrar a semanas futuras — tasks/lessons.md).
-- El orquestador tolera que esta columna no exista todavía (funciona sin notas).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contexto_proxima_semana text;
