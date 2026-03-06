#!/bin/bash
set -e

# The supabase/postgres image already creates supabase_auth_admin role.
# We only need to set the password to match POSTGRES_PASSWORD.
psql -U postgres <<-EOSQL
  ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
EOSQL

echo "supabase_auth_admin password configured successfully"
