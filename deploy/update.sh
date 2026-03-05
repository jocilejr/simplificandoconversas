#!/bin/bash
set -e

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$DEPLOY_DIR")"

echo "═══ Atualizando deploy ═══"

# Load env
source "$DEPLOY_DIR/.env"

# Rebuild frontend
echo "[1/3] Rebuilding frontend..."
cd "$REPO_ROOT"

cat > .env.production << EOF
VITE_SUPABASE_URL=${APP_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
EOF

if command -v bun &> /dev/null; then
  bun install && bun run build
else
  npm ci && npm run build
fi

rm -rf "$DEPLOY_DIR/frontend"
cp -r dist "$DEPLOY_DIR/frontend"

# Rebuild and restart containers
echo "[2/3] Rebuilding containers..."
cd "$DEPLOY_DIR"
docker compose build

echo "[3/3] Restarting..."
docker compose up -d

echo ""
echo "✅ Atualização concluída!"
echo "   Acesse: ${APP_URL}"
