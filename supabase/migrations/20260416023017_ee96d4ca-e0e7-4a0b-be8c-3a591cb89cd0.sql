
CREATE TABLE public.group_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  additions integer NOT NULL DEFAULT 0,
  removals integer NOT NULL DEFAULT 0,
  total_members integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, date, group_jid)
);

ALTER TABLE public.group_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.group_daily_stats FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws_insert" ON public.group_daily_stats FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_update" ON public.group_daily_stats FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));

CREATE POLICY "ws_delete" ON public.group_daily_stats FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

CREATE INDEX idx_group_daily_stats_ws_date ON public.group_daily_stats (workspace_id, date);
