/**
 * Postgres-backed AuthenticationState for Baileys.
 *
 * Stores creds + signal keys per instance in a single table:
 *   baileys_auth_state(instance_name, key, value jsonb)
 *
 * Buffer values are encoded as { type: "Buffer", data: number[] } in JSON
 * so they round-trip safely through JSONB.
 */
import {
  initAuthCreds,
  proto,
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  BufferJSON,
} from "@whiskeysockets/baileys";
import { pool } from "./db";

function encode(value: any) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function decode(value: any) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

async function readKey(instanceName: string, key: string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT value FROM public.baileys_auth_state WHERE instance_name = $1 AND key = $2`,
    [instanceName, key]
  );
  if (!rows.length) return null;
  return decode(rows[0].value);
}

async function writeKey(instanceName: string, key: string, value: any): Promise<void> {
  if (value === null || value === undefined) {
    await pool.query(
      `DELETE FROM public.baileys_auth_state WHERE instance_name = $1 AND key = $2`,
      [instanceName, key]
    );
    return;
  }
  const encoded = encode(value);
  await pool.query(
    `INSERT INTO public.baileys_auth_state (instance_name, key, value, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (instance_name, key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [instanceName, key, JSON.stringify(encoded)]
  );
}

export async function deleteAllAuth(instanceName: string): Promise<void> {
  await pool.query(
    `DELETE FROM public.baileys_auth_state WHERE instance_name = $1`,
    [instanceName]
  );
}

/** Clear sender-key-memory so Baileys redistributes sender keys to all group
 *  participants on the next send. Fixes the "messages loading" issue on restart. */
export async function clearSenderKeyMemory(instanceName: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM public.baileys_auth_state WHERE instance_name = $1 AND key LIKE 'sender-key-memory%'`,
    [instanceName]
  );
  console.log(`[baileys:${instanceName}] cleared ${rowCount} sender-key-memory entries`);
}

export async function listInstanceNames(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT instance_name FROM public.baileys_auth_state WHERE key = 'creds'`
  );
  return rows.map((r) => r.instance_name);
}

export async function usePostgresAuthState(
  instanceName: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const credsRaw = await readKey(instanceName, "creds");
  const creds: AuthenticationCreds = credsRaw || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readKey(instanceName, `${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value !== null && value !== undefined) {
                data[id] = value;
              }
            })
          );
          return data;
        },
        set: async (data: any) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const compositeKey = `${category}-${id}`;
              tasks.push(writeKey(instanceName, compositeKey, value));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeKey(instanceName, "creds", creds);
    },
  };
}
