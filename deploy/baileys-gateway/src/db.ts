import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function upsertLidPhone(lid: string, phone: string): Promise<void> {
  await pool.query(
    `INSERT INTO public.lid_phone_map (lid, phone_number, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (lid) DO UPDATE SET phone_number = EXCLUDED.phone_number, updated_at = now()`,
    [lid, phone]
  );
}

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.lid_phone_map (
      lid text PRIMARY KEY,
      phone_number text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}
