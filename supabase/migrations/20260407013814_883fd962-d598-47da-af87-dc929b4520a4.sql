
-- Fix: allow any authenticated user to create a workspace
-- The trigger auto_add_workspace_creator will add them as admin member
DROP POLICY IF EXISTS "ws_insert" ON public.workspaces;
CREATE POLICY "ws_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Performance: composite index for RLS membership lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace
  ON public.workspace_members(user_id, workspace_id);
