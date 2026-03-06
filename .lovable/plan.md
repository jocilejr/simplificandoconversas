

## Plano: Corrigir GoTrue — reverter search_path e usar connection string

### Problema
O `ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions` quebrou as migrations do GoTrue. A tabela `auth.oauth_clients` foi criada parcialmente na primeira execução e agora a migration falha com `column "client_id" does not exist`.

### Causa raiz
O GoTrue v2.186.0 ignora `GOTRUE_DB_NAMESPACE` nas queries de runtime. As migrations funcionam, mas as queries como `SELECT FROM identities` não qualificam o schema. A solução correta é passar o `search_path` via connection string, não via `ALTER ROLE`.

### Passos

**1. Reverter o ALTER ROLE e limpar estado quebrado (executar na VPS):**
```bash
docker compose exec -T postgres psql -U postgres <<'SQL'
ALTER ROLE supabase_auth_admin RESET search_path;
DROP TABLE IF EXISTS auth.oauth_clients CASCADE;
DROP TABLE IF EXISTS auth.oauth_client_states CASCADE;
DROP TABLE IF EXISTS auth.oauth_authorizations CASCADE;
DROP TABLE IF EXISTS auth.oauth_consents CASCADE;
DROP TYPE IF EXISTS auth.oauth_registration_type CASCADE;
DELETE FROM auth.schema_migrations WHERE version >= '20250731150234';
SQL
```

**2. Atualizar `deploy/docker-compose.yml` e `deploy/portainer-stack.yml`:**

Alterar a variável `GOTRUE_DB_DATABASE_URL` para incluir `search_path=auth` nas options:

De:
```yaml
GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres?sslmode=disable
```

Para:
```yaml
GOTRUE_DB_DATABASE_URL: "postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres?sslmode=disable&options=-csearch_path%3Dauth"
```

**3. Reiniciar GoTrue:**
```bash
git pull
docker compose up -d gotrue
sleep 15
docker compose logs gotrue --tail 10
```

### Arquivos alterados
- `deploy/docker-compose.yml` — connection string do GoTrue
- `deploy/portainer-stack.yml` — mesma alteração

