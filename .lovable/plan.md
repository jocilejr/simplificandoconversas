

## Root Cause (Confirmed)

The `supabase/postgres:15.8.1.060` image does **not** automatically create the `auth` schema. Our previous assumption was wrong. The image's built-in init scripts either don't exist for this version or require additional configuration. GoTrue's migration tries `CREATE TABLE IF NOT EXISTS auth.users` and fails because the `auth` schema simply doesn't exist.

## Fix

Add back the `auth` schema creation and `supabase_auth_admin` role setup to `init-db.sql`. This must run before GoTrue starts (which it does, since postgres healthcheck passes first).

### Changes to `deploy/init-db.sql`

Replace the comment at lines 5-7 with:

```sql
-- Create auth schema and roles required by GoTrue
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END $$;

ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
```

### After deploying

```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 20
docker compose logs gotrue --tail=10
```

