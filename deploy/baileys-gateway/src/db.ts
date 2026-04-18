import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@postgres:5432/postgres",
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function ensureSchema() {
  // Auth state storage (Postgres replaces Baileys' default file store)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.baileys_auth_state (
      instance_name text NOT NULL,
      key text NOT NULL,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (instance_name, key)
    );
    CREATE INDEX IF NOT EXISTS idx_baileys_auth_state_instance
      ON public.baileys_auth_state (instance_name);
  `);
}
