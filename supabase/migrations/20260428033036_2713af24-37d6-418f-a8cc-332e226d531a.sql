ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS transcription text;
NOTIFY pgrst, 'reload schema';