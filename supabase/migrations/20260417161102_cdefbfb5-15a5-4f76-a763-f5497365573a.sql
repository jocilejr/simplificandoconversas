ALTER TABLE public.group_selected
  ADD COLUMN IF NOT EXISTS member_count_updated_at timestamptz;