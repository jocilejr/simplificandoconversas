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
  -- Grant supabase_auth_admin permissions on public schema (needed for GoTrue migrations)
  GRANT ALL ON SCHEMA public TO supabase_auth_admin;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_auth_admin;

  -- Create auth schema owned by supabase_auth_admin (GoTrue expects this)
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

  -- Create supabase_storage_admin (used by Storage API)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END
  \$\$;

  -- Create storage schema owned by supabase_storage_admin (Storage API expects this)
  CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres, service_role;
  GRANT ALL ON SCHEMA storage TO anon, authenticated;
EOSQL

echo "Supabase internal roles and permissions created/updated successfully"

# Create dedicated database for Evolution API (Prisma needs empty schema)
psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE evolution;
EOSQL
echo "Evolution database created (or already exists)"
