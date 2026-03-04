
-- Table to persist chatbot flows
CREATE TABLE public.chatbot_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flows"
  ON public.chatbot_flows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flows"
  ON public.chatbot_flows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flows"
  ON public.chatbot_flows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flows"
  ON public.chatbot_flows FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
