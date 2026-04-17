CREATE INDEX IF NOT EXISTS idx_group_participant_events_workspace_group_created_action
ON public.group_participant_events (workspace_id, group_jid, created_at DESC, action);