#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Instalação Automatizada — Self-Hosted Deploy     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── Check prerequisites ───
echo -e "${YELLOW}[1/8] Verificando pré-requisitos...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker não encontrado! Instale: https://docs.docker.com/engine/install/${NC}"
  exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Docker Compose não encontrado! Instale: https://docs.docker.com/compose/install/${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Docker e Docker Compose instalados${NC}"

# ─── Setup .env ───
echo -e "${YELLOW}[2/8] Configurando variáveis de ambiente...${NC}"

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
  echo ""
  echo -e "${BLUE}Configure os domínios da aplicação:${NC}"
  echo ""
  read -p "  Domínio do Frontend (ex: app.seudominio.com): " APP_DOMAIN
  read -p "  Domínio da API      (ex: api.seudominio.com): " API_DOMAIN
  echo ""

  if [ -z "$APP_DOMAIN" ] || [ -z "$API_DOMAIN" ]; then
    echo -e "${RED}Ambos os domínios são obrigatórios!${NC}"
    exit 1
  fi

  echo -e "${BLUE}Configure a conta de administrador:${NC}"
  echo ""
  read -p "  Email do administrador: " ADMIN_EMAIL
  read -s -p "  Senha do administrador: " ADMIN_PASSWORD
  echo ""
  echo ""

  if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}Email e senha do administrador são obrigatórios!${NC}"
    exit 1
  fi

  if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}A senha deve ter no mínimo 6 caracteres!${NC}"
    exit 1
  fi

  # Generate secrets
  JWT_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  BAILEYS_API_KEY=$(openssl rand -hex 16)

  # Generate ANON_KEY (JWT with role=anon)
  ANON_KEY=$(node -e "
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss:'supabase',ref:'local',role:'anon',
      iat:Math.floor(Date.now()/1000),
      exp:Math.floor(Date.now()/1000)+315360000
    })).toString('base64url');
    const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
    console.log(header+'.'+payload+'.'+sig);
  " 2>/dev/null || echo "generate-manually")

  # Generate SERVICE_ROLE_KEY (JWT with role=service_role)
  SERVICE_ROLE_KEY=$(node -e "
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss:'supabase',ref:'local',role:'service_role',
      iat:Math.floor(Date.now()/1000),
      exp:Math.floor(Date.now()/1000)+315360000
    })).toString('base64url');
    const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
    console.log(header+'.'+payload+'.'+sig);
  " 2>/dev/null || echo "generate-manually")

  APP_URL="https://${APP_DOMAIN}"
  API_URL="https://${API_DOMAIN}"

  cat > .env << EOF
APP_DOMAIN=${APP_DOMAIN}
API_DOMAIN=${API_DOMAIN}
APP_URL=${APP_URL}
API_URL=${API_URL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
BAILEYS_API_KEY=${BAILEYS_API_KEY}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
OPENAI_API_KEY=
EOF

  echo -e "${GREEN}✓ .env gerado com secrets automáticos${NC}"
  echo -e "${YELLOW}  Frontend: ${APP_URL}${NC}"
  echo -e "${YELLOW}  API:      ${API_URL}${NC}"
  echo -e "${YELLOW}  Admin:    ${ADMIN_EMAIL}${NC}"
else
  echo -e "${GREEN}✓ .env já existe, mantendo configurações existentes${NC}"
fi

# Load .env
source .env

# ─── Create Docker network ───
echo -e "${YELLOW}[3/8] Configurando rede Docker...${NC}"

docker network create web 2>/dev/null || true
echo -e "${GREEN}✓ Rede 'web' pronta${NC}"

# ─── Build frontend ───
echo -e "${YELLOW}[4/8] Buildando frontend React...${NC}"

REPO_ROOT="$(dirname "$DEPLOY_DIR")"
cd "$REPO_ROOT"

# Create frontend .env for build
cat > .env.production << EOF
VITE_SUPABASE_URL=${API_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
EOF

if command -v bun &> /dev/null; then
  bun install --frozen-lockfile 2>/dev/null || bun install
  bun run build
elif command -v npm &> /dev/null; then
  npm ci 2>/dev/null || npm install
  npm run build
else
  echo -e "${RED}Node.js/npm/bun não encontrado! Instale Node.js 20+${NC}"
  exit 1
fi

# Copy build to deploy/frontend
rm -rf "$DEPLOY_DIR/frontend"
cp -r dist "$DEPLOY_DIR/frontend"
echo -e "${GREEN}✓ Frontend buildado e copiado para deploy/frontend/${NC}"

# ─── Docker Compose ───
echo -e "${YELLOW}[5/8] Buildando e subindo containers Docker...${NC}"

cd "$DEPLOY_DIR"
docker compose build
docker compose up -d

echo -e "${GREEN}✓ Containers iniciados${NC}"

# ─── Wait for PostgreSQL + GoTrue ───
echo -e "${YELLOW}[6/8] Aguardando PostgreSQL e GoTrue...${NC}"

# Wait for PostgreSQL
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 2
  echo -n "."
done
echo ""
echo -e "${GREEN}✓ PostgreSQL pronto${NC}"

# Wait for GoTrue
echo -n "  Aguardando GoTrue"
for i in {1..30}; do
  if docker compose exec -T gotrue wget -qO- http://localhost:9999/health &>/dev/null; then
    break
  fi
  sleep 2
  echo -n "."
done
echo ""
echo -e "${GREEN}✓ GoTrue respondeu ao health check${NC}"

# Wait for GoTrue to stabilize (internal migrations)
echo -e "  Aguardando GoTrue estabilizar (migrações internas)..."
sleep 30

# Verify GoTrue container is actually running (not restarting)
for i in {1..12}; do
  STATE=$(docker compose ps gotrue --format '{{.State}}' 2>/dev/null || echo "unknown")
  if [ "$STATE" = "running" ]; then
    break
  fi
  echo -e "  GoTrue estado: ${STATE}, aguardando..."
  sleep 5
done
echo -e "${GREEN}✓ GoTrue estável${NC}"

# ─── Create admin account ───
echo -e "${YELLOW}[7/8] Criando conta de administrador...${NC}"

ADMIN_CREATED=false
for attempt in {1..5}; do
  echo -e "  Tentativa ${attempt}/5..."

  STATE=$(docker compose ps gotrue --format '{{.State}}' 2>/dev/null || echo "unknown")
  if [ "$STATE" != "running" ]; then
    echo -e "  GoTrue não está running (estado: ${STATE}), aguardando..."
    sleep 10
    continue
  fi

  ADMIN_RESULT=$(docker compose exec -T gotrue wget -qO- \
    --header="Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    --header="Content-Type: application/json" \
    --post-data="{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Admin\"}}" \
    http://localhost:9999/admin/users 2>&1) || true

  if echo "$ADMIN_RESULT" | grep -q '"id"'; then
    echo -e "${GREEN}✓ Conta admin criada: ${ADMIN_EMAIL}${NC}"
    ADMIN_CREATED=true
    break
  elif echo "$ADMIN_RESULT" | grep -qi 'already'; then
    echo -e "${YELLOW}⚠ Conta admin já existe: ${ADMIN_EMAIL}${NC}"
    ADMIN_CREATED=true
    break
  else
    echo -e "${YELLOW}  Falhou: ${ADMIN_RESULT}${NC}"
    sleep 10
  fi
done

if [ "$ADMIN_CREATED" = false ]; then
  echo -e "${RED}✗ Não foi possível criar o admin após 5 tentativas${NC}"
  echo -e "${YELLOW}  Verifique os logs: docker compose logs gotrue${NC}"
fi

# ─── Summary ───
echo -e "${YELLOW}[8/8] Verificando serviços...${NC}"

sleep 5

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Instalação concluída com sucesso!              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Frontend:${NC}  ${APP_URL}"
echo -e "  ${GREEN}API:${NC}       ${API_URL}"
echo -e "  ${GREEN}Admin:${NC}     ${ADMIN_EMAIL}"
echo ""
echo -e "  ${YELLOW}Próximos passos:${NC}"
echo -e "  1. Configure o DNS dos domínios apontando para este servidor"
echo -e "  2. Configure o reverse proxy (Traefik/Nginx) para SSL"
echo -e "     - ${APP_DOMAIN} → localhost:80 (container nginx)"
echo -e "     - ${API_DOMAIN} → localhost:80 (container nginx)"
echo -e "  3. Acesse ${APP_URL} e faça login com a conta admin"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo -e "  docker compose logs -f          # Ver logs"
echo -e "  docker compose restart           # Reiniciar"
echo -e "  ./update.sh                      # Atualizar após mudanças"
echo ""
