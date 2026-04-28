CREATE TABLE public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  remote_jid text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.conversation_notes FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY ws_insert ON public.conversation_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY ws_update ON public.conversation_notes FOR UPDATE TO authenticated
  USING (public.can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY ws_delete ON public.conversation_notes FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'::public.workspace_role));

CREATE INDEX idx_conversation_notes_conv ON public.conversation_notes (conversation_id, created_at DESC);
CREATE INDEX idx_conversation_notes_workspace ON public.conversation_notes (workspace_id);

CREATE TRIGGER update_conversation_notes_updated_at
  BEFORE UPDATE ON public.conversation_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_notes;
ALTER TABLE public.conversation_notes REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_labels;
ALTER TABLE public.conversation_labels REPLICA IDENTITY FULL;