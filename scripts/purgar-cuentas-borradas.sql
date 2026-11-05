-- Purga de las cuentas que el antiguo delete-account solo marcó con deleted_at
-- (hasta nov-2026 el "borrado" dejaba email, nombre, datos de salud, tokens y el
-- usuario de autenticación). Desde nov-2026 delete-account borra de verdad.
--
-- IRREVERSIBLE. Ejecutar a mano en Supabase → SQL Editor, en este orden:
--   1. Lanzar solo el bloque "1. REVISAR" y comprobar la lista.
--   2. Lanzar el bloque "2. PURGAR".
-- Excluye siempre a entrenadores y atletas del Coach Dashboard.
-- Si alguna cuenta tiene Strava conectado o cliente de Stripe, revócalo/bórralo
-- antes desde sus paneles (este SQL no llama a APIs externas).

-- ── 1. REVISAR ────────────────────────────────────────────────────────────────
select p.id, p.email, p.deleted_at,
       p.strava_token is not null as tiene_strava,
       p.stripe_customer_id
from public.profiles p
where p.deleted_at is not null
  and p.id not in (select id from public.coaches)
  and p.id not in (select athlete_id from public.coach_athletes)
order by p.deleted_at;

-- ── 2. PURGAR ─────────────────────────────────────────────────────────────────
begin;

create temp table _purga on commit drop as
  select p.id from public.profiles p
  where p.deleted_at is not null
    and p.id not in (select id from public.coaches)
    and p.id not in (select athlete_id from public.coach_athletes);

delete from public.messages where user_id in (select id from _purga);
update public.profiles set active_cycle_id = null where id in (select id from _purga);
delete from public.training_cycles where user_id in (select id from _purga);
delete from public.plans where user_id in (select id from _purga);
delete from public.profiles where id in (select id from _purga);
delete from auth.users where id in (select id from _purga);

commit;
