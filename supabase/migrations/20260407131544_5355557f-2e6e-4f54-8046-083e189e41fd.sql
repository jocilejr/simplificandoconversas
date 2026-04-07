ALTER TABLE public.recovery_settings 
  ADD COLUMN IF NOT EXISTS instance_boleto text,
  ADD COLUMN IF NOT EXISTS instance_pix text,
  ADD COLUMN IF NOT EXISTS instance_yampi text;