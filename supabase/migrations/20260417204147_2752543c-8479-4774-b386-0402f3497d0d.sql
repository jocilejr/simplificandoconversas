DROP TABLE IF EXISTS public.group_participant_events CASCADE;

CREATE TABLE public.group_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  instance_name   text NOT NULL,
  group_jid       text NOT NULL,
  group_name      text,
  participant_jid text NOT NULL,
  action          text NOT NULL CHECK (action IN ('add','remove')),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  raw_payload     jsonb
);

CREATE INDEX idx_group_events_ws_time ON public.group_events (workspace_id, occurred_at DESC);
CREATE INDEX idx_group_events_ws_group_action ON public.group_events (workspace_id, instance_name, group_jid, action);

ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.group_events
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

NOTIFY pgrst, 'reload schema';