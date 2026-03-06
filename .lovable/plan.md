

## Problem

The Postgres container fails its healthcheck because `init-auth-role.sh` (runs as script `98`) references roles `anon`, `authenticated`, and `service_role` on line 17:

```sql
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
```

But these roles are only created later in `init-db.sql` (script `99`). The `set -e` causes the script to abort on this error, making Postgres "unhealthy".

## Fix

**`deploy/init-auth-role.sh`** — Remove the GRANT USAGE line that references roles not yet created. Keep only the schema creation and admin grants:

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
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
EOSQL
```

**`deploy/init-db.sql`** — Add the auth schema grant for the other roles right after creating them (around line 18):

```sql
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
```

This ensures roles exist before being referenced.

## After deploying

```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 30
docker compose logs gotrue --tail=10
```

Then create the admin user with the same `wget` command.

