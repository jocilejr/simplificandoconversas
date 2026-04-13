ALTER TABLE public.group_smart_links ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.group_smart_links ALTER COLUMN campaign_id DROP NOT NULL;