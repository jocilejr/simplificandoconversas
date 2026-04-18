CREATE TABLE public.quick_reply_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

ALTER TABLE public.quick_reply_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.quick_reply_categories FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.quick_reply_categories FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.quick_reply_categories FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.quick_reply_categories FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

INSERT INTO public.quick_reply_categories (workspace_id, user_id, name)
SELECT DISTINCT workspace_id, user_id, category
FROM public.quick_replies
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';