#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load and export all env vars (required for docker stack deploy variable substitution)
set -a
source "$DEPLOY_DIR/.env"
set +a

# ============================================================
# [1/5] Pull latest code
# ============================================================
echo "[1/5] Pulling latest code..."
cd "$REPO_ROOT"
git pull origin main

# ============================================================
# [2/5] Database migrations
# ============================================================
echo "[2/5] Running database migrations..."

# Find postgres container (Docker Swarm — avoid matching postgrest)
POSTGRES_CONTAINER=$(docker ps --format '{{.ID}}\t{{.Names}}' | grep 'simplificando_postgres\.' | awk '{print $1}' | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
  echo "❌ Postgres container not found! Is the stack running?"
  exit 1
fi
echo "   → Postgres container: $POSTGRES_CONTAINER"

docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -tc \

# Apply SQL migrations
echo "   → Aplicando migrações SQL..."
cat "$DEPLOY_DIR/init-db.sql" \
    "$DEPLOY_DIR/migrate-workspace.sql" \
    "$DEPLOY_DIR/fix-member-tables.sql" \
  | docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1
echo "✓ Migrações aplicadas"

# Validate workspace membership
ORPHAN_USERS=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = u.id);" \
  | tr -d '[:space:]')
if [ "$ORPHAN_USERS" != "0" ]; then
  echo "⚠ AVISO: $ORPHAN_USERS usuários sem workspace. Verifique manualmente."
else
  echo "✓ Todos os usuários possuem workspace"
fi

# Notify PostgREST to reload schema + force service restart (Swarm)
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';" 2>/dev/null || true
docker service update --force simplificando_postgrest >/dev/null 2>&1 || true
echo "✓ PostgREST schema recarregado + serviço atualizado"

# Validate critical schema pieces
echo "   → Validando schema mínimo..."
VALIDATE_SQL="
SELECT 'workspaces', count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='workspaces'
UNION ALL SELECT 'workspace_members', count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='workspace_members'
UNION ALL SELECT 'api_request_logs', count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='api_request_logs'
UNION ALL SELECT 'transactions.workspace_id', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='workspace_id'
UNION ALL SELECT 'platform_connections.workspace_id', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_connections' AND column_name='workspace_id';
"
VALIDATION=$(echo "$VALIDATE_SQL" | docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -tA 2>/dev/null || echo "")
echo "$VALIDATION" | sed 's/^/      /'
if echo "$VALIDATION" | grep -E '\|0$' > /dev/null; then
  echo "⚠ AVISO: schema incompleto. Algum item acima retornou 0."
else
  echo "✓ Schema mínimo validado"
fi

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

if [ ! -f "$REPO_ROOT/dist/index.html" ]; then
  echo "❌ Build falhou! dist/index.html não encontrado."
  exit 1
fi

mkdir -p "$DEPLOY_DIR/frontend"
rm -rf "$DEPLOY_DIR/frontend/"*
cp -r "$REPO_ROOT/dist/"* "$DEPLOY_DIR/frontend/"
echo "✓ Frontend copiado com sucesso"

# ============================================================
# [4/5] Rebuild backend image
# ============================================================
echo "[4/5] Rebuilding backend image..."
cd "$DEPLOY_DIR"
docker build -t simplificando-backend:latest ./backend
echo "✓ Imagem backend construída"

# ============================================================
# [5/5] Deploy stack
# ============================================================
echo "[5/5] Deploying stack..."
cd "$DEPLOY_DIR"
docker stack deploy -c portainer-stack.yml simplificando --with-registry-auth
echo "   → Aguardando serviços iniciarem..."
sleep 10

# Force nginx container restart to refresh bind mount
NGINX_CONTAINER=$(docker ps --format '{{.ID}}\t{{.Names}}' | grep 'simplificando_nginx\.' | awk '{print $1}' | head -1)
if [ -n "$NGINX_CONTAINER" ]; then
  docker restart "$NGINX_CONTAINER" >/dev/null 2>&1 || true
  echo "✓ Nginx reiniciado"
fi

# Post-deploy health check
echo "Verificando backend..."
sleep 5
BACKEND_CONTAINER=$(docker ps --format '{{.ID}}\t{{.Names}}' | grep 'simplificando_backend\.' | awk '{print $1}' | head -1)
if [ -n "$BACKEND_CONTAINER" ]; then
  HEALTH=$(docker exec -i "$BACKEND_CONTAINER" wget -qO- http://localhost:3001/api/health/version 2>/dev/null || echo '{"ok":false}')
  echo "   Health: $HEALTH"
  if echo "$HEALTH" | grep -q '"ok":true'; then
    echo "✓ Backend respondendo corretamente"
  else
    echo "⚠ Backend não respondeu. Verifique: docker service logs simplificando_backend --tail=20"
  fi

  # Smoke test: backend → PostgREST → workspace_id (mesmo caminho do webhook real)
  SCHEMA=$(docker exec -i "$BACKEND_CONTAINER" wget -qO- http://localhost:3001/api/health/schema 2>/dev/null || echo '{"ok":false}')
  echo "   Schema: $SCHEMA"
  if echo "$SCHEMA" | grep -q '"workspace_id_visible":true'; then
    echo "✓ Backend enxerga transactions.workspace_id via PostgREST"
  else
    echo "❌ Backend NÃO enxerga workspace_id. Verifique SUPABASE_URL e cache do PostgREST."
  fi
else
  echo "⚠ Container do backend não encontrado ainda (pode estar iniciando)"
fi

echo ""
echo "✅ Atualização concluída!"
echo "   Frontend: ${APP_URL}"
echo "   API:      ${API_URL}"
