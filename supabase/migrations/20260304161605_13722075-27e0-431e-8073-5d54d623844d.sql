ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_public_url text;
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS preview_title text;
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS preview_description text;
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS preview_image text;