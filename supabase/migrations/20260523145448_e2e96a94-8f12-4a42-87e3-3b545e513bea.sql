
CREATE TABLE public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_user_notes_user_created
  ON public.admin_user_notes (user_id, created_at DESC);

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notes"
  ON public.admin_user_notes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert notes"
  ON public.admin_user_notes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = author_id);

CREATE POLICY "No updates on notes"
  ON public.admin_user_notes AS RESTRICTIVE
  FOR UPDATE TO public
  USING (false) WITH CHECK (false);

CREATE POLICY "No deletes on notes"
  ON public.admin_user_notes AS RESTRICTIVE
  FOR DELETE TO public
  USING (false);
