

## Problema: Schema `storage` nunca foi criado

O container `storage` (supabase/storage-api) precisa que o schema `storage` e o role `supabase_storage_admin` existam **antes** de iniciar suas migrações internas. O `init-roles.sh` atual só cria `supabase_admin` e `supabase_auth_admin`, mas não cria nada para o storage.

Resultado: o container storage inicia, mas suas migrações falham silenciosamente. As tabelas `storage.buckets` e `storage.objects` nunca são criadas. Todo upload retorna erro 500.

### Correção

**1. `deploy/init-roles.sh`** -- Adicionar role e schema do storage:
```bash
# Create supabase_storage_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres, service_role;
```

**2. Comando manual na VPS** (para o banco já existente):
```bash
docker compose exec -T postgres psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD current_setting('password');
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres;
GRANT ALL ON SCHEMA storage TO anon, authenticated, service_role;
SQL

docker compose restart storage
docker compose logs -f storage --tail=30
```

Após o storage iniciar com sucesso (deve mostrar "Server listening"), criar o bucket:
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "
INSERT INTO storage.buckets (id, name, public) VALUES ('chatbot-media', 'chatbot-media', true) ON CONFLICT (id) DO NOTHING;"
docker compose restart postgrest
```

**3. `deploy/init-db.sql`** -- Remover a seção de storage (bucket + policies) do init-db.sql, pois ela tenta inserir em `storage.buckets` antes do container storage criar as tabelas. Mover para um script separado ou executar após o storage iniciar.

### Arquivos alterados
- `deploy/init-roles.sh` -- adicionar `supabase_storage_admin` e schema `storage`
- `deploy/init-db.sql` -- remover referências a `storage.buckets`/`storage.objects` (evitar erro na inicialização)

