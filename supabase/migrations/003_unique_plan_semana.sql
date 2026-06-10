-- Migration 003: idempotencia de planes — UNIQUE (user_id, semana)
-- Ejecutar A MANO en el SQL Editor: supabase.com/dashboard/project/luqpjgzpydquqturgjmt/editor
-- ⚠️ EJECUTAR ANTES de lanzar la Fase 1 (generación automática semanal).
--
-- Auditoría 9-jun-2026: 51 planes, 8 pares (user_id, semana) con duplicados
-- (hasta 9 filas para la misma semana). Paso 1 los limpia conservando el plan
-- más reciente (created_at máximo; desempate por id).

-- Paso 1: eliminar duplicados — conserva la fila más reciente de cada (user_id, semana)
DELETE FROM plans p
USING plans q
WHERE p.user_id = q.user_id
  AND p.semana = q.semana
  AND (p.created_at < q.created_at
       OR (p.created_at = q.created_at AND p.id < q.id));

-- Paso 2: constraint de unicidad — protege el flujo manual y el futuro cron
ALTER TABLE plans
  ADD CONSTRAINT plans_user_semana_unique UNIQUE (user_id, semana);
