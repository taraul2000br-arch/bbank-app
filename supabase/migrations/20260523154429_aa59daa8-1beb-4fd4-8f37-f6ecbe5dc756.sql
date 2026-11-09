
CREATE TYPE public.card_request_status AS ENUM ('solicitado','aprovado','recusado');

CREATE TABLE public.card_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.card_request_status NOT NULL DEFAULT 'solicitado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_requests_user ON public.card_requests(user_id);
CREATE INDEX idx_card_requests_status ON public.card_requests(status);

ALTER TABLE public.card_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own card requests"
  ON public.card_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "users create own card requests"
  ON public.card_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins update card requests"
  ON public.card_requests FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_card_requests_updated
  BEFORE UPDATE ON public.card_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
