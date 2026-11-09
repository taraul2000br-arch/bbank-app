CREATE OR REPLACE FUNCTION public.can_admin_see(_admin_uid uuid, _target_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  lvl text;
  ref_uid uuid;
  ref_lvl text;
  ref_email text;
BEGIN
  lvl := get_admin_level(_admin_uid);
  IF lvl IS NULL THEN RETURN false; END IF;
  IF lvl = 'master' THEN RETURN true; END IF;

  SELECT referred_by INTO ref_uid FROM profiles WHERE user_id = _target_uid;
  IF ref_uid IS NULL THEN RETURN false; END IF;

  IF ref_uid = _admin_uid THEN RETURN true; END IF;

  IF lvl = 'comum' THEN
    RETURN false;
  END IF;

  SELECT lower(email) INTO ref_email FROM auth.users WHERE id = ref_uid;
  IF ref_email = 'user@bbank.com' THEN RETURN false; END IF;

  ref_lvl := get_admin_level(ref_uid);
  RETURN ref_lvl = 'comum';
END;
$function$;