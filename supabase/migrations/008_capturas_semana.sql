-- Migration 008: límite semanal de capturas de entreno en Free (nov-2026)
--
-- Free: 2 capturas por semana (lunes a domingo, hora de Madrid). Pro y prueba Pro: sin tope semanal.
-- capturas_semana        → capturas leídas en la semana de capturas_semana_inicio
-- capturas_semana_inicio → lunes de esa semana; al cambiar de semana el contador vuelve a 1
-- Se puede ejecutar más de una vez.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS capturas_semana int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS capturas_semana_inicio date;

-- Suma una captura de forma atómica y devuelve el total de la semana.
CREATE OR REPLACE FUNCTION public.registrar_captura(p_user_id uuid, p_lunes date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE total int;
BEGIN
  UPDATE public.profiles
  SET capturas_semana = CASE WHEN capturas_semana_inicio = p_lunes THEN capturas_semana + 1 ELSE 1 END,
      capturas_semana_inicio = p_lunes
  WHERE id = p_user_id
  RETURNING capturas_semana INTO total;
  RETURN COALESCE(total, -1);
END; $$;
REVOKE ALL ON FUNCTION public.registrar_captura(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_captura(uuid, date) TO service_role;

-- El contador no lo puede tocar el propio usuario desde el navegador (igual que plan y trial_ends_at).
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
  END IF;
  RETURN NEW;
END;
$function$;
