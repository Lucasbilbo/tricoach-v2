-- Métricas de activación de TriCoach v2 (solo lectura; ejecutar en Supabase → SQL Editor).
-- Meta (nov-2026): que 3 de cada 10 altas nuevas vuelvan en su primera semana.
-- "Vuelve" = envía al coach un mensaje en un día distinto al del alta, dentro de los 7 días siguientes.
-- Se mide desde la base de datos, no desde Analytics, para no depender de cookies.
-- Excluye entrenadores y atletas del Coach Dashboard.

with altas as (
  select p.id, p.created_at::date as dia_alta, date_trunc('week', p.created_at)::date as semana_alta,
         p.deporte is not null as onboarding_hecho
  from profiles p
  where p.created_at >= '2026-06-15'
    and p.id not in (select id from coaches)
    and p.id not in (select athlete_id from coach_athletes)
),
act as (
  select a.*,
    exists (select 1 from plans pl where pl.user_id = a.id) as tiene_plan,
    exists (select 1 from messages m where m.user_id = a.id and m.role = 'user') as escribio,
    exists (select 1 from messages m where m.user_id = a.id and m.role = 'user'
            and m.created_at::date > a.dia_alta and m.created_at::date <= a.dia_alta + 7) as vuelve_semana1
  from altas a
)
select semana_alta,
       count(*)                                      as altas,
       count(*) filter (where onboarding_hecho)      as onboarding,
       count(*) filter (where tiene_plan)            as con_plan,
       count(*) filter (where escribio)              as escribio_al_coach,
       count(*) filter (where vuelve_semana1)        as vuelve_semana1,
       round(100.0 * count(*) filter (where vuelve_semana1) / count(*), 0) as pct_vuelve
from act
group by semana_alta
order by semana_alta;
