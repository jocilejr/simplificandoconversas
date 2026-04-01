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

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
EOSQL
echo "✓ Migrations aplicadas"

# Validate tables exist
for tbl in meta_pixels api_request_logs; do
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
