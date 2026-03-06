

## Root Cause Found

The Postgres logs reveal the exact error:

```
ERROR: role "anon" does not exist
STATEMENT: GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
```

In `init-db.sql`, line 9 tries to `GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role` **before** the `DO $$ CREATE ROLE` block (around line 14) that actually creates those roles. The script aborts, so no tables are created. Postgres itself starts fine afterward (running, exit code 0), but the database is empty.

## Fix

Reorder `deploy/init-db.sql` so the role creation block runs **before** any GRANT statements that reference those roles. Specifically, move the `DO $$ ... CREATE ROLE anon/authenticated/service_role ... END $$` block to the very top of the file, before the auth schema section.

New order:
1. Create roles (anon, authenticated, service_role) -- moved up
2. Create auth schema + grants
3. Grant on public schema
4. Create tables, indexes, functions, triggers

No other files need to change.

### Redeploy after fix
```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy
docker compose down -v
docker compose up -d
sleep 25
docker compose logs postgres 2>&1 | head -80
```

