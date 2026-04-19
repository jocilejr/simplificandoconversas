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

  // Persistent message store — survives restarts so getMessage can serve
  // retry decryption requests even after the gateway is redeployed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.baileys_message_store (
      instance_name text NOT NULL,
      message_id text NOT NULL,
      message jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (instance_name, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_baileys_message_store_instance_created
      ON public.baileys_message_store (instance_name, created_at DESC);
  `);

  // Auto-cleanup: drop messages older than 7 days on each boot
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM public.baileys_message_store WHERE created_at < now() - interval '7 days'`
    );
    if (rowCount && rowCount > 0) {
      console.log(`[baileys:db] cleaned ${rowCount} stale message(s) from store`);
    }
  } catch {}

  console.log("[baileys:db] ensureSchema OK (auth_state + message_store)");
}
