
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tag_color text NOT NULL DEFAULT 'none'
  CHECK (tag_color IN ('none','green','red','yellow','purple'));

CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.get_admin_level(auth.uid()) IS NOT NULL;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR NEW.document_number IS DISTINCT FROM OLD.document_number
     OR NEW.kyc_reviewed_by IS DISTINCT FROM OLD.kyc_reviewed_by
     OR NEW.kyc_reviewed_at IS DISTINCT FROM OLD.kyc_reviewed_at
     OR NEW.account_blocked IS DISTINCT FROM OLD.account_blocked
     OR NEW.account_blocked_at IS DISTINCT FROM OLD.account_blocked_at
     OR NEW.tag_color IS DISTINCT FROM OLD.tag_color
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;
