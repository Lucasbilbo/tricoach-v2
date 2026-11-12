-- Migration 007: marcas de envío de los emails a usuarios (nov-2026)
--
-- trial_aviso_enviado_at  → aviso "tu prueba Pro termina en 2 días" (trial-reminder.js). Una sola vez.
-- recuperacion_enviada_at → email único de recuperación a las altas que hicieron onboarding
--                           y nunca tuvieron plan (recuperacion-altas.js). Una sola vez.
-- Sin estas marcas un cron que se repite mandaría el mismo email dos veces.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_aviso_enviado_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recuperacion_enviada_at timestamptz;

-- La prueba Pro no la puede tocar el propio usuario. Hasta ahora el trigger protegía `plan`
-- pero no `trial_ends_at`: cualquier cuenta podía alargarse la prueba desde el navegador
-- y tener el coach avanzado gratis para siempre. Solo el servidor (service role) la cambia.
CREATE OR REPLACE FUNCTION public.profiles_proteger_campos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan := 'free';
    NEW.stripe_customer_id := NULL;
    NEW.messages_today := 0;
    NEW.last_message_date := NULL;
    NEW.ajustes_hoy := 0;
    NEW.ultima_fecha_ajuste := NULL;
    NEW.deleted_at := NULL;
    NEW.created_at := now();
    NEW.trial_ends_at := now() + interval '7 days';
    NEW.trial_aviso_enviado_at := NULL;
    NEW.recuperacion_enviada_at := NULL;
  ELSE
    NEW.id := OLD.id;
    NEW.plan := OLD.plan;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.messages_today := OLD.messages_today;
    NEW.last_message_date := OLD.last_message_date;
    NEW.ajustes_hoy := OLD.ajustes_hoy;
    NEW.ultima_fecha_ajuste := OLD.ultima_fecha_ajuste;
    NEW.deleted_at := OLD.deleted_at;
    NEW.created_at := OLD.created_at;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.trial_aviso_enviado_at := OLD.trial_aviso_enviado_at;
    NEW.recuperacion_enviada_at := OLD.recuperacion_enviada_at;
  END IF;
  RETURN NEW;
END;
$function$;
