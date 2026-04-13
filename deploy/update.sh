#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load env
source "$DEPLOY_DIR/.env"

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

echo "   → Applying all SQL migrations in a single pass..."
cat "$DEPLOY_DIR/../deploy/init-db.sql" \
    "$DEPLOY_DIR/migrate-workspace.sql" \
    "$DEPLOY_DIR/fix-member-tables.sql" \
  2>/dev/null | docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1
echo "✓ Migrações aplicadas"

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
sleep 3
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
