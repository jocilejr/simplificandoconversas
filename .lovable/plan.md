

## Problem

GoTrue logs show: `relation "identities" does not exist`. GoTrue reported "67 migrations applied successfully" but the `auth` schema was pre-created by `init-db.sql` before GoTrue ran. This conflicts with GoTrue's own internal migration process --- GoTrue expects to create and manage the `auth` schema itself. The memory note confirms this: *"init-db.sql deve ser mantido livre de qualquer definição do schema auth"*.

## Fix

Remove all `auth` schema statements from `deploy/init-db.sql`:

```sql
-- REMOVE these 4 lines:
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
```

GoTrue will create the `auth` schema, the `identities` table, and all related auth tables during its own startup migrations.

## After deploying

```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 30
docker compose logs gotrue --tail=5
```

Then create the admin user:

```bash
docker compose exec -T backend sh -c 'wget -qO- \
  --post-data="{\"email\":\"jocilejun@gmail.com\",\"password\":\"Hollywood123@qA\",\"email_confirm\":true}" \
  --header="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  --header="Content-Type: application/json" \
  http://gotrue:9999/admin/users'
```

