-- ==============================================================================;
-- ALL-IN-ONE B BANK UK STAGING SETUP SCRIPT (WITH GRANTS)
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Safe execution: 100% idempotent
-- ==============================================================================;

-- ==============================================================================
-- B BANK UK DIGITAL BANKING — STAGING BASELINE STRUCTURAL SCHEMA
-- File: supabase/prepared/00_staging_baseline_schema.sql
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Description: Consolidated, 100% conflict-free structural baseline schema.
-- Installs all 9 ENUMs, 13 core tables, triggers, helper functions, and RLS policies.
-- STRICTLY STRUCTURAL: Zero mock users, zero balances, zero transactions inserted.
-- ==============================================================================

-- 1. ENUMS (Defined with all required domain values)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'adm_geral', 'adm_comum', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('ativo', 'bloqueado', 'cancelado', 'pendente', 'encerrado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('cpf', 'ssn', 'nif', 'dni', 'passport', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_status AS ENUM ('solicitado', 'ativo', 'bloqueado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_status AS ENUM ('solicitado', 'em_analise', 'aprovado', 'recusado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_request_status AS ENUM ('solicitado', 'aprovado', 'recusado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('entrada', 'saida');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM ('solicitado', 'aprovado', 'recusado', 'bloqueado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('not_started', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. HELPER FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. PROFILES TABLE (Table 1/13)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  country TEXT NOT NULL DEFAULT 'GB',
  document_type public.document_type,
  document_number TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  referral_code TEXT,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_blocked BOOLEAN NOT NULL DEFAULT false,
  account_blocked_at TIMESTAMPTZ,
  transfer_locked BOOLEAN NOT NULL DEFAULT false,
  tag_color TEXT NOT NULL DEFAULT 'none',
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_started',
  kyc_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kyc_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_blocked_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transfer_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tag_color TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'not_started';

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 4. USER ROLES TABLE (Table 2/13)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Role verification helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

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

-- Hierarchy check: can_admin_see (Latest canonical version)
CREATE OR REPLACE FUNCTION public.can_admin_see(_admin_uid uuid, _target_uid uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
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
$$;
REVOKE EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Profile privileged updates guard
CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := public.get_admin_level(auth.uid()) IS NOT NULL;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (OLD.document_type IS NOT NULL AND NEW.document_type IS DISTINCT FROM OLD.document_type)
     OR (OLD.document_number IS NOT NULL AND NEW.document_number IS DISTINCT FROM OLD.document_number)
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.kyc_reviewed_by IS DISTINCT FROM OLD.kyc_reviewed_by
     OR NEW.kyc_reviewed_at IS DISTINCT FROM OLD.kyc_reviewed_at
     OR NEW.account_blocked IS DISTINCT FROM OLD.account_blocked
     OR NEW.account_blocked_at IS DISTINCT FROM OLD.account_blocked_at
     OR NEW.tag_color IS DISTINCT FROM OLD.tag_color
     OR NEW.transfer_locked IS DISTINCT FROM OLD.transfer_locked
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privileged_updates ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privileged_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privileged_updates();

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ACCOUNTS TABLE (Table 3/13 - Default GBP for B BANK UK)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'GBP',
  iban TEXT,
  swift TEXT,
  holder_name TEXT,
  status public.account_status NOT NULL DEFAULT 'ativo',
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  transfer_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'ativo';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS swift TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS transfer_locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

DROP TRIGGER IF EXISTS trg_accounts_updated ON public.accounts;
CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- AUTO-PROVISION PROFILE + ACCOUNT + ROLE ON USER REGISTRATION
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
  -- B BANK UK: all bank accounts operate exclusively in GBP (£)
  user_currency := 'GBP';

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
    '10-' || LPAD((floor(random() * 1000000))::text, 6, '0') || '-' || LPAD((floor(random() * 100000000))::text, 8, '0'),
    0.00,
    user_currency
  ) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. TRANSACTIONS TABLE (Table 4/13 - Audit log of debits and credits)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);

-- 7. TRANSFER REQUESTS TABLE (Table 5/13 - International transfers)
CREATE TABLE IF NOT EXISTS public.transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol TEXT,
  idempotency_key TEXT,
  beneficiary_name TEXT NOT NULL,
  beneficiary_doc TEXT NOT NULL,
  beneficiary_email TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  swift TEXT NOT NULL,
  account_number TEXT NOT NULL,
  to_country TEXT NOT NULL,
  currency_from TEXT NOT NULL DEFAULT 'GBP',
  currency_to TEXT NOT NULL DEFAULT 'USD',
  amount NUMERIC(14,2) NOT NULL,
  fx_rate NUMERIC(14,6) NOT NULL,
  converted_amount NUMERIC(14,2) NOT NULL,
  purpose TEXT NOT NULL,
  reference TEXT NOT NULL,
  hmrc_doc_path TEXT,
  rejection_reason TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'solicitado',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS protocol TEXT;
ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_transfer_requests_user ON public.transfer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON public.transfer_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_protocol ON public.transfer_requests (protocol) WHERE protocol IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_user_idempotency ON public.transfer_requests (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_transfer_requests_updated ON public.transfer_requests;
CREATE TRIGGER trg_transfer_requests_updated
  BEFORE UPDATE ON public.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. WITHDRAWAL REQUESTS TABLE (Table 6/13 - Domestic / local withdrawals)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  pix_key TEXT,
  notes TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'solicitado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_withdrawal_requests_updated ON public.withdrawal_requests;
CREATE TRIGGER trg_withdrawal_requests_updated
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. CARDS TABLE (Table 7/13)
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  last4 TEXT,
  status public.card_status NOT NULL DEFAULT 'solicitado',
  credit_limit NUMERIC(14,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_cards_updated ON public.cards;
CREATE TRIGGER trg_cards_updated
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. CARD REQUESTS TABLE (Table 8/13 - Aligned with frontend types)
CREATE TABLE IF NOT EXISTS public.card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  holder_name TEXT,
  last4 TEXT,
  expiry TEXT,
  status public.card_request_status NOT NULL DEFAULT 'solicitado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.card_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_card_requests_user ON public.card_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_card_requests_status ON public.card_requests(status);

DROP TRIGGER IF EXISTS trg_card_requests_updated ON public.card_requests;
CREATE TRIGGER trg_card_requests_updated
  BEFORE UPDATE ON public.card_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. CREDIT REQUESTS TABLE (Table 9/13)
CREATE TABLE IF NOT EXISTS public.credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  status public.credit_status NOT NULL DEFAULT 'solicitado',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_credit_requests_updated ON public.credit_requests;
CREATE TRIGGER trg_credit_requests_updated
  BEFORE UPDATE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. ADMIN PLANS TABLE (Table 10/13 - Aligned with frontend types)
CREATE TABLE IF NOT EXISTS public.admin_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'Plano Mensal',
  expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_plans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_admin_plans_updated ON public.admin_plans;
CREATE TRIGGER trg_admin_plans_updated
  BEFORE UPDATE ON public.admin_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. ADMIN USER NOTES TABLE (Table 11/13 - Aligned with frontend types)
CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  from_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user_created ON public.admin_user_notes (user_id, created_at DESC);

-- 14. KYC SUBMISSIONS TABLE (Table 12/13 - Aligned with frontend types)
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement1_path TEXT NOT NULL DEFAULT '',
  statement2_path TEXT NOT NULL DEFAULT '',
  liveness_paths TEXT[] NOT NULL DEFAULT '{}',
  rejected_parts TEXT[] NOT NULL DEFAULT '{}',
  status public.kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_kyc_submissions_updated ON public.kyc_submissions;
CREATE TRIGGER trg_kyc_submissions_updated
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. USER LOGIN EVENTS TABLE (Table 13/13 - Aligned with frontend types)
CREATE TABLE IF NOT EXISTS public.user_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'login' CHECK (event_type IN ('signup','login')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_login_events_user_id ON public.user_login_events(user_id, created_at DESC);

-- ==============================================================================
-- 16. COMPLETE ROW LEVEL SECURITY POLICIES (ALL 13 TABLES PROTECTED)
-- ==============================================================================

-- 1. PROFILES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins update profiles in scope" ON public.profiles;
CREATE POLICY "Admins update profiles in scope" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

-- 2. USER ROLES
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.get_admin_level(auth.uid()) IS NOT NULL);

-- 3. ACCOUNTS
DROP POLICY IF EXISTS "Users view own account" ON public.accounts;
CREATE POLICY "Users view own account" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins update accounts" ON public.accounts;
CREATE POLICY "Admins update accounts" ON public.accounts
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 4. TRANSACTIONS
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins insert transactions" ON public.transactions;
CREATE POLICY "Admins insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (public.can_admin_see(auth.uid(), user_id));

-- 5. TRANSFER REQUESTS
DROP POLICY IF EXISTS "Users view own transfer requests" ON public.transfer_requests;
CREATE POLICY "Users view own transfer requests" ON public.transfer_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users insert own transfer requests" ON public.transfer_requests;
CREATE POLICY "Users insert own transfer requests" ON public.transfer_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update transfer requests" ON public.transfer_requests;
CREATE POLICY "Admins update transfer requests" ON public.transfer_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 6. WITHDRAWAL REQUESTS
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users create own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users create own withdrawals" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins update withdrawals" ON public.withdrawal_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 7. CARDS
DROP POLICY IF EXISTS "Users view own cards" ON public.cards;
CREATE POLICY "Users view own cards" ON public.cards
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users request own cards" ON public.cards;
CREATE POLICY "Users request own cards" ON public.cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage cards" ON public.cards;
CREATE POLICY "Admins manage cards" ON public.cards
  FOR UPDATE USING (public.get_admin_level(auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins delete cards" ON public.cards;
CREATE POLICY "Admins delete cards" ON public.cards
  FOR DELETE USING (public.get_admin_level(auth.uid()) IS NOT NULL);

-- 8. CARD REQUESTS
DROP POLICY IF EXISTS "users view own card requests" ON public.card_requests;
CREATE POLICY "users view own card requests" ON public.card_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "users create own card requests" ON public.card_requests;
CREATE POLICY "users create own card requests" ON public.card_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins update card requests" ON public.card_requests;
CREATE POLICY "admins update card requests" ON public.card_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 9. CREDIT REQUESTS
DROP POLICY IF EXISTS "Users view own credit requests" ON public.credit_requests;
CREATE POLICY "Users view own credit requests" ON public.credit_requests
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users create own credit requests" ON public.credit_requests;
CREATE POLICY "Users create own credit requests" ON public.credit_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update credit requests" ON public.credit_requests;
CREATE POLICY "Admins update credit requests" ON public.credit_requests
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 10. ADMIN PLANS
DROP POLICY IF EXISTS "Master manages all admin plans" ON public.admin_plans;
CREATE POLICY "Master manages all admin plans" ON public.admin_plans
  FOR ALL TO authenticated
  USING (public.get_admin_level(auth.uid()) = 'master')
  WITH CHECK (public.get_admin_level(auth.uid()) = 'master');

DROP POLICY IF EXISTS "Admins view own plan" ON public.admin_plans;
CREATE POLICY "Admins view own plan" ON public.admin_plans
  FOR SELECT TO authenticated
  USING (auth.uid() = admin_user_id);

-- 11. ADMIN USER NOTES
DROP POLICY IF EXISTS "Admins view notes" ON public.admin_user_notes;
CREATE POLICY "Admins view notes" ON public.admin_user_notes
  FOR SELECT TO authenticated
  USING (public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Admins insert notes" ON public.admin_user_notes;
CREATE POLICY "Admins insert notes" ON public.admin_user_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_see(auth.uid(), user_id) AND auth.uid() = author_id);

-- 12. KYC SUBMISSIONS
DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_submissions;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id OR public.can_admin_see(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users insert own kyc" ON public.kyc_submissions;
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update kyc" ON public.kyc_submissions;
CREATE POLICY "Admins update kyc" ON public.kyc_submissions
  FOR UPDATE USING (public.can_admin_see(auth.uid(), user_id));

-- 13. USER LOGIN EVENTS
DROP POLICY IF EXISTS "Users view own login events" ON public.user_login_events;
CREATE POLICY "Users view own login events" ON public.user_login_events
  FOR SELECT USING (auth.uid() = user_id OR public.get_admin_level(auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users insert own login events" ON public.user_login_events;
CREATE POLICY "Users insert own login events" ON public.user_login_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ==============================================================================;
-- SECTION 17: PERMISSIONS & GRANTS
-- ==============================================================================;
-- ==============================================================================
-- B BANK UK DIGITAL BANKING — POSTGREST PERMISSIONS & GRANTS
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Description: Grants table and function privileges to service_role, authenticated and anon.
-- Fixes PostgreSQL Error 42501 (permission denied for table / function)
-- ==============================================================================

-- 1. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 2. Grant table permissions to service_role and authenticated across all 13 tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'accounts',
    'admin_plans',
    'admin_user_notes',
    'card_requests',
    'cards',
    'credit_requests',
    'kyc_submissions',
    'profiles',
    'transactions',
    'transfer_requests',
    'user_login_events',
    'user_roles',
    'withdrawal_requests'
  ] LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', tbl);
  END LOOP;
END;
$$;

-- 3. Sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- 4. Helper and Administrative RPC functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_level(uuid) TO authenticated, anon, service_role;



-- ==============================================================================;
-- SECTION 2: submit_transfer_atomic v2
-- ==============================================================================;

-- ==============================================================================
-- Prepared Migration 02: submit_transfer_atomic v2 (With Banking-Grade Idempotency)
-- Location: supabase/prepared/02_submit_transfer_atomic_v2.sql
-- Description: Creates an atomic PostgreSQL RPC function for submitting transfers.
-- Guarantees full transactional integrity (all-or-nothing):
--   1. Locks the user's account row with SELECT ... FOR UPDATE (serializes concurrent transfers)
--   2. Idempotency Check under lock:
--      - If idempotency_key was already processed with IDENTICAL parameters:
--        returns original transfer result immediately WITHOUT re-debiting (idempotent_replay: true).
--      - If idempotency_key was already processed with DIFFERENT parameters:
--        raises 'IDEMPOTENCY_CONFLICT' and aborts transaction.
--   3. Verifies account existence, currency match, compliance lock, and balance >= amount
--   4. Inserts into transfer_requests with persistent protocol and idempotency_key
--   5. Atomically debits the account balance
--   6. Inserts an audit transaction log in transactions ('saida')
-- If any step fails or violates constraints, PostgreSQL immediately rolls back the entire transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.submit_transfer_atomic(
  _user_id uuid,
  _protocol text,
  _beneficiary_name text,
  _beneficiary_doc text,
  _beneficiary_email text,
  _bank_name text,
  _swift text,
  _account_number text,
  _to_country text,
  _currency_from text,
  _currency_to text,
  _amount numeric,
  _fx_rate numeric,
  _converted_amount numeric,
  _purpose text,
  _reference text,
  _hmrc_doc_path text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_account_currency text;
  v_account_blocked boolean;
  v_transfer_locked boolean;
  v_transfer_id uuid;
  v_transaction_id uuid;
  v_clean_idempotency_key text;
  v_existing_id uuid;
  v_existing_protocol text;
  v_existing_status public.withdrawal_status;
  v_existing_amount numeric(14,2);
  v_existing_beneficiary_name text;
  v_existing_currency_from text;
  v_existing_currency_to text;
BEGIN
  -- 1. Input sanity checks
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  v_clean_idempotency_key := NULLIF(trim(_idempotency_key), '');

  IF _protocol IS NULL OR length(trim(_protocol)) < 8 THEN
    RAISE EXCEPTION 'Invalid transfer protocol';
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'Invalid transfer amount';
  END IF;

  IF _fx_rate IS NULL OR _fx_rate <= 0 THEN
    RAISE EXCEPTION 'Invalid fx rate';
  END IF;

  IF _converted_amount IS NULL OR _converted_amount <= 0 OR round(_converted_amount, 2) <> _converted_amount THEN
    RAISE EXCEPTION 'Invalid converted amount';
  END IF;

  -- 2. Lock the account row for update to serialize concurrent transfer requests for this user
  SELECT id, balance, currency
  INTO v_account_id, v_current_balance, v_account_currency
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- 3. Banking-Grade Idempotency Check under the row lock
  IF v_clean_idempotency_key IS NOT NULL THEN
    SELECT id, protocol, status, amount, beneficiary_name, currency_from, currency_to
    INTO v_existing_id, v_existing_protocol, v_existing_status, v_existing_amount,
         v_existing_beneficiary_name, v_existing_currency_from, v_existing_currency_to
    FROM public.transfer_requests
    WHERE user_id = _user_id AND idempotency_key = v_clean_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      -- Parameter Mismatch Detection: Rejects if same key is reused with different financial values
      IF v_existing_amount <> round(_amount, 2)
         OR v_existing_currency_from <> _currency_from
         OR v_existing_currency_to <> _currency_to
         OR v_existing_beneficiary_name <> _beneficiary_name THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % has already been used with different transfer parameters', v_clean_idempotency_key;
      END IF;

      -- Replay identical execution result WITHOUT re-debiting
      RETURN jsonb_build_object(
        'id', v_existing_id,
        'protocol', v_existing_protocol,
        'status', v_existing_status::text,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- 4. Currency validation: source currency must strictly match account currency
  IF v_account_currency IS NULL OR v_account_currency <> _currency_from THEN
    RAISE EXCEPTION 'Source currency does not match account currency';
  END IF;

  -- 5. Check profile compliance status (blocked / transfer-locked)
  SELECT account_blocked, transfer_locked
  INTO v_account_blocked, v_transfer_locked
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_account_blocked IS TRUE THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;

  IF v_transfer_locked IS TRUE THEN
    RAISE EXCEPTION 'Transfers are locked for this account';
  END IF;

  -- 6. Re-verify balance under the row-level lock
  IF v_current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 7. Insert transfer request record
  INSERT INTO public.transfer_requests (
    user_id,
    protocol,
    idempotency_key,
    beneficiary_name,
    beneficiary_doc,
    beneficiary_email,
    bank_name,
    swift,
    account_number,
    to_country,
    currency_from,
    currency_to,
    amount,
    fx_rate,
    converted_amount,
    purpose,
    reference,
    hmrc_doc_path,
    status
  ) VALUES (
    _user_id,
    _protocol,
    v_clean_idempotency_key,
    _beneficiary_name,
    _beneficiary_doc,
    _beneficiary_email,
    _bank_name,
    _swift,
    _account_number,
    _to_country,
    _currency_from,
    _currency_to,
    _amount,
    _fx_rate,
    _converted_amount,
    _purpose,
    _reference,
    _hmrc_doc_path,
    'solicitado'
  ) RETURNING id INTO v_transfer_id;

  -- 8. Debit account balance
  UPDATE public.accounts
  SET balance = balance - _amount,
      updated_at = now()
  WHERE id = v_account_id AND balance >= _amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 9. Insert audit transaction record for bank statement
  INSERT INTO public.transactions (
    user_id,
    account_id,
    type,
    amount,
    description
  ) VALUES (
    _user_id,
    v_account_id,
    'saida',
    _amount,
    'International transfer to ' || _beneficiary_name || ' (ref ' || substr(v_transfer_id::text, 1, 8) || ')'
  ) RETURNING id INTO v_transaction_id;

  -- 10. Return structured result
  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'protocol', _protocol,
    'status', 'solicitado',
    'idempotent_replay', false
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM anon;

REVOKE ALL ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.submit_transfer_atomic(
  uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text
) TO service_role;



-- ==============================================================================;
-- SECTION 3: review_transfer_atomic
-- ==============================================================================;

-- ==============================================================================
-- Prepared Migration 03: review_transfer_atomic
-- Location: supabase/prepared/03_review_transfer_atomic.sql
-- Description: Creates an atomic PostgreSQL RPC function for administrative transfer review.
-- Guarantees full transactional integrity and state-machine enforcement:
--   1. Locks the transfer_requests row with SELECT ... FOR UPDATE (serializes concurrent reviews)
--   2. Verifies current status is strictly 'solicitado' (prevents double refund / double review)
--   3. When 'aprovado': marks status as 'aprovado' without double-debiting
--   4. When 'recusado': locks account FOR UPDATE, refunds balance, logs exactly 1 'entrada' transaction, updates status
--   5. When 'bloqueado': marks status as 'bloqueado' and sets profile account_blocked = true without refunding
-- If any operation or constraint fails, PostgreSQL aborts and rolls back the entire transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.review_transfer_atomic(
  _transfer_id uuid,
  _reviewer_id uuid,
  _target_status text,
  _rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_status public.withdrawal_status;
  v_amount numeric(14,2);
  v_beneficiary_name text;
  v_protocol text;
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_clean_reason text;
  v_target_enum public.withdrawal_status;
BEGIN
  -- 1. Input sanity checks
  IF _transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transfer ID is required';
  END IF;

  IF _reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer ID is required';
  END IF;

  IF _target_status IS NULL OR _target_status NOT IN ('aprovado', 'recusado', 'bloqueado') THEN
    RAISE EXCEPTION 'Invalid target status: %', COALESCE(_target_status, 'NULL');
  END IF;

  v_target_enum := _target_status::public.withdrawal_status;
  v_clean_reason := NULLIF(trim(_rejection_reason), '');

  IF v_target_enum = 'recusado' AND v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting a transfer';
  END IF;

  -- 2. Lock the transfer request row for update to serialize concurrent admin decisions
  SELECT user_id, status, amount, beneficiary_name, protocol
  INTO v_user_id, v_current_status, v_amount, v_beneficiary_name, v_protocol
  FROM public.transfer_requests
  WHERE id = _transfer_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- 3. State machine validation: only transfers in 'solicitado' can be reviewed
  IF v_current_status <> 'solicitado' THEN
    RAISE EXCEPTION 'Transfer has already been reviewed (current status: %)', v_current_status;
  END IF;

  -- 4. Execute atomic decision branch
  IF v_target_enum = 'aprovado' THEN
    UPDATE public.transfer_requests
    SET status = 'aprovado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'recusado' THEN
    -- REJEIÇÃO E ESTORNO ATÔMICO:
    -- 1. Localiza e bloqueia a linha da conta do usuário para atualização
    SELECT id, balance
    INTO v_account_id, v_current_balance
    FROM public.accounts
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Account not found for transfer refund';
    END IF;

    -- 2. Devolve exatamente o valor da transferência ao saldo
    UPDATE public.accounts
    SET balance = balance + v_amount,
        updated_at = now()
    WHERE id = v_account_id;

    -- 3. Insere exatamente UMA transação de estorno ('entrada') no extrato
    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      'entrada',
      v_amount,
      'Transfer refund: ' || COALESCE(v_beneficiary_name, '') || ' — Reason: ' || v_clean_reason || ' (ref ' || substr(_transfer_id::text, 1, 8) || ')'
    );

    -- 4. Atualiza o status da solicitação para recusado
    UPDATE public.transfer_requests
    SET status = 'recusado',
        rejection_reason = v_clean_reason,
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = _transfer_id;

  ELSIF v_target_enum = 'bloqueado' THEN
    -- BLOQUEIO JUDICIAL / COMPLIANCE:
    -- Suspende a transferência e bloqueia a conta do usuário.
    -- O saldo retido NÃO é devolvido.
    UPDATE public.transfer_requests
    SET status = 'bloqueado',
        reviewed_by = _reviewer_id,
        reviewed_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now()
    WHERE id = _transfer_id;

    UPDATE public.profiles
    SET account_blocked = true,
        account_blocked_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;

  END IF;

  -- 5. Return structured result
  RETURN jsonb_build_object(
    'ok', true,
    'id', _transfer_id,
    'status', _target_status
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.review_transfer_atomic(
  uuid, uuid, text, text
) TO service_role;



-- ==============================================================================;
-- SECTION 4: admin_update_balance_atomic
-- ==============================================================================;

-- ==============================================================================
-- Prepared Migration 04: admin_update_balance_atomic
-- Location: supabase/prepared/04_admin_update_balance_atomic.sql
-- Description: Creates an atomic PostgreSQL RPC function for administrative manual balance adjustments.
-- Guarantees full transactional integrity and concurrency safety:
--   1. Locks the user's account row with SELECT ... FOR UPDATE (serializes concurrent modifications)
--   2. Verifies expected_current_balance matches the actual locked balance (optimistic conflict detection)
--   3. If balance changed concurrently, raises an exception and aborts without overwriting
--   4. If balances match, calculates delta, updates balance, and logs an audit transaction ('entrada' or 'saida')
-- If any operation or constraint fails, PostgreSQL aborts and rolls back the entire transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_balance_atomic(
  _admin_id uuid,
  _user_id uuid,
  _new_balance numeric,
  _expected_current_balance numeric,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_current_balance numeric(14,2);
  v_delta numeric(14,2);
  v_clean_reason text;
  v_tx_type public.transaction_type;
  v_tx_description text;
BEGIN
  -- 1. Input sanity checks
  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin ID is required';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF _new_balance IS NULL OR _new_balance < 0 OR round(_new_balance, 2) <> _new_balance THEN
    RAISE EXCEPTION 'New balance cannot be negative';
  END IF;

  IF _expected_current_balance IS NULL THEN
    RAISE EXCEPTION 'Expected current balance is required for concurrency check';
  END IF;

  v_clean_reason := NULLIF(trim(_reason), '');

  -- 2. Lock the account row for update to serialize concurrent modifications
  SELECT id, balance
  INTO v_account_id, v_current_balance
  FROM public.accounts
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found for user';
  END IF;

  -- 3. Optimistic conflict detection under the lock
  IF round(v_current_balance, 2) <> round(_expected_current_balance, 2) THEN
    RAISE EXCEPTION 'The account balance changed while you were editing. Refresh and try again.';
  END IF;

  -- 4. Calculate delta and update account
  v_delta := round(_new_balance, 2) - round(v_current_balance, 2);

  UPDATE public.accounts
  SET balance = round(_new_balance, 2),
      updated_at = now()
  WHERE id = v_account_id;

  -- 5. Insert audit transaction record if delta is non-zero
  IF v_delta > 0 THEN
    v_tx_type := 'entrada';
    v_tx_description := 'Administrative balance credit';
    IF v_clean_reason IS NOT NULL THEN
      v_tx_description := v_tx_description || ' — Reason: ' || v_clean_reason;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      _user_id,
      v_account_id,
      v_tx_type,
      v_delta,
      v_tx_description
    );
  ELSIF v_delta < 0 THEN
    v_tx_type := 'saida';
    v_tx_description := 'Administrative balance debit';
    IF v_clean_reason IS NOT NULL THEN
      v_tx_description := v_tx_description || ' — Reason: ' || v_clean_reason;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      account_id,
      type,
      amount,
      description
    ) VALUES (
      _user_id,
      v_account_id,
      v_tx_type,
      abs(v_delta),
      v_tx_description
    );
  END IF;

  -- 6. Return structured result
  RETURN jsonb_build_object(
    'ok', true,
    'previous_balance', v_current_balance,
    'new_balance', round(_new_balance, 2),
    'delta', v_delta
  );
END;
$$;

-- Security hardening: Restrict execution strictly to service_role (invoked via server-side functions)
REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_balance_atomic(
  uuid, uuid, numeric, numeric, text
) TO service_role;



-- ==============================================================================;
-- SECTION 5: FINAL COMPREHENSIVE GRANTS
-- ==============================================================================;

-- ==============================================================================
-- B BANK UK DIGITAL BANKING — POSTGREST PERMISSIONS & GRANTS
-- Target Project: bankfuncional (rbhczirsgprmynpiudmi)
-- Description: Grants table and function privileges to service_role, authenticated and anon.
-- Fixes PostgreSQL Error 42501 (permission denied for table / function)
-- ==============================================================================

-- 1. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 2. Grant table permissions to service_role and authenticated across all 13 tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'accounts',
    'admin_plans',
    'admin_user_notes',
    'card_requests',
    'cards',
    'credit_requests',
    'kyc_submissions',
    'profiles',
    'transactions',
    'transfer_requests',
    'user_login_events',
    'user_roles',
    'withdrawal_requests'
  ] LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', tbl);
  END LOOP;
END;
$$;

-- 3. Sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- 4. Helper and Administrative RPC functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_see(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_level(uuid) TO authenticated, anon, service_role;
