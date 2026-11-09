-- ==============================================================================
-- 08_contact_and_complaints_schema.sql
-- B BANK UK Digital Banking - Contact Requests and Customer Complaints
-- Target Database: bankfuncional (rbhczirsgprmynpiudmi)
-- NON-DESTRUCTIVE & IDEMPOTENT EXECUTION SCRIPT
-- ==============================================================================

-- 1. Helper function: public.is_admin()
-- Authenticated identity & role verification based strictly on public.user_roles.
-- Does NOT trust client-side parameters, emails, or request headers.
-- Recognizes Admin Master ('admin'), Admin Geral ('adm_geral'), and Admin Comum ('adm_comum').
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'adm_geral', 'adm_comum')
    )
  END;
$$;

-- Secure grants for helper function
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 2. Create table public.contact_requests if not exists
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_review', 'resolved', 'closed')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create table public.customer_complaints if not exists
CREATE TABLE IF NOT EXISTS public.customer_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'transfers_payments',
        'cards',
        'account_access',
        'customer_service',
        'security_fraud',
        'fees_charges',
        'other'
    )),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'rejected')),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create non-destructive performance & lookup indexes
CREATE INDEX IF NOT EXISTS idx_contact_requests_protocol ON public.contact_requests (lower(protocol));
CREATE INDEX IF NOT EXISTS idx_contact_requests_email ON public.contact_requests (lower(email));
CREATE INDEX IF NOT EXISTS idx_contact_requests_user_id ON public.contact_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON public.contact_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_complaints_protocol ON public.customer_complaints (lower(protocol));
CREATE INDEX IF NOT EXISTS idx_customer_complaints_email ON public.customer_complaints (lower(email));
CREATE INDEX IF NOT EXISTS idx_customer_complaints_user_id ON public.customer_complaints (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_created_at ON public.customer_complaints (created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for contact_requests
DROP POLICY IF EXISTS "Public insert for contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Anyone can insert contact request" ON public.contact_requests;
CREATE POLICY "Public insert for contact requests"
ON public.contact_requests
FOR INSERT
WITH CHECK (
    user_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Users can read own contact requests or admin" ON public.contact_requests;
CREATE POLICY "Users can read own contact requests or admin"
ON public.contact_requests
FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can update contact requests" ON public.contact_requests;
CREATE POLICY "Admins can update contact requests"
ON public.contact_requests
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 7. RLS Policies for customer_complaints
DROP POLICY IF EXISTS "Public insert for complaints" ON public.customer_complaints;
DROP POLICY IF EXISTS "Anyone can insert complaint" ON public.customer_complaints;
CREATE POLICY "Public insert for complaints"
ON public.customer_complaints
FOR INSERT
WITH CHECK (
    user_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Users can read own complaints or admin" ON public.customer_complaints;
CREATE POLICY "Users can read own complaints or admin"
ON public.customer_complaints
FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can update complaints" ON public.customer_complaints;
CREATE POLICY "Admins can update complaints"
ON public.customer_complaints
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 8. Secure Tracking Function (Requires Authentication & Enforces Ownership)
-- Prevents third parties from inspecting disputes by guessing protocols.
DROP FUNCTION IF EXISTS public.track_customer_complaint(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.track_customer_complaint(TEXT);

CREATE OR REPLACE FUNCTION public.track_customer_complaint(p_protocol TEXT)
RETURNS TABLE (
    protocol TEXT,
    category TEXT,
    description TEXT,
    status TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Enforce authentication
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to track customer complaints';
    END IF;

    -- Check administrator privilege
    v_is_admin := public.is_admin();

    -- Return record ONLY if it belongs to the authenticated user OR caller is admin
    RETURN QUERY
    SELECT
        c.protocol,
        c.category,
        c.description,
        c.status,
        c.resolution_notes,
        c.created_at,
        c.resolved_at
    FROM public.customer_complaints c
    WHERE lower(trim(c.protocol)) = lower(trim(p_protocol))
      AND (v_is_admin OR c.user_id = v_uid)
    LIMIT 1;
END;
$$;

-- 9. Explicit Least-Privilege Permissions Grants
REVOKE ALL ON public.contact_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.customer_complaints FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_customer_complaint(TEXT) FROM PUBLIC, anon;

-- Public submissions allowed via controlled INSERT
GRANT INSERT ON public.contact_requests TO anon, authenticated;
GRANT INSERT ON public.customer_complaints TO anon, authenticated;

-- Read access exclusively for authenticated users (filtered by RLS)
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT SELECT ON public.customer_complaints TO authenticated;

-- Management access exclusively for authenticated users (filtered by RLS to is_admin())
GRANT UPDATE ON public.contact_requests TO authenticated;
GRANT UPDATE ON public.customer_complaints TO authenticated;

-- Tracking RPC executable ONLY by authenticated sessions and service_role
GRANT EXECUTE ON FUNCTION public.track_customer_complaint(TEXT) TO authenticated, service_role;

-- Full administrative backend access for service_role
GRANT ALL ON public.contact_requests TO service_role;
GRANT ALL ON public.customer_complaints TO service_role;
