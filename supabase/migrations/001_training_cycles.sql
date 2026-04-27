-- Migration 001: training_cycles table + plans + profiles extensions
-- Run in Supabase SQL editor: supabase.com/dashboard/project/luqpjgzpydquqturgjmt/editor
-- All statements use IF NOT EXISTS — safe to run on live data.

-- ─── 1. Nueva tabla training_cycles ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_cycles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  carrera_nombre  text,
  carrera_tipo    text,
  fecha_carrera   date,
  fecha_inicio    date NOT NULL,
  semanas_totales integer NOT NULL,
  fases           jsonb NOT NULL,
  estado          text DEFAULT 'active',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_cycles_user_estado ON training_cycles(user_id, estado);

-- ─── 2. Extensión de plans ───────────────────────────────────────────────────

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS cycle_id              uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS numero_semana         integer,
  ADD COLUMN IF NOT EXISTS fase                  text,
  ADD COLUMN IF NOT EXISTS objetivo_semana       text,
  ADD COLUMN IF NOT EXISTS volumen_planificado_min integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumen_real_min       integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_plans_cycle ON plans(user_id, cycle_id);

-- ─── 3. Extensión de profiles ────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_cycle_id      uuid REFERENCES training_cycles(id),
  ADD COLUMN IF NOT EXISTS fc_maxima            integer,
  ADD COLUMN IF NOT EXISTS pace_5k              text,
  ADD COLUMN IF NOT EXISTS pace_10k             text,
  ADD COLUMN IF NOT EXISTS pace_media_maraton   text,
  ADD COLUMN IF NOT EXISTS ftp_bici             integer,
  ADD COLUMN IF NOT EXISTS ritmo_natacion_100m  text;
