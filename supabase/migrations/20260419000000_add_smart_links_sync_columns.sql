ALTER TABLE public.group_smart_links
  ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz DEFAULT NULL;
