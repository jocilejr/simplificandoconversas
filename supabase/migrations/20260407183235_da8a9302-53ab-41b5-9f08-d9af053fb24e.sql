
ALTER TABLE public.followup_settings
  ADD COLUMN IF NOT EXISTS send_at_hour text NOT NULL DEFAULT '09:00';
