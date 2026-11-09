-- ==============================================================================
-- Prepared Script 05: Mock Seed Data for Isolated Staging Environment (GBP British Banking)
-- Location: supabase/prepared/05_mock_seed_data.sql
-- Description: Creates 100% synthetic, fictional accounts for testing.
-- STRICTLY FOR ISOLATED DEV/TEST/STAGING ENVIRONMENTS.
-- DO NOT RUN ON PRODUCTION.
-- ==============================================================================

-- 0. Satisfy auth.users Foreign Key Constraints (Clean Synthetic Auth Records)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'john.sim@bbank-simulation.co.uk',
  crypt('SimulatedTestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"John Simulation Doe"}',
  now(),
  now()
),
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'blocked.sim@bbank-simulation.co.uk',
  crypt('SimulatedTestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Blocked Compliance Client"}',
  now(),
  now()
),
(
  '99999999-9999-9999-9999-999999999999',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin.sim@bbank-simulation.co.uk',
  crypt('SimulatedTestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Synthetic Admin Reviewer"}',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 1. Standard Active Test Client (Balance: £ 1,000.00 GBP)
INSERT INTO public.profiles (
  user_id,
  full_name,
  email,
  country,
  account_blocked,
  transfer_locked,
  created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'John Simulation Doe',
  'john.sim@bbank-simulation.co.uk',
  'GB',
  false,
  false,
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  account_blocked = false,
  transfer_locked = false;

INSERT INTO public.accounts (
  id,
  user_id,
  account_number,
  balance,
  currency,
  status,
  is_blocked,
  transfer_locked,
  created_at,
  updated_at
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'GB29BARC20000000000001',
  1000.00,
  'GBP',
  'ativo',
  false,
  false,
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  balance = 1000.00,
  currency = 'GBP',
  is_blocked = false,
  status = 'ativo';

-- 2. Blocked Compliance Test Client (Balance: £ 500.00 GBP)
INSERT INTO public.profiles (
  user_id,
  full_name,
  email,
  country,
  account_blocked,
  transfer_locked,
  created_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Blocked Compliance Client',
  'blocked.sim@bbank-simulation.co.uk',
  'GB',
  true,
  true,
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  account_blocked = true,
  transfer_locked = true;

INSERT INTO public.accounts (
  id,
  user_id,
  account_number,
  balance,
  currency,
  status,
  is_blocked,
  transfer_locked,
  created_at,
  updated_at
) VALUES (
  'a2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'GB29BARC20000000000002',
  500.00,
  'GBP',
  'bloqueado',
  true,
  true,
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  balance = 500.00,
  currency = 'GBP',
  is_blocked = true,
  status = 'bloqueado';

-- 3. Synthetic Master Admin (For Administrative RPC Testing)
INSERT INTO public.profiles (
  user_id,
  full_name,
  email,
  country,
  account_blocked,
  transfer_locked,
  created_at
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'Synthetic Admin Reviewer',
  'admin.sim@bbank-simulation.co.uk',
  'GB',
  false,
  false,
  now()
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (
  user_id,
  role
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'admin'
) ON CONFLICT DO NOTHING;
