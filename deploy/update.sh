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
  npm ci && npm run build
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

# Rebuild and restart containers
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
