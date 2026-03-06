#!/bin/bash
set -e

# Set supabase_auth_admin password to match POSTGRES_PASSWORD
# This runs before init-db.sql (98 < 99) so the role exists when GoTrue connects
psql -U postgres <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE CREATEDB REPLICATION;
    END IF;
  END \$\$;
  ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
EOSQL

echo "supabase_auth_admin role configured successfully"
