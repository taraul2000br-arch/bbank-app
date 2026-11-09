
-- 1. Adicionar valores ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adm_geral';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adm_comum';

-- 2. Adicionar colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
