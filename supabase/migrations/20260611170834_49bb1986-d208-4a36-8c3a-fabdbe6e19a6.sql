CREATE OR REPLACE FUNCTION public.can_admin_see(_admin_uid uuid, _target_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  lvl text;
  ref_uid uuid;
  ref_lvl text;
BEGIN
  lvl := get_admin_level(_admin_uid);
  IF lvl IS NULL THEN RETURN false; END IF;
  IF lvl = 'master' THEN RETURN true; END IF;

  SELECT referred_by INTO ref_uid FROM profiles WHERE user_id = _target_uid;
  IF ref_uid IS NULL THEN RETURN false; END IF;

  IF lvl = 'comum' THEN
    RETURN ref_uid = _admin_uid;
  END IF;

  -- geral: vê clientes de qualquer adm_comum, adm_geral + próprios; nunca vê clientes do master
  IF ref_uid = _admin_uid THEN RETURN true; END IF;
  ref_lvl := get_admin_level(ref_uid);
  RETURN ref_lvl IN ('comum', 'geral');
END;
$function$;