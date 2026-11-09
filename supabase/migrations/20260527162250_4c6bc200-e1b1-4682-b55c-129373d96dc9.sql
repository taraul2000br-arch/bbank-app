
CREATE TABLE public.admin_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL UNIQUE,
  plan_name TEXT NOT NULL DEFAULT 'Plano Mensal',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_plans TO authenticated;
GRANT ALL ON public.admin_plans TO service_role;

ALTER TABLE public.admin_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master manages all admin plans"
ON public.admin_plans
FOR ALL
TO authenticated
USING (public.get_admin_level(auth.uid()) = 'master')
WITH CHECK (public.get_admin_level(auth.uid()) = 'master');

CREATE POLICY "Admins view own plan"
ON public.admin_plans
FOR SELECT
TO authenticated
USING (auth.uid() = admin_user_id);

CREATE TRIGGER update_admin_plans_updated_at
BEFORE UPDATE ON public.admin_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
