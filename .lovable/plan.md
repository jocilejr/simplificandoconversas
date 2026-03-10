

## Fix: Evolution API precisa de banco dedicado

### Problema
O Evolution API v2 usa Prisma e tenta rodar 49 migrations no banco `postgres`, que já contém as tabelas do app. Prisma rejeita com `P3005: The database schema is not empty`.

### Correção

**`deploy/docker-compose.yml` e `deploy/portainer-stack.yml`** — Alterar `DATABASE_CONNECTION_URI` do serviço `evolution`:

```yaml
# De:
DATABASE_CONNECTION_URI: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/postgres
# Para:
DATABASE_CONNECTION_URI: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/evolution
```

**`deploy/init-roles.sh`** — Adicionar criação do banco `evolution` no script de inicialização do Postgres:

```bash
psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE evolution;
EOSQL
```

Isso garante que o banco exista na primeira instalação. Para a VPS atual (banco já rodando), o usuário cria manualmente com `docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE evolution;"`.

### Após aplicar na VPS

```bash
# Criar banco (VPS já rodando)
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE evolution;"

# Parar serviço que usa porta 80
sudo systemctl stop apache2 nginx 2>/dev/null
sudo systemctl disable apache2 nginx 2>/dev/null

# Puxar código atualizado e reiniciar
git pull
docker compose down
docker compose up -d
docker compose ps
docker compose logs evolution --tail=20
```

