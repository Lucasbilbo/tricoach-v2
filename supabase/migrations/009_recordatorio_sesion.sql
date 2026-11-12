-- Migration 009: recordatorio por email el día de la sesión (nov-2026)
--
-- recordatorio_enviado_el → último día (Europe/Madrid) en que se mandó el recordatorio; lo marca solo
--                           la function session-reminder tras un envío correcto (máx. un email por cuenta y día).
-- recordatorios_email     → baja voluntaria: el usuario la cambia desde EditProfile (por eso NO está protegida).
-- Se puede ejecutar más de una vez.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recordatorio_enviado_el date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recordatorios_email boolean NOT NULL DEFAULT true;

-- Copia completa del trigger de la migración 008 + recordatorio_enviado_el: el usuario no puede tocarla
-- desde el navegador (si pudiera ponerla a NULL, recibiría el recordatorio más de una vez al día).
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
    NEW.capturas_semana := 0;
    NEW.capturas_semana_inicio := NULL;
    NEW.recordatorio_enviado_el := NULL;
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
    NEW.capturas_semana := OLD.capturas_semana;
    NEW.capturas_semana_inicio := OLD.capturas_semana_inicio;
    NEW.recordatorio_enviado_el := OLD.recordatorio_enviado_el;
  END IF;
  RETURN NEW;
END;
$function$;
