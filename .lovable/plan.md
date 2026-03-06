

## Problem

GoTrue fails with `ERROR: schema "auth" does not exist (SQLSTATE 3F000)`. GoTrue's first migration (`00_init_auth_schema.up.sql`) tries to create tables in the `auth` schema but expects the schema itself to already exist. The `supabase/postgres` image normally pre-creates this, but in this setup it is not present.

## Fix

Add `CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;` to `deploy/init-auth-role.sh`. This script runs as `98-init-auth-role.sh` (before `99-init.sql`), so the `auth` schema will exist when GoTrue runs its migrations.

### Changes to `deploy/init-auth-role.sh`

Add one line after the GRANT:

```sql
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
```

## After deploying

```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 30
docker compose logs gotrue --tail=10
```

Then create the admin user with the same `wget` command as before.

