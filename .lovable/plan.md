

## Root Cause Analysis

The `supabase/postgres:15.8.1.060` image includes its own initialization scripts baked into `/docker-entrypoint-initdb.d/` that create the `auth` schema, roles, and extensions. Your `init-db.sql` is mounted as `01-init.sql`, which likely runs **before** the image's own scripts. This creates a race condition where:

1. `01-init.sql` runs first, creates a bare `auth` schema
2. The image's own init scripts see `auth` already exists and skip their full setup (or conflict)
3. GoTrue connects and finds the schema incomplete/misconfigured for its migrations

## Fix

Two changes to `docker-compose.yml` and `init-db.sql`:

### 1. Rename the mount to run LAST

Change the mount from `01-init.sql` to `99-init.sql` so the image's built-in scripts run first:

```yaml
# In docker-compose.yml (and portainer-stack.yml)
- ./init-db.sql:/docker-entrypoint-initdb.d/99-init.sql
```

### 2. Remove auth schema creation from init-db.sql

Remove the line `CREATE SCHEMA IF NOT EXISTS auth;` from `init-db.sql`. The supabase/postgres image handles this internally. Also remove the storage schema/tables creation since the storage service handles that too.

### 3. Full redeploy

After these changes:
```bash
docker compose down -v
docker compose up -d
sleep 20
docker compose logs gotrue --tail=10
```

## Technical Details

- The `supabase/postgres` image pre-configures: `auth` schema, `supabase_auth_admin` role, `supabase_admin` role, required extensions (`pgcrypto`, `uuid-ossp`), and grants
- Scripts in `/docker-entrypoint-initdb.d/` run alphabetically on first init (empty data dir)
- By mounting as `99-init.sql`, the public schema tables are created after all Supabase infrastructure is ready

