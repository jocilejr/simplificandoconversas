-- AI Auto-Reply per contact toggle
CREATE TABLE public.ai_auto_reply_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid, instance_name)
);
ALTER TABLE public.ai_auto_reply_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai reply contacts" ON public.ai_auto_reply_contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI Listen per contact toggle
CREATE TABLE public.ai_listen_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid, instance_name)
);
ALTER TABLE public.ai_listen_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai listen contacts" ON public.ai_listen_contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI Config (system prompt, listen rules, max context)
CREATE TABLE public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reply_system_prompt text DEFAULT 'Você é um assistente de vendas profissional. Responda de forma objetiva e cordial.',
  listen_rules text DEFAULT 'Detecte menções a pagamentos, datas, prazos, promessas de pagamento e compromissos importantes. Crie lembretes apenas quando houver informação concreta.',
  max_context_messages int DEFAULT 10,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai config" ON public.ai_config
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());