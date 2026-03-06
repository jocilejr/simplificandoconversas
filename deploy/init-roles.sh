#!/bin/bash
set -e

psql -U postgres <<-EOSQL
  -- Create supabase_admin (superuser) expected by the image's migrate.sh
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
      CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END
  \$\$;

  -- Create supabase_auth_admin (used by GoTrue)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin WITH LOGIN CREATEROLE CREATEDB PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE supabase_auth_admin WITH LOGIN CREATEROLE CREATEDB PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END
  \$\$;
EOSQL

echo "Supabase internal roles created/updated successfully"
