ALTER TABLE public.workspace_members
ADD COLUMN permissions jsonb NOT NULL DEFAULT '{}'::jsonb;