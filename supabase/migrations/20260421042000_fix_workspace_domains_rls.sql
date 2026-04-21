-- Fix: workspace_domains had RLS enabled but no policies — all operations were blocked
CREATE POLICY ws_select ON public.workspace_domains FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY ws_insert ON public.workspace_domains FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY ws_update ON public.workspace_domains FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY ws_delete ON public.workspace_domains FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
