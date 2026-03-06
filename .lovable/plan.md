

## Fix: `update.sh` causes Nginx 500 on every deploy

### Root Cause

Two problems in the current `update.sh`:

1. **No `git pull`** — The script rebuilds old code without fetching updates from the repository.
2. **Deletes frontend before verifying build success** — Line 28 does `rm -rf frontend` before checking if `dist/` was actually created. If anything goes wrong, Nginx has no files to serve → 500 error.

### Fix

Rewrite `update.sh` with these improvements:

1. **Add `git pull origin main`** at the start to fetch latest code.
2. **Build first, copy after** — Only delete and replace `deploy/frontend/` after confirming `dist/` exists and contains `index.html`.
3. **Use absolute paths everywhere** — Avoid any ambiguity with `$REPO_ROOT/dist` instead of relative `dist`.
4. **Add error handling** — If the build fails, keep the old frontend intact and abort with a clear message instead of leaving Nginx with an empty directory.

### Updated `deploy/update.sh`

```bash
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

# Replace frontend only after successful build
rm -rf "$DEPLOY_DIR/frontend"
cp -r "$REPO_ROOT/dist" "$DEPLOY_DIR/frontend"
echo "✓ Frontend copiado com sucesso"

# Rebuild and restart containers
echo "[3/4] Rebuilding containers..."
cd "$DEPLOY_DIR"
docker compose build

echo "[4/4] Restarting..."
docker compose up -d

echo ""
echo "✅ Atualização concluída!"
echo "   Frontend: ${APP_URL}"
echo "   API:      ${API_URL}"
```

### Key differences
- Adds `git pull origin main` to actually fetch new code
- Uses absolute path `$REPO_ROOT/dist` instead of relative `dist`
- Validates `dist/index.html` exists before replacing frontend
- If build fails, old frontend stays intact — no more 500 errors
- Single file change: `deploy/update.sh`

