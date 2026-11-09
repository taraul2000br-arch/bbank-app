
CREATE TYPE public.withdrawal_status AS ENUM ('solicitado', 'aprovado', 'recusado');

CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL DEFAULT 'pix',
  pix_key TEXT,
  notes TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'solicitado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own withdrawals"
ON public.withdrawal_requests FOR SELECT
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own withdrawals"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update withdrawals"
ON public.withdrawal_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
