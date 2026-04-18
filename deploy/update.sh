#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load env
source "$DEPLOY_DIR/.env"

# ============================================================
# Detect orchestrator (Swarm vs Compose)
# ============================================================
SWARM_ACTIVE=false
if docker info 2>/dev/null | grep -q 'Swarm: active'; then
  SWARM_ACTIVE=true
  echo "✓ Docker Swarm detectado"
else
  echo "✓ Docker Compose detectado"
fi

# Stack name (Swarm) — defaults to 'simplificando'
STACK_NAME="${STACK_NAME:-simplificando}"

# Helper: find a running container by service suffix
find_container() {
  local svc="$1"
  docker ps --format '{{.Names}}' \
    | grep -E "(^|_)${svc}(\.|$)" \
    | grep -v supabase \
    | head -n1
}

# ============================================================
# [1/5] Pull latest code
# ============================================================
echo "[1/5] Pulling latest code..."
cd "$REPO_ROOT"
git checkout -- .
git pull origin main

# ============================================================
# [2/5] Database migrations (consolidated)
# ============================================================
echo "[2/5] Running database migrations..."
cd "$DEPLOY_DIR"

PG_CONTAINER=$(find_container "postgres")
if [ -z "$PG_CONTAINER" ]; then
  echo "❌ Nenhum container Postgres rodando. Suba a stack antes."
  exit 1
fi
echo "   → Postgres container: $PG_CONTAINER"

echo "   → Applying all SQL migrations in a single pass..."
cat "$DEPLOY_DIR/init-db.sql" \
    "$DEPLOY_DIR/migrate-workspace.sql" \
    "$DEPLOY_DIR/fix-member-tables.sql" \
  | docker exec -i "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1
echo "✓ Migrações aplicadas"

# Validate workspace membership exists for all users
ORPHAN_USERS=$(docker exec -i "$PG_CONTAINER" psql -U postgres -d postgres -tAc "
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
if [ "$SWARM_ACTIVE" = true ]; then
  docker service update --force "${STACK_NAME}_postgrest" >/dev/null 2>&1 \
    && echo "✓ PostgREST schema recarregado (swarm)" \
    || echo "⚠ PostgREST service não encontrado em swarm (ok se não usar)"
else
  docker compose restart postgrest 2>/dev/null \
    && echo "✓ PostgREST schema recarregado (compose)" \
    || echo "⚠ PostgREST não encontrado (ok se não usar)"
fi
sleep 3

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

if [ "$SWARM_ACTIVE" = true ]; then
  echo "   → Build images locais (swarm)..."
  docker build -t simplificando-backend:latest ./backend
  docker build -t simplificando-baileys-gateway:latest ./baileys-gateway
  echo "✓ Imagens construídas"
else
  docker compose build --no-cache backend
  docker compose build
fi

# ============================================================
# [5/5] Restart + health check
# ============================================================
echo "[5/5] Restarting..."

if [ "$SWARM_ACTIVE" = true ]; then
  # Force recreate services with new images
  for svc in backend baileys-gateway nginx; do
    if docker service inspect "${STACK_NAME}_${svc}" >/dev/null 2>&1; then
      IMG=""
      case "$svc" in
        backend) IMG="--image simplificando-backend:latest" ;;
        baileys-gateway) IMG="--image simplificando-baileys-gateway:latest" ;;
      esac
      docker service update --force $IMG "${STACK_NAME}_${svc}" >/dev/null \
        && echo "✓ Serviço ${svc} atualizado" \
        || echo "⚠ Falha atualizando ${svc}"
    else
      echo "⚠ Serviço ${STACK_NAME}_${svc} não existe — faça 'Pull and redeploy' no Portainer"
    fi
  done
else
  docker compose up -d
  docker compose restart nginx
  echo "✓ Nginx reiniciado"
fi

# Post-deploy health check
echo "Verificando backend..."
sleep 5
BACKEND_CONTAINER=$(find_container "backend")
if [ -n "$BACKEND_CONTAINER" ]; then
  HEALTH=$(docker exec "$BACKEND_CONTAINER" wget -qO- http://localhost:3001/api/health/version 2>/dev/null || echo '{"ok":false}')
  echo "   Health: $HEALTH"
  if echo "$HEALTH" | grep -q '"ok":true'; then
    echo "✓ Backend respondendo corretamente"
  else
    echo "⚠ Backend não respondeu. Logs: docker logs $BACKEND_CONTAINER --tail=20"
  fi
else
  echo "⚠ Container backend não encontrado"
fi

echo ""
echo "✅ Atualização concluída!"
echo "   Frontend: ${APP_URL}"
echo "   API:      ${API_URL}"
if [ "$SWARM_ACTIVE" = true ]; then
  echo ""
  echo "ℹ Modo Swarm: para incluir novos serviços (ex: baileys-gateway),"
  echo "  use Portainer → Stacks → ${STACK_NAME} → Pull and redeploy."
fi
