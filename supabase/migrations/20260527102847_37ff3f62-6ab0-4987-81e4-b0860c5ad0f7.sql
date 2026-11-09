ALTER TABLE public.accounts ALTER COLUMN currency SET DEFAULT 'EUR';
UPDATE public.accounts SET currency = 'EUR' WHERE currency = 'BRL';