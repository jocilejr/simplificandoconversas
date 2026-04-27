import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function ensureSchema(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.baileys_auth_state (
      instance_name text PRIMARY KEY,
      creds jsonb,
      keys jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await pool.query(sql);
}
