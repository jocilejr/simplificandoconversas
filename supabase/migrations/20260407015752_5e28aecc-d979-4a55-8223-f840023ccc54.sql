DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role)
  );