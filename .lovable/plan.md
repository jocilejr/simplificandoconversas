

## Root Cause Found

Comparing with the official Supabase self-hosting docker-compose reveals **two critical misconfigurations**:

### Problem 1: GoTrue connects as wrong database user
Your config: `postgres://postgres:...@postgres:5432/postgres`
Official config: `postgres://supabase_auth_admin:...@postgres:5432/postgres`

GoTrue must connect as `supabase_auth_admin` (the owner of the `auth` schema), not as `postgres`. This is why migrations fail -- the `postgres` user doesn't have the right context for GoTrue's migration runner.

### Problem 2: `supabase_auth_admin` role lacks LOGIN
Your `init-db.sql` creates the role as `NOLOGIN`, so even if you fix the connection string, GoTrue can't authenticate.

### Problem 3: Version mismatch
Your setup uses `gotrue:v2.158.1` + `postgres:15.8.1.060`. The official pins are `gotrue:v2.186.0` + `postgres:15.8.1.085`.

---

## Fix (3 files)

### 1. `deploy/init-db.sql` -- Make `supabase_auth_admin` a login role

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE CREATEDB REPLICATION;
  END IF;
END $$;

-- Set password (same as POSTGRES_PASSWORD, injected at runtime)
-- We use a placeholder; the password is set via ALTER in the entrypoint
ALTER ROLE supabase_auth_admin WITH PASSWORD 'POSTGRES_PASSWORD_PLACEHOLDER';
```

Actually, since the password needs to match at runtime, the cleanest approach is to add an environment variable. But simpler: use the same `POSTGRES_PASSWORD` by making the init-db.sql a template or using `psql` variable substitution.

**Simplest approach**: Since the postgres container already has `POSTGRES_PASSWORD` as env var, we can use a shell-based init script instead. But even simpler -- we'll just have GoTrue connect as `postgres` user BUT we need to ensure the `auth` schema and its objects are owned by a role that `postgres` can use.

**Actually the cleanest fix**: Change the `GOTRUE_DB_DATABASE_URL` to use `supabase_auth_admin` and set that role's password in `init-db.sql` using a known value, then pass it in the compose file.

### Concrete changes:

**`deploy/init-db.sql`** -- Update `supabase_auth_admin` role creation:
```sql
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE CREATEDB REPLICATION;
-- Password will be set to match POSTGRES_PASSWORD
```
Add a line after role creation to dynamically set password. Since `init-db.sql` runs inside postgres container which has `POSTGRES_PASSWORD` env var, we can use a wrapper `.sh` script. However, the simplest approach:

Use a **fixed known password** for `supabase_auth_admin` and reference it in docker-compose, OR use the same postgres password.

**Final approach -- use `.sh` init script**:

Rename `init-db.sql` to `99-init.sh` (shell scripts are also supported by postgres entrypoint) which can use `$POSTGRES_PASSWORD` to set the role password, then run the SQL.

OR keep it simple: add a second mount `98-auth-role.sh` that sets the password:

```bash
#!/bin/bash
psql -U postgres -c "ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';"
```

### Simplified Plan:

1. **`deploy/init-db.sql`** -- Ensure `supabase_auth_admin` is created with `LOGIN` (not `NOLOGIN`)
2. **Add `deploy/init-auth-role.sh`** -- Shell script mounted as `98-init-auth-role.sh` that sets the password using `$POSTGRES_PASSWORD`
3. **`deploy/docker-compose.yml`** and **`deploy/portainer-stack.yml`**:
   - Change postgres image to `supabase/postgres:15.8.1.085`
   - Change gotrue image to `supabase/gotrue:v2.186.0`
   - Change `GOTRUE_DB_DATABASE_URL` to `postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres?sslmode=disable`
   - Add mount for `98-init-auth-role.sh`

### Redeploy:
```bash
docker compose down -v
docker compose up -d
sleep 20
docker compose logs gotrue --tail=10
```

