ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_url text;