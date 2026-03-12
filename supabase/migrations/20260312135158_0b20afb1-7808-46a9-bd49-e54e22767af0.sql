ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lid text;

UPDATE public.conversations SET lid = remote_jid WHERE remote_jid LIKE '%@lid' AND lid IS NULL;