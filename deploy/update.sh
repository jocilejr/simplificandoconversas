#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy (modo seguro — SEM migrations) ═══"

# Load env
set -a; source "$DEPLOY_DIR/.env"; set +a

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

STACK_NAME="${STACK_NAME:-simplificando}"

find_container() {
  local svc="$1"
  docker ps --format '{{.Names}}' \
    | grep -E "(^|_)${svc}(\.|$)" \
    | grep -v supabase \
    | grep -v postgrest \
    | head -n1
}

# ============================================================
# [1/4] Pull latest code
# ============================================================
echo "[1/4] Pulling latest code..."
cd "$REPO_ROOT"
git checkout -- .
git pull origin main

# ============================================================
# [2/4] Rebuild frontend
# ============================================================
echo "[2/4] Rebuilding frontend..."
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

# Verify build succeeded — preserve previous frontend if broken
if [ ! -f "$REPO_ROOT/dist/index.html" ]; then
  echo "❌ Build falhou! dist/index.html não encontrado."
  echo "   Frontend anterior mantido intacto."
  exit 1
fi

mkdir -p "$DEPLOY_DIR/frontend"
rm -rf "$DEPLOY_DIR/frontend/"*
cp -r "$REPO_ROOT/dist/"* "$DEPLOY_DIR/frontend/"
echo "✓ Frontend copiado com sucesso"

# ============================================================
# [3/4] Rebuild containers
# ============================================================
echo "[3/4] Rebuilding containers..."
cd "$DEPLOY_DIR"

if [ "$SWARM_ACTIVE" = true ]; then
  echo "   → Build images locais (swarm)..."
  docker build -t simplificando-backend:latest ./backend
  docker build -t simplificando-baileys-gateway:latest ./baileys-gateway
  echo "✓ Imagens construídas"
else
  docker compose build backend
  docker compose build baileys-gateway
fi

# ============================================================
# [4/4] Restart services + health check
# ============================================================
echo "[4/4] Restarting services..."

if [ "$SWARM_ACTIVE" = true ]; then
  # Serviços com imagem custom (build local)
  for svc in backend baileys-gateway; do
    if docker service inspect "${STACK_NAME}_${svc}" >/dev/null 2>&1; then
      docker service update --force --image "simplificando-${svc}:latest" "${STACK_NAME}_${svc}" >/dev/null 2>&1
      echo "✓ Serviço ${svc} atualizado (simplificando-${svc}:latest)"
    else
      echo "⚠ Serviço ${STACK_NAME}_${svc} não existe (pule se não usar)"
    fi
  done

  # Nginx usa imagem oficial — NUNCA trocar imagem, apenas force restart
  # para recarregar volumes (frontend dist/ + template)
  if docker service inspect "${STACK_NAME}_nginx" >/dev/null 2>&1; then
    CURRENT_NGINX_IMAGE=$(docker service inspect "${STACK_NAME}_nginx" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' | cut -d'@' -f1)
    # Se por acidente apontou pra imagem custom, restaura nginx:alpine
    if echo "$CURRENT_NGINX_IMAGE" | grep -q "simplificando-nginx"; then
      echo "⚠ nginx estava com imagem inválida ($CURRENT_NGINX_IMAGE) — restaurando nginx:alpine"
      docker service update --image nginx:alpine "${STACK_NAME}_nginx" >/dev/null 2>&1
    else
      docker service update --force "${STACK_NAME}_nginx" >/dev/null 2>&1
    fi
    echo "✓ Serviço nginx atualizado (mantém imagem oficial)"
  fi
else
  docker compose up -d backend baileys-gateway
  docker compose restart nginx
  echo "✓ Serviços reiniciados"
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
echo ""
echo "ℹ️  Migrations NÃO foram executadas (modo seguro)."
echo "   Se houver mudança de schema, rode os SQLs manualmente:"
echo "   PG=\$(docker ps --format '{{.Names}}' | grep -E '^simplificando_postgres(\\.|\$)' | head -1)"
echo "   docker exec -i \"\$PG\" psql -U postgres -d postgres < deploy/<arquivo.sql>"
