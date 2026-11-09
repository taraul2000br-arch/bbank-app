ALTER TABLE public.profiles ALTER COLUMN transfer_locked SET DEFAULT false;
UPDATE public.profiles SET transfer_locked = false WHERE transfer_locked IS DISTINCT FROM false;