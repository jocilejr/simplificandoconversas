

## Root Cause

The `init-auth-role.sh` script (runs as `98-init-auth-role.sh`) contains `GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;` on line 14. But the `auth` schema doesn't exist yet at that point -- it's created later in `init-db.sql` (runs as `99-init.sql`). With `set -e`, this error aborts the script and causes the entire postgres initialization to fail, making the container unhealthy.

## Fix

Remove line 14 (`GRANT ALL ON SCHEMA auth`) from `deploy/init-auth-role.sh`. This grant is already handled in `init-db.sql` line 8, which runs after the auth schema is created on line 6.

Updated `init-auth-role.sh`:
```bash
#!/bin/bash
set -e

psql -U postgres <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE CREATEDB REPLICATION;
    END IF;
  END \$\$;
  ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
EOSQL

echo "supabase_auth_admin role configured successfully"
```

### Redeploy
```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 25
docker compose logs gotrue --tail=10
```

