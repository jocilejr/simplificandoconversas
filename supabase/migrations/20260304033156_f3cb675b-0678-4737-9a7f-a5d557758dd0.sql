
-- Quick Replies table
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick_replies" ON public.quick_replies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quick_replies" ON public.quick_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quick_replies" ON public.quick_replies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quick_replies" ON public.quick_replies FOR DELETE USING (auth.uid() = user_id);

-- Labels table
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own labels" ON public.labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own labels" ON public.labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own labels" ON public.labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own labels" ON public.labels FOR DELETE USING (auth.uid() = user_id);

-- Conversation-Labels junction table
CREATE TABLE public.conversation_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, label_id)
);

ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation_labels" ON public.conversation_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversation_labels" ON public.conversation_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversation_labels" ON public.conversation_labels FOR DELETE USING (auth.uid() = user_id);
