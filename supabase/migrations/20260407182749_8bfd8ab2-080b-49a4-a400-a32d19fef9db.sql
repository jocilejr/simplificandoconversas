
ALTER TABLE public.recovery_settings
  ADD COLUMN IF NOT EXISTS enabled_boleto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_pix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_yampi boolean NOT NULL DEFAULT false;

-- Migrate existing enabled value to all three
UPDATE public.recovery_settings
SET enabled_boleto = enabled, enabled_pix = enabled, enabled_yampi = enabled;
