

## Plano: Conceder permissões ao supabase_auth_admin

### Problema
O GoTrue conecta como `supabase_auth_admin` e tenta criar a tabela `schema_migrations` no schema `public`, mas recebe `permission denied for schema public`.

### Causa
O `init-roles.sh` cria a role mas não concede permissão de uso/criação no schema `public`.

### Solução

**Atualizar `deploy/init-roles.sh`** — Após criar as roles, adicionar:

```sql
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
```

Também criar o schema `auth` com ownership para `supabase_auth_admin`:

```sql
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
```

### Deploy
```bash
cd ~/simplificandoconversas/deploy
git pull
docker compose down -v
docker compose up -d
sleep 30
docker compose logs postgres --tail 20
docker compose logs gotrue --tail 20
```

