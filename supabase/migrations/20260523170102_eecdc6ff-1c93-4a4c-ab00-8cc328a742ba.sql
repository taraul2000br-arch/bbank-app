
-- Helpers
CREATE OR REPLACE FUNCTION public.get_admin_level(_uid uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid AND role::text = 'admin') THEN 'master'
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid AND role::text = 'adm_geral') THEN 'geral'
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid AND role::text = 'adm_comum') THEN 'comum'
    ELSE NULL
  END
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_level(uuid) FROM PUBLIC, anon, authenticated;

-- can_admin_see: true se o admin _admin_uid pode ver/editar o cliente _target_uid
CREATE OR REPLACE FUNCTION public.can_admin_see(_admin_uid uuid, _target_uid uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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

  -- geral: só vê clientes captados por adm_comum
  ref_lvl := get_admin_level(ref_uid);
  RETURN ref_lvl = 'comum';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3. Trigger handle_new_user — gravar referred_by a partir do referral_code do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ref_code text;
  ref_uid uuid;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND length(ref_code) > 0 THEN
    SELECT user_id INTO ref_uid FROM public.profiles WHERE referral_code = upper(ref_code);
  END IF;

  INSERT INTO public.profiles (user_id, full_name, country, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', 'BR'),
    ref_uid
  );

  INSERT INTO public.accounts (user_id, account_number, balance, currency)
  VALUES (
    NEW.id,
    LPAD((floor(random() * 100000000))::text, 8, '0') || '-' || (floor(random() * 10))::text,
    0,
    CASE COALESCE(NEW.raw_user_meta_data->>'country', 'BR')
      WHEN 'BR' THEN 'BRL'
      WHEN 'US' THEN 'USD'
      WHEN 'PT' THEN 'EUR'
      WHEN 'ES' THEN 'EUR'
      ELSE 'USD'
    END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Garantir trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Atualizar policies das tabelas-alvo
-- PROFILES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.can_admin_see(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Admins update profiles in scope" ON public.profiles;
CREATE POLICY "Admins update profiles in scope" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.can_admin_see(auth.uid(), user_id)
  );

-- ACCOUNTS
DROP POLICY IF EXISTS "Users view own account" ON public.accounts;
CREATE POLICY "Users view own account" ON public.accounts
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Admins update accounts" ON public.accounts;
CREATE POLICY "Admins update accounts" ON public.accounts
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- CARD REQUESTS
DROP POLICY IF EXISTS "users view own card requests" ON public.card_requests;
CREATE POLICY "users view own card requests" ON public.card_requests
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );
DROP POLICY IF EXISTS "admins update card requests" ON public.card_requests;
CREATE POLICY "admins update card requests" ON public.card_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- CREDIT REQUESTS
DROP POLICY IF EXISTS "Users view own credit requests" ON public.credit_requests;
CREATE POLICY "Users view own credit requests" ON public.credit_requests
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );
DROP POLICY IF EXISTS "Admins update credit requests" ON public.credit_requests;
CREATE POLICY "Admins update credit requests" ON public.credit_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- WITHDRAWAL REQUESTS
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );
DROP POLICY IF EXISTS "Admins update withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins update withdrawals" ON public.withdrawal_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );
DROP POLICY IF EXISTS "Admins insert transactions" ON public.transactions;
CREATE POLICY "Admins insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (public.can_admin_see(auth.uid(), user_id));

-- CARDS
DROP POLICY IF EXISTS "Users view own cards" ON public.cards;
CREATE POLICY "Users view own cards" ON public.cards
  FOR SELECT USING (
    auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id)
  );

-- ADMIN_USER_NOTES
DROP POLICY IF EXISTS "Admins view notes" ON public.admin_user_notes;
CREATE POLICY "Admins view notes" ON public.admin_user_notes
  FOR SELECT TO authenticated USING (public.can_admin_see(auth.uid(), user_id));
DROP POLICY IF EXISTS "Admins insert notes" ON public.admin_user_notes;
CREATE POLICY "Admins insert notes" ON public.admin_user_notes
  FOR INSERT TO authenticated WITH CHECK (
    public.can_admin_see(auth.uid(), user_id) AND auth.uid() = author_id
  );
