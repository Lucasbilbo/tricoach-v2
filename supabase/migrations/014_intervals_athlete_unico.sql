-- 014 — Un calendario de Intervals.icu solo puede estar ligado a una cuenta (20-nov-2026)
-- Dos cuentas de Lucas compartían intervals_athlete_id y cada plan se enviaba dos veces al mismo Garmin.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_intervals_athlete_id_key
  ON profiles (intervals_athlete_id)
  WHERE intervals_athlete_id IS NOT NULL;
