

## GoTrue continua reiniciando — solução definitiva

O problema persiste porque o GoTrue v2.158.1 espera rodar contra um Postgres que já tem a infraestrutura base do Supabase (extensões acessíveis, roles com search_path correto). O `postgres:15-alpine` é um Postgres vanilla que não atende esses requisitos. Cada tentativa de corrigir manualmente no `init-db.sql` resolve um problema mas cria outro.

### Solução: usar `supabase/postgres` no lugar de `postgres:15-alpine`

A imagem `supabase/postgres:15.8.1.060` já vem com:
- Schema `auth` pré-configurado com todos os tipos enum
- Extensões `uuid-ossp`, `pgcrypto` no schema correto
- Roles `supabase_auth_admin`, `supabase_admin` com permissões e search_path
- Todas as tabelas base que o GoTrue espera

### Alterações

**1. `deploy/docker-compose.yml`** — trocar imagem do postgres:
```yaml
postgres:
  image: supabase/postgres:15.8.1.060
```

**2. `deploy/portainer-stack.yml`** — mesma troca.

**3. `deploy/init-db.sql`** — remover tudo relacionado ao schema `auth`, roles `supabase_auth_admin`/`supabase_admin`, e extensões (já vêm na imagem). Manter apenas:
- Roles PostgREST (`anon`, `authenticated`, `service_role`)
- Grants no schema `public`
- Todas as tabelas `public.*`
- Storage tables, indexes, functions, triggers, RBAC

### Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

