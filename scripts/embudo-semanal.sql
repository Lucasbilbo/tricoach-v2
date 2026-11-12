-- Embudo semanal de TriCoach v2 (solo lectura; ejecutar en Supabase → SQL Editor, cada lunes).
-- Una fila por semana de alta. Solo cuenta personas, nunca devuelve emails ni nombres.
-- Pasos: alta → onboarding → plan generado → marcó una sesión → vuelve en 7 días → Pro de pago.
-- Excluye entrenadores y atletas del Coach Dashboard. Desde el 15-jun-2026 (coach reactivado).
-- "Marcó una sesión" = alguna sesión de algún plan con completada = true.
-- "Pro de pago" = profiles.plan = 'pro' hoy (no incluye la prueba de 7 días).

with altas as (
  select p.id, p.created_at::date as dia_alta, date_trunc('week', p.created_at)::date as semana_alta,
         p.deporte is not null as onboarding_hecho, p.plan = 'pro' as es_pro
  from profiles p
  where p.created_at >= '2026-06-15'
    and p.id not in (select id from coaches)
    and p.id not in (select athlete_id from coach_athletes)
),
act as (
  select a.*,
    exists (select 1 from plans pl where pl.user_id = a.id) as tiene_plan,
    exists (select 1 from plans pl where pl.user_id = a.id
            and jsonb_path_exists(pl.sesiones, '$[*] ? (@.completada == true)')) as marco_sesion,
    exists (select 1 from messages m where m.user_id = a.id and m.role = 'user'
            and m.created_at::date > a.dia_alta and m.created_at::date <= a.dia_alta + 7) as vuelve_semana1
  from altas a
)
select semana_alta,
       count(*)                                    as altas,
       count(*) filter (where onboarding_hecho)    as onboarding,
       count(*) filter (where tiene_plan)          as con_plan,
       count(*) filter (where marco_sesion)        as marco_sesion,
       count(*) filter (where vuelve_semana1)      as vuelve_7d,
       count(*) filter (where es_pro)              as pro_de_pago,
       round(100.0 * count(*) filter (where tiene_plan) / count(*), 0)       as pct_con_plan,
       round(100.0 * count(*) filter (where vuelve_semana1) / count(*), 0)   as pct_vuelve
from act
group by semana_alta
order by semana_alta desc;
