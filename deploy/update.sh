#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load env
source "$DEPLOY_DIR/.env"

# Pull latest code
echo "[1/5] Pulling latest code..."
cd "$REPO_ROOT"
git checkout -- .
git pull origin main

# ============================================================
# [2/5] Database migrations FIRST (before builds!)
# ============================================================
echo "[2/5] Running database migrations..."
cd "$DEPLOY_DIR"
echo "   → Applying base schema updates (non-blocking)..."
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

-- Email Link Clicks
CREATE TABLE IF NOT EXISTS public.email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  send_id uuid NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  original_url text NOT NULL,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_link_clicks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_link_clicks' AND policyname = 'Users can view own link clicks') THEN
    CREATE POLICY "Users can view own link clicks" ON public.email_link_clicks FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.email_link_clicks TO anon, authenticated, service_role;

-- Boleto Recovery Templates
CREATE TABLE IF NOT EXISTS public.boleto_recovery_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Template Padrão',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boleto_recovery_templates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.boleto_recovery_templates TO anon, authenticated, service_role;

-- Follow Up Settings
CREATE TABLE IF NOT EXISTS public.followup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL UNIQUE,
  instance_name text,
  enabled boolean NOT NULL DEFAULT false,
  send_after_minutes integer NOT NULL DEFAULT 5,
  send_at_hour text NOT NULL DEFAULT '09:00',
  max_messages_per_phone_per_day integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followup_settings' AND policyname = 'Users can manage own followup settings') THEN
    CREATE POLICY "Users can manage own followup settings" ON public.followup_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.followup_settings TO anon, authenticated, service_role;
EOSQL
echo "✓ Base schema updates concluídos"

if [ ! -f "$DEPLOY_DIR/migrate-workspace.sql" ]; then
  echo "❌ Arquivo migrate-workspace.sql não encontrado! Abortando."
  exit 1
fi

echo "   → Applying workspace migration (strict)..."
docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$DEPLOY_DIR/migrate-workspace.sql"
echo "✓ Workspace migration aplicada"

# Validate tables exist
for tbl in meta_pixels api_request_logs platform_connections email_contacts workspaces workspace_members; do
  TABLE_EXISTS=$(docker compose exec -T postgres psql -U postgres -d postgres -tAc "SELECT to_regclass('public.$tbl');")
  if [ "$TABLE_EXISTS" = "" ] || [ "$TABLE_EXISTS" = " " ]; then
    echo "❌ Tabela $tbl não encontrada após migração! Abortando."
    exit 1
  fi
  echo "✓ Tabela $tbl verificada"
done

# Validate workspace membership exists for all users
ORPHAN_USERS=$(docker compose exec -T postgres psql -U postgres -d postgres -tAc "
  SELECT count(*) FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = u.id);
")
ORPHAN_USERS=$(echo "$ORPHAN_USERS" | tr -d '[:space:]')
if [ "$ORPHAN_USERS" != "0" ]; then
  echo "⚠ AVISO: $ORPHAN_USERS usuários sem workspace. Verifique manualmente."
else
  echo "✓ Todos os usuários possuem workspace"
fi

# Restart PostgREST to guarantee schema reload
docker compose restart postgrest 2>/dev/null || echo "⚠ PostgREST não encontrado (ok se não usar)"
echo "✓ PostgREST schema recarregado"

# ============================================================
# [3/5] Rebuild frontend
# ============================================================
echo "[3/5] Rebuilding frontend..."
cd "$REPO_ROOT"
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
  echo "   ⚠ Migrações SQL já foram aplicadas com sucesso."
  exit 1
fi

# Replace frontend files (preserve directory inode for bind mount)
mkdir -p "$DEPLOY_DIR/frontend"
rm -rf "$DEPLOY_DIR/frontend/"*
cp -r "$REPO_ROOT/dist/"* "$DEPLOY_DIR/frontend/"
echo "✓ Frontend copiado com sucesso"

# ============================================================
# [4/5] Rebuild containers
# ============================================================
echo "[4/5] Rebuilding containers..."
cd "$DEPLOY_DIR"
docker compose build --no-cache backend
docker compose build

# ============================================================
# [5/5] Restart + health check
# ============================================================
echo "[5/5] Restarting..."
docker compose up -d

# Force restart Nginx to guarantee bind mount refresh
docker compose restart nginx
echo "✓ Nginx reiniciado"

# Post-deploy health check
echo "Verificando backend..."
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
