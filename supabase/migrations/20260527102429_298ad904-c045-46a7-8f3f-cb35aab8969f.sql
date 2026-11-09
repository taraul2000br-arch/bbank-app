ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS holder_name text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS swift text;