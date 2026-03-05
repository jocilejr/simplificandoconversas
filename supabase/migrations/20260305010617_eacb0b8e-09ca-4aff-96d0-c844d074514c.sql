CREATE TABLE public.flow_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES flow_executions(id) ON DELETE CASCADE NOT NULL,
  flow_id uuid REFERENCES chatbot_flows(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  conversation_id uuid,
  timeout_node_id text NOT NULL,
  timeout_at timestamptz NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.flow_timeouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own timeouts" ON public.flow_timeouts FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_flow_timeouts_pending ON public.flow_timeouts (processed, timeout_at) WHERE NOT processed;