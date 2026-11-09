
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.document_type AS ENUM ('cpf', 'ssn', 'nif', 'dni', 'passport', 'other');
CREATE TYPE public.card_status AS ENUM ('solicitado', 'ativo', 'bloqueado', 'cancelado');
CREATE TYPE public.credit_status AS ENUM ('solicitado', 'em_analise', 'aprovado', 'recusado');
CREATE TYPE public.transaction_type AS ENUM ('entrada', 'saida');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  country TEXT NOT NULL DEFAULT 'BR',
  document_type public.document_type,
  document_number TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER ROLES (separado por segurança)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================
-- ACCOUNTS
-- =========================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- =========================================
-- CARDS
-- =========================================
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  last4 TEXT,
  status public.card_status NOT NULL DEFAULT 'solicitado',
  credit_limit NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- =========================================
-- CREDIT REQUESTS
-- =========================================
CREATE TABLE public.credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  status public.credit_status NOT NULL DEFAULT 'solicitado',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_transactions_user_created ON public.transactions(user_id, created_at DESC);

-- =========================================
-- TIMESTAMP TRIGGER
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_credit_requests_updated BEFORE UPDATE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- AUTO-CREATE PROFILE + ACCOUNT + ROLE ON SIGNUP
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', 'BR')
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- RLS POLICIES
-- =========================================

-- PROFILES
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER ROLES (somente leitura para o próprio usuário; só admin pode mudar)
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ACCOUNTS
CREATE POLICY "Users view own account" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update accounts" ON public.accounts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- CARDS
CREATE POLICY "Users view own cards" ON public.cards
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users request own cards" ON public.cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage cards" ON public.cards
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete cards" ON public.cards
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- CREDIT REQUESTS
CREATE POLICY "Users view own credit requests" ON public.credit_requests
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own credit requests" ON public.credit_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update credit requests" ON public.credit_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- TRANSACTIONS
CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
