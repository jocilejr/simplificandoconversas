-- ============================================================
-- Init DB: Consolidated schema for self-hosted deploy
-- ============================================================

-- 1. Create roles FIRST (before any GRANT references them)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- Ensure BYPASSRLS on existing databases
ALTER ROLE service_role BYPASSRLS;

-- 2. Auth schema is managed entirely by GoTrue — do NOT create it here.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- NOTE: storage schema and tables are managed by the supabase storage service.

-- ============================================================
-- PUBLIC TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text,
  avatar_url text,
  openai_api_key text,
  app_public_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  status text DEFAULT 'close',
  is_active boolean DEFAULT false,
  proxy_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, instance_name)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  contact_name text,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  instance_name text,
  phone_number text,
  lid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, remote_jid, instance_name)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'sent',
  external_id text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatbot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT false,
  instance_names text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatbot_flow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id),
  user_id uuid NOT NULL,
  name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid REFERENCES public.chatbot_flows(id),
  conversation_id uuid REFERENCES public.conversations(id),
  remote_jid text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_node_index integer NOT NULL DEFAULT 0,
  instance_name text,
  waiting_node_id text,
  results jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flow_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.flow_executions(id),
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  conversation_id uuid,
  timeout_node_id text,
  timeout_at timestamptz NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  execution_id uuid,
  remote_jid text NOT NULL,
  original_url text NOT NULL,
  short_code text NOT NULL,
  next_node_id text,
  conversation_id uuid,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  preview_title text,
  preview_description text,
  preview_image text,
  instance_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  label_id uuid NOT NULL REFERENCES public.labels(id),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  photo_url text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  tag_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, remote_jid, tag_name)
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pendente',
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_document text,
  description text,
  payment_url text,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz DEFAULT NULL
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can manage own transactions') THEN
    CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.transactions TO anon, authenticated, service_role;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_jid ON public.conversations(user_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_flow_executions_user_jid ON public.flow_executions(user_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_tracked_links_short_code ON public.tracked_links(short_code);
CREATE INDEX IF NOT EXISTS idx_flow_timeouts_pending ON public.flow_timeouts(processed, timeout_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_unread(conv_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversations
  SET unread_count = unread_count + 1
  WHERE id = conv_id;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chatbot_flows_updated_at') THEN
    CREATE TRIGGER update_chatbot_flows_updated_at BEFORE UPDATE ON public.chatbot_flows
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flow_executions_updated_at') THEN
    CREATE TRIGGER update_flow_executions_updated_at BEFORE UPDATE ON public.flow_executions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- STORAGE: Bucket creation is handled AFTER the storage
-- container runs its migrations (creates storage.buckets).
-- Use the post-deploy command to create the bucket:
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('chatbot-media', 'chatbot-media', true)
--   ON CONFLICT (id) DO NOTHING;
-- ============================================================

-- ============================================================
-- USER ROLES (RBAC)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Trigger: assign admin role on profile creation
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_created_assign_admin') THEN
    CREATE TRIGGER on_profile_created_assign_admin
      AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.assign_admin_role();
  END IF;
END $$;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT ALL ON public.user_roles TO anon, authenticated, service_role;

-- Enable realtime for messages
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Meta Pixels table (multiple pixels per user)
CREATE TABLE IF NOT EXISTS public.meta_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Meu Pixel',
  pixel_id text NOT NULL,
  access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_pixels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meta_pixels' AND policyname = 'Users can manage own pixels') THEN
    CREATE POLICY "Users can manage own pixels" ON public.meta_pixels FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT ALL ON public.meta_pixels TO anon, authenticated, service_role;

-- Create profiles for any existing users that don't have one
INSERT INTO public.profiles (user_id, full_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT DO NOTHING;

-- 18. AI Auto-Reply Contacts
CREATE TABLE IF NOT EXISTS public.ai_auto_reply_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid, instance_name)
);
ALTER TABLE public.ai_auto_reply_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own ai reply contacts') THEN
    CREATE POLICY "Users can manage own ai reply contacts" ON public.ai_auto_reply_contacts
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_auto_reply_contacts TO anon, authenticated, service_role;

-- 19. AI Listen Contacts
CREATE TABLE IF NOT EXISTS public.ai_listen_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid, instance_name)
);
ALTER TABLE public.ai_listen_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own ai listen contacts') THEN
    CREATE POLICY "Users can manage own ai listen contacts" ON public.ai_listen_contacts
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_listen_contacts TO anon, authenticated, service_role;

-- 20. AI Config
CREATE TABLE IF NOT EXISTS public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reply_system_prompt text DEFAULT 'Você é um assistente de vendas profissional. Responda de forma objetiva e cordial.',
  listen_rules text DEFAULT 'Detecte menções a pagamentos, datas, prazos, promessas de pagamento e compromissos importantes. Crie lembretes apenas quando houver informação concreta.',
  max_context_messages int DEFAULT 10,
  reply_stop_contexts text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own ai config') THEN
    CREATE POLICY "Users can manage own ai config" ON public.ai_config
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_config TO anon, authenticated, service_role;

-- Platform Connections (API keys)
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_connections' AND policyname = 'Users can manage own platform connections') THEN
    CREATE POLICY "Users can manage own platform connections" ON public.platform_connections FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.platform_connections TO anon, authenticated, service_role;

-- Email Contacts
CREATE TABLE IF NOT EXISTS public.email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  tags text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_contacts' AND policyname = 'Users can manage own email contacts') THEN
    CREATE POLICY "Users can manage own email contacts" ON public.email_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_email_contacts_user_email ON public.email_contacts(user_id, email);
GRANT ALL ON public.email_contacts TO anon, authenticated, service_role;

-- Email Queue (async processing)
CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.email_campaigns(id),
  template_id uuid REFERENCES public.email_templates(id),
  smtp_config_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  personalization jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_queue' AND policyname = 'Users can manage own email queue') THEN
    CREATE POLICY "Users can manage own email queue" ON public.email_queue FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON public.email_queue(status, created_at) WHERE status = 'pending';
GRANT ALL ON public.email_queue TO anon, authenticated, service_role;

-- message_queue_config (anti-ban global wait)
CREATE TABLE IF NOT EXISTS public.message_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_name text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 30,
  pause_after_sends integer,
  pause_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_queue_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_queue_config' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON public.message_queue_config FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT ALL ON public.message_queue_config TO anon, authenticated, service_role;

-- ============================================================
-- GROUP MODULE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_selected (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, group_jid)
);
GRANT ALL ON public.group_selected TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.group_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  instance_name text NOT NULL,
  group_jids text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_campaigns TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.group_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.group_campaigns(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}',
  schedule_type text NOT NULL DEFAULT 'once',
  scheduled_at timestamptz,
  cron_expression text,
  interval_minutes integer,
  next_run_at timestamptz,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_scheduled_messages TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.group_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.group_campaigns(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.group_scheduled_messages(id) ON DELETE SET NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  instance_name text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  execution_batch text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_message_queue TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.group_participant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  participant_jid text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_participant_events TO anon, authenticated, service_role;

-- ============================================================
-- DELIVERY DIGITAL + AREA DE MEMBROS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  page_title text NOT NULL DEFAULT 'Preparando sua entrega...',
  page_message text NOT NULL DEFAULT 'Você será redirecionado em instantes',
  page_logo text,
  redirect_url text,
  redirect_delay integer NOT NULL DEFAULT 3,
  delivery_webhook_url text,
  whatsapp_number text,
  whatsapp_message text,
  member_cover_image text,
  member_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_products ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_products TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_delivery_products_workspace ON public.delivery_products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_delivery_products_slug ON public.delivery_products(slug);

CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  custom_domain text,
  global_redirect_url text,
  link_message_template text NOT NULL DEFAULT 'Olá! Aqui está seu acesso: {link}',
  delivery_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_settings TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.delivery_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  phone text,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  pixel_fired boolean NOT NULL DEFAULT false,
  webhook_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_accesses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_accesses TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_delivery_accesses_product ON public.delivery_accesses(product_id);

CREATE TABLE IF NOT EXISTS public.delivery_link_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  phone text,
  normalized_phone text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_link_generations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_link_generations TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.delivery_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'meta',
  pixel_id text NOT NULL DEFAULT '',
  access_token text,
  event_name text NOT NULL DEFAULT 'Purchase',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_pixels ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_pixels TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.global_delivery_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'meta',
  pixel_id text NOT NULL DEFAULT '',
  access_token text,
  event_name text NOT NULL DEFAULT 'Purchase',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.global_delivery_pixels ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.global_delivery_pixels TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  delivery_product_id uuid,
  title text NOT NULL,
  description text,
  cover_image text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_products ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_products TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_area_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  brand_name text,
  title text,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  welcome_message text,
  theme_color text DEFAULT '#8B5CF6',
  ai_persona_prompt text,
  greeting_prompt text,
  offer_prompt text,
  custom_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_area_settings TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_area_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Oferta',
  title text,
  product_id uuid,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  purchase_url text,
  display_type text NOT NULL DEFAULT 'floating_bar',
  pix_key text,
  pix_key_type text,
  card_payment_url text,
  category_tag text,
  cta_url text,
  cta_text text DEFAULT 'Comprar agora',
  is_active boolean NOT NULL DEFAULT true,
  total_impressions integer NOT NULL DEFAULT 0,
  total_clicks integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_offers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_area_offers TO anon, authenticated, service_role;

-- FK for PostgREST relationship resolution
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_area_offers_product_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.member_area_offers
      ADD CONSTRAINT member_area_offers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.delivery_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.member_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_categories ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_product_categories TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_product_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  category_id uuid,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'text',
  content_url text,
  description text,
  content_text text,
  button_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_materials ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_product_materials TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  normalized_phone text NOT NULL,
  current_product_name text,
  current_material_name text,
  current_activity text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_sessions TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.workspace_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  domain text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, domain)
);
ALTER TABLE public.workspace_domains ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workspace_domains TO anon, authenticated, service_role;

-- New tables from member area v2

CREATE TABLE IF NOT EXISTS public.member_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  normalized_phone text NOT NULL,
  material_id uuid NOT NULL,
  progress_type text NOT NULL DEFAULT 'pdf',
  current_page integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  video_seconds integer NOT NULL DEFAULT 0,
  video_duration integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_content_progress ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_content_progress TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_pixel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  normalized_phone text NOT NULL,
  product_name text,
  product_value numeric DEFAULT 0,
  fired boolean NOT NULL DEFAULT false,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_pixel_frames ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_pixel_frames TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_offer_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  offer_id uuid NOT NULL,
  impression_count integer NOT NULL DEFAULT 0,
  clicked boolean NOT NULL DEFAULT false,
  last_shown_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_offer_impressions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_offer_impressions TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.daily_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  day_number integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_prayers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.daily_prayers TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.openai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  api_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openai_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.openai_settings TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.product_knowledge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  key_topics text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_knowledge_summaries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.product_knowledge_summaries TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.manual_boleto_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  webhook_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_boleto_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.manual_boleto_settings TO anon, authenticated, service_role;

-- RPC functions
CREATE OR REPLACE FUNCTION public.increment_offer_impression(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE member_area_offers SET total_impressions = total_impressions + 1 WHERE id = offer_id; $$;

CREATE OR REPLACE FUNCTION public.increment_offer_click(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE member_area_offers SET total_clicks = total_clicks + 1 WHERE id = offer_id; $$;

-- Done!
SELECT 'Database initialized successfully!' AS status;
