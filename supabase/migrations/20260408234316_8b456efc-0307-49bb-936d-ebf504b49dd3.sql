ALTER TABLE public.transactions ADD COLUMN viewed_at timestamptz DEFAULT NULL;
UPDATE public.transactions SET viewed_at = now() WHERE viewed_at IS NULL;