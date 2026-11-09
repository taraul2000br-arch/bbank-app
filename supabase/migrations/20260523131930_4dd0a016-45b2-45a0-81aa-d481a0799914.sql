
CREATE TABLE public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('signup','login')),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_login_events_user_id ON public.user_login_events(user_id, created_at DESC);

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all login events"
  ON public.user_login_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
