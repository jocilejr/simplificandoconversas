CREATE TABLE public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  execution_id uuid,
  remote_jid text NOT NULL,
  original_url text NOT NULL,
  short_code text UNIQUE NOT NULL,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  next_node_id text,
  conversation_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracked_links" ON public.tracked_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracked_links" ON public.tracked_links FOR INSERT WITH CHECK (auth.uid() = user_id);