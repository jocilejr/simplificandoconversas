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

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
EOSQL
echo "✓ Migrations aplicadas"

# Validate meta_pixels table exists
TABLE_EXISTS=$(docker compose exec -T postgres psql -U postgres -d postgres -tAc "SELECT to_regclass('public.meta_pixels');")
if [ "$TABLE_EXISTS" = "" ] || [ "$TABLE_EXISTS" = " " ]; then
  echo "❌ Tabela meta_pixels não encontrada após migração! Abortando."
  exit 1
fi
echo "✓ Tabela meta_pixels verificada"

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

echo ""
echo "✅ Atualização concluída!"
echo "   Frontend: ${APP_URL}"
echo "   API:      ${API_URL}"
