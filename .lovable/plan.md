

## GoTrue continua reiniciando -- correção das roles internas

O GoTrue v2.158.1 precisa de roles e permissões específicas no PostgreSQL que não existem numa instalação limpa. O schema `auth` existe, mas faltam as roles internas que o GoTrue usa para suas migrações.

### Correção em `deploy/init-db.sql`

Adicionar após a criação do schema `auth` (linha 29):

```sql
-- Roles internas que o GoTrue precisa
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO supabase_auth_admin, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin, postgres;

GRANT supabase_auth_admin TO postgres;

-- Extensions que GoTrue precisa no schema extensions ou public
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
```

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

Se ainda falhar, execute `docker compose logs gotrue --tail=50` e cole aqui -- o log dirá exatamente qual role/tabela/extensão está faltando.

