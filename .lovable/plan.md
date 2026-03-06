

## Root Cause

GoTrue now connects as `supabase_auth_admin` (correct), but this role doesn't have `CREATE` permission on the `public` schema. GoTrue's migration runner tries to create `schema_migrations` in `public` and gets `permission denied`.

## Fix

Add a `GRANT` for `supabase_auth_admin` on the `public` schema in `deploy/init-auth-role.sh` (which runs before `init-db.sql`):

```sql
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
```

This is safe because the `public` schema already exists by default in every Postgres database (unlike `auth` which caused the previous error).

### Change in `deploy/init-auth-role.sh`

Add after the `ALTER ROLE` line:

```bash
psql -U postgres <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE CREATEDB REPLICATION;
    END IF;
  END \$\$;
  ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  GRANT ALL ON SCHEMA public TO supabase_auth_admin;
EOSQL
```

### Redeploy

```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 25
docker compose logs gotrue --tail=10
```

