-- ==============================================================================
-- 15_strictly_gbp_accounts_and_trigger_rollback.sql
-- Restores previous handle_new_user() implementation with country-based currency.
-- Target Staging: rbhczirsgprmynpiudmi
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code text;
  ref_uid uuid;
  user_country text;
  user_currency text;
  raw_doc_type text;
  parsed_doc_type public.document_type;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND length(trim(ref_code)) > 0 THEN
    SELECT user_id INTO ref_uid FROM public.profiles WHERE upper(referral_code) = upper(trim(ref_code));
  END IF;

  user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'GB');
  user_currency := CASE user_country
    WHEN 'GB' THEN 'GBP'
    WHEN 'US' THEN 'USD'
    WHEN 'PT' THEN 'EUR'
    WHEN 'ES' THEN 'EUR'
    WHEN 'BR' THEN 'BRL'
    ELSE 'GBP'
  END;

  raw_doc_type := NEW.raw_user_meta_data->>'document_type';
  IF raw_doc_type IN ('cpf', 'ssn', 'nif', 'dni', 'passport', 'other') THEN
    parsed_doc_type := raw_doc_type::public.document_type;
  ELSE
    parsed_doc_type := NULL;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    full_name,
    country,
    document_type,
    document_number,
    phone,
    birth_date,
    referral_code,
    referred_by,
    account_blocked,
    transfer_locked
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_country,
    parsed_doc_type,
    NEW.raw_user_meta_data->>'document_number',
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN NEW.raw_user_meta_data->>'birth_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END,
    'BB' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 6)),
    ref_uid,
    false,
    false
  ) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.accounts (user_id, account_number, balance, currency)
  VALUES (
    NEW.id,
    '20-' || LPAD((floor(random() * 1000000))::text, 6, '0') || '-' || LPAD((floor(random() * 100000000))::text, 8, '0'),
    0.00,
    user_currency
  ) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
