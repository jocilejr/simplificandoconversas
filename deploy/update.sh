#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load env
source "$DEPLOY_DIR/.env"

# Pull latest code
echo "[1/4] Pulling latest code..."
cd "$REPO_ROOT"
git checkout -- .
git pull origin main

# Rebuild frontend
echo "[2/4] Rebuilding frontend..."
cat > .env.production << EOF
VITE_SUPABASE_URL=${API_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
EOF

if command -v bun &> /dev/null; then
  bun install && bun run build
else
  npm install && npm run build
fi

# Verify build succeeded
if [ ! -f "$REPO_ROOT/dist/index.html" ]; then
  echo "❌ Build falhou! dist/index.html não encontrado."
  echo "   Frontend anterior mantido intacto."
  exit 1
fi

# Replace frontend files (preserve directory inode for bind mount)
mkdir -p "$DEPLOY_DIR/frontend"
rm -rf "$DEPLOY_DIR/frontend/"*
cp -r "$REPO_ROOT/dist/"* "$DEPLOY_DIR/frontend/"
echo "✓ Frontend copiado com sucesso"

# Run DB migrations for new tables
echo "[2.5/4] Running database migrations..."
cd "$DEPLOY_DIR"
docker compose exec -T postgres psql -U postgres -d postgres <<'EOSQL'
-- Meta Pixels
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

-- Remove legacy columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS meta_pixel_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS meta_access_token;

-- AI Config
CREATE TABLE IF NOT EXISTS public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reply_system_prompt text DEFAULT 'Você é um assistente de vendas profissional. Responda de forma objetiva e cordial.',
  listen_rules text DEFAULT 'Detecte menções a pagamentos, datas, prazos, promessas de pagamento e compromissos importantes. Crie lembretes apenas quando houver informação concreta.',
  max_context_messages int DEFAULT 10,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_config' AND policyname = 'Users can manage own ai config') THEN
    CREATE POLICY "Users can manage own ai config" ON public.ai_config FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_config TO anon, authenticated, service_role;

-- AI Auto Reply Contacts
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
    CREATE POLICY "Users can manage own ai reply contacts" ON public.ai_auto_reply_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_auto_reply_contacts TO anon, authenticated, service_role;

-- AI Listen Contacts
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
    CREATE POLICY "Users can manage own ai listen contacts" ON public.ai_listen_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.ai_listen_contacts TO anon, authenticated, service_role;

-- Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  remote_jid text NOT NULL,
  contact_name text,
  phone_number text,
  instance_name text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'Users can manage own reminders') THEN
    CREATE POLICY "Users can manage own reminders" ON public.reminders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.reminders TO anon, authenticated, service_role;

-- Add results column to flow_executions for audit
ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS results jsonb DEFAULT NULL;

-- API Request Logs
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  request_body jsonb DEFAULT null,
  response_summary text DEFAULT null,
  ip_address text DEFAULT null,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_request_logs' AND policyname = 'Users can view own api logs') THEN
    CREATE POLICY "Users can view own api logs" ON public.api_request_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_api_logs_user_created ON public.api_request_logs(user_id, created_at DESC);
GRANT ALL ON public.api_request_logs TO anon, authenticated, service_role;

-- Email Templates (base table, no dependencies)
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'Users can manage own email templates') THEN
    CREATE POLICY "Users can manage own email templates" ON public.email_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_templates TO anon, authenticated, service_role;

-- SMTP Config (base table, no dependencies)
CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 465,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT 'Principal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'smtp_config' AND policyname = 'Users can manage own smtp config') THEN
    CREATE POLICY "Users can manage own smtp config" ON public.smtp_config FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.smtp_config TO anon, authenticated, service_role;

-- Email Campaigns (references email_templates, smtp_config)
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  smtp_config_id uuid REFERENCES public.smtp_config(id) ON DELETE SET NULL,
  tag_filter text,
  status text NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_campaigns' AND policyname = 'Users can manage own email campaigns') THEN
    CREATE POLICY "Users can manage own email campaigns" ON public.email_campaigns FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_campaigns TO anon, authenticated, service_role;

-- Email Sends (references email_campaigns, email_templates)
CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_sends' AND policyname = 'Users can manage own email sends') THEN
    CREATE POLICY "Users can manage own email sends" ON public.email_sends FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_sends TO anon, authenticated, service_role;

-- Add email column to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS email text;

-- Email Follow-ups
CREATE TABLE IF NOT EXISTS public.email_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  delay_days integer NOT NULL DEFAULT 1,
  step_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_follow_ups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_follow_ups' AND policyname = 'Users can manage own follow ups') THEN
    CREATE POLICY "Users can manage own follow ups" ON public.email_follow_ups FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_follow_ups TO anon, authenticated, service_role;

-- Email Follow-up Sends
CREATE TABLE IF NOT EXISTS public.email_follow_up_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id uuid NOT NULL REFERENCES public.email_follow_ups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_follow_up_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_follow_up_sends' AND policyname = 'Users can manage own follow up sends') THEN
    CREATE POLICY "Users can manage own follow up sends" ON public.email_follow_up_sends FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_follow_up_sends TO anon, authenticated, service_role;

-- Email Events
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_events' AND policyname = 'Users can manage own email events') THEN
    CREATE POLICY "Users can manage own email events" ON public.email_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_email_events_send_id ON public.email_events(send_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(event_type);
GRANT ALL ON public.email_events TO anon, authenticated, service_role;

-- Email Suppressions
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'bounce',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_suppressions' AND policyname = 'Users can manage own suppressions') THEN
    CREATE POLICY "Users can manage own suppressions" ON public.email_suppressions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_suppressions_email ON public.email_suppressions(user_id, email);
GRANT ALL ON public.email_suppressions TO anon, authenticated, service_role;

-- Alter smtp_config: add label
ALTER TABLE public.smtp_config ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Principal';

-- Alter email_campaigns: add smtp_config_id, opened_count
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS smtp_config_id uuid REFERENCES public.smtp_config(id) ON DELETE SET NULL;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;

-- Alter email_sends: add opened_at
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- Index for follow-up scheduling
CREATE INDEX IF NOT EXISTS idx_follow_up_sends_scheduled ON public.email_follow_up_sends(scheduled_at) WHERE status = 'pending';

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
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_contacts' AND policyname = 'Users can manage own email contacts') THEN
    CREATE POLICY "Users can manage own email contacts" ON public.email_contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_contacts TO anon, authenticated, service_role;

-- Unique constraint for upsert on email_contacts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_contacts_user_id_email_key') THEN
    ALTER TABLE public.email_contacts ADD CONSTRAINT email_contacts_user_id_email_key UNIQUE (user_id, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_contacts_user_email ON public.email_contacts(user_id, email);

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
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can manage own transactions') THEN
    CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_external ON public.transactions(external_id, source);
GRANT ALL ON public.transactions TO anon, authenticated, service_role;

-- ============================================================
-- WORKSPACE MIGRATION (idempotent)
-- ============================================================

-- Enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('admin', 'operator', 'viewer');
  END IF;
END $$;

-- Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  openai_api_key text,
  app_public_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workspaces TO anon, authenticated, service_role;

-- Workspace members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workspace_members TO anon, authenticated, service_role;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id) $$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id uuid, _workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role::text FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role workspace_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role IN ('admin', 'operator')) $$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id $$;

-- Auto-add workspace creator as admin
CREATE OR REPLACE FUNCTION public.auto_add_workspace_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_workspace_created') THEN
    CREATE TRIGGER on_workspace_created AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.auto_add_workspace_creator();
  END IF;
END $$;

-- Add workspace_id column to all data tables
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', _t);
  END LOOP;
END $$;

-- Migrate existing data: create default workspace per user
DO $$
DECLARE _rec RECORD; _ws_id uuid;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ]; _t text;
BEGIN
  FOR _rec IN SELECT DISTINCT user_id FROM public.profiles
    WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = profiles.user_id)
  LOOP
    _ws_id := gen_random_uuid();
    INSERT INTO public.workspaces (id, name, slug, created_by, openai_api_key, app_public_url)
    VALUES (
      _ws_id, 'Workspace Principal',
      'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12),
      _rec.user_id,
      (SELECT openai_api_key FROM public.profiles WHERE user_id = _rec.user_id LIMIT 1),
      (SELECT app_public_url FROM public.profiles WHERE user_id = _rec.user_id LIMIT 1)
    );
    FOREACH _t IN ARRAY _tables LOOP
      EXECUTE format('UPDATE public.%I SET workspace_id = $1 WHERE user_id = $2 AND workspace_id IS NULL', _t)
      USING _ws_id, _rec.user_id;
    END LOOP;
  END LOOP;
END $$;

-- Delete orphaned rows
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format('DELETE FROM public.%I WHERE workspace_id IS NULL', _t);
  END LOOP;
END $$;

-- Set NOT NULL + FK + index
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%s_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE', _t, _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON public.%I (workspace_id)', _t, _t);
  END LOOP;
END $$;

-- Drop old user-based RLS policies and create workspace-based ones
DO $$
DECLARE _pol RECORD;
BEGIN
  FOR _pol IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename NOT IN ('workspaces','workspace_members','user_roles','profiles')
    AND policyname NOT LIKE 'ws_%' AND policyname NOT LIKE 'wm_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', _pol.policyname, _pol.schemaname, _pol.tablename);
  END LOOP;
END $$;

DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "ws_select" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_workspace(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, ''admin''))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Workspace RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_select') THEN
    CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_insert') THEN
    CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_update') THEN
    CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE TO authenticated USING (public.has_workspace_role(auth.uid(), id, 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_delete') THEN
    CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), id, 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_select') THEN
    CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_insert') THEN
    CREATE POLICY "wm_insert" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_update') THEN
    CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_delete') THEN
    CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  END IF;
END $$;

-- Update handle_new_user to auto-create workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE _ws_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;
  _ws_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (_ws_id, 'Meu Workspace', 'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12), NEW.id);
  RETURN NEW;
END;
$$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
EOSQL
echo "✓ Migrations aplicadas"

# Validate tables exist
for tbl in meta_pixels api_request_logs platform_connections email_contacts; do
  TABLE_EXISTS=$(docker compose exec -T postgres psql -U postgres -d postgres -tAc "SELECT to_regclass('public.$tbl');")
  if [ "$TABLE_EXISTS" = "" ] || [ "$TABLE_EXISTS" = " " ]; then
    echo "❌ Tabela $tbl não encontrada após migração! Abortando."
    exit 1
  fi
  echo "✓ Tabela $tbl verificada"
done

# Restart PostgREST to guarantee schema reload
docker compose restart postgrest 2>/dev/null || echo "⚠ PostgREST não encontrado (ok se não usar)"
echo "✓ PostgREST schema recarregado"

echo "[3/4] Rebuilding containers..."
cd "$DEPLOY_DIR"
docker compose build --no-cache backend
docker compose build

echo "[4/4] Restarting..."
docker compose up -d

# Force restart Nginx to guarantee bind mount refresh
docker compose restart nginx
echo "✓ Nginx reiniciado"

# Post-deploy health check
echo "[5/5] Verificando backend..."
sleep 3
HEALTH=$(docker compose exec -T backend wget -qO- http://localhost:3001/api/health/version 2>/dev/null || echo '{"ok":false}')
echo "   Health: $HEALTH"
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "✓ Backend respondendo corretamente"
else
  echo "⚠ Backend não respondeu ao health check. Verifique logs: docker compose logs backend --tail=20"
fi

echo ""
echo "✅ Atualização concluída!"
echo "   Frontend: ${APP_URL}"
echo "   API:      ${API_URL}"
