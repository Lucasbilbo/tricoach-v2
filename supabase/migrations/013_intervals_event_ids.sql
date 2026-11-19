-- 013 — IDs de los eventos que TriCoach crea en Intervals.icu (19-nov-2026)
-- generate-plan intentaba guardarlos en plans.intervals_event_ids, pero la columna no existía
-- (el PATCH fallaba en silencio). Sin ellos no se podía saber qué había enviado ya.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS intervals_event_ids jsonb;
