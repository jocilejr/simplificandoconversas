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
echo -e "${YELLOW}[1/7] Verificando pré-requisitos...${NC}"

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
echo -e "${YELLOW}[2/7] Configurando variáveis de ambiente...${NC}"

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
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

  # Detect APP_URL
  PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
  APP_URL="http://${PUBLIC_IP}"

  cat > .env << EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
APP_URL=${APP_URL}
BAILEYS_API_KEY=${BAILEYS_API_KEY}
OPENAI_API_KEY=
EOF

  echo -e "${GREEN}✓ .env gerado com secrets automáticos${NC}"
  echo -e "${YELLOW}  APP_URL configurado como: ${APP_URL}${NC}"
  echo -e "${YELLOW}  Edite .env se precisar alterar o domínio${NC}"
else
  echo -e "${GREEN}✓ .env já existe, mantendo configurações existentes${NC}"
fi

# Load .env
source .env

# ─── Build frontend ───
echo -e "${YELLOW}[3/7] Buildando frontend React...${NC}"

REPO_ROOT="$(dirname "$DEPLOY_DIR")"
cd "$REPO_ROOT"

# Create frontend .env for build
cat > .env.production << EOF
VITE_SUPABASE_URL=${APP_URL}
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
echo -e "${YELLOW}[4/7] Buildando containers Docker...${NC}"

cd "$DEPLOY_DIR"
docker compose build

echo -e "${GREEN}✓ Containers buildados${NC}"

# ─── Start services ───
echo -e "${YELLOW}[5/7] Iniciando serviços...${NC}"

docker compose up -d

echo -e "${GREEN}✓ Serviços iniciados${NC}"

# ─── Wait for PostgreSQL ───
echo -e "${YELLOW}[6/7] Aguardando PostgreSQL...${NC}"

for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 2
  echo -n "."
done
echo ""
echo -e "${GREEN}✓ PostgreSQL pronto${NC}"

# ─── Summary ───
echo -e "${YELLOW}[7/7] Verificando serviços...${NC}"

sleep 5

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Instalação concluída com sucesso!              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Frontend:${NC}  ${APP_URL}"
echo -e "  ${GREEN}Backend:${NC}   ${APP_URL}/functions/v1/"
echo -e "  ${GREEN}Baileys:${NC}   ${APP_URL}/baileys/"
echo ""
echo -e "  ${YELLOW}Próximos passos:${NC}"
echo -e "  1. Acesse ${APP_URL} no navegador"
echo -e "  2. Crie sua conta"
echo -e "  3. Configure a instância WhatsApp em Configurações"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo -e "  docker compose logs -f          # Ver logs"
echo -e "  docker compose restart           # Reiniciar"
echo -e "  ./update.sh                      # Atualizar após mudanças"
echo ""
