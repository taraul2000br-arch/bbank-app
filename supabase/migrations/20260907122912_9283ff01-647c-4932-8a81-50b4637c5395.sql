ALTER TABLE public.admin_user_notes
  ADD COLUMN IF NOT EXISTS from_admin_id uuid,
  ADD COLUMN IF NOT EXISTS to_admin_id uuid,
  ADD COLUMN IF NOT EXISTS actor_admin_id uuid;