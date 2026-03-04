
CREATE TABLE public.flow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_node_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flow_executions"
ON public.flow_executions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flow_executions"
ON public.flow_executions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flow_executions"
ON public.flow_executions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flow_executions"
ON public.flow_executions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_flow_executions_updated_at
BEFORE UPDATE ON public.flow_executions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
