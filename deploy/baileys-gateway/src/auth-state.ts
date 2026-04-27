/**
 * Baileys auth state persistido em Postgres (public.baileys_auth_state).
 * Substitui o useMultiFileAuthState (filesystem) e elimina dependência de Redis.
 */
import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { pool } from "./db";

type CredsRow = { creds: any; keys: Record<string, Record<string, any>> };

async function loadRow(instance: string): Promise<CredsRow> {
  const r = await pool.query(
    "SELECT creds, keys FROM public.baileys_auth_state WHERE instance_name = $1",
    [instance],
  );
  if (r.rowCount === 0) {
    return { creds: null, keys: {} };
  }
  return { creds: r.rows[0].creds, keys: r.rows[0].keys || {} };
}

async function saveRow(instance: string, creds: any, keys: Record<string, any>): Promise<void> {
  await pool.query(
    `INSERT INTO public.baileys_auth_state (instance_name, creds, keys, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (instance_name)
     DO UPDATE SET creds = EXCLUDED.creds, keys = EXCLUDED.keys, updated_at = now()`,
    [instance, creds, keys],
  );
}

export async function deleteAuthState(instance: string): Promise<void> {
  await pool.query("DELETE FROM public.baileys_auth_state WHERE instance_name = $1", [instance]);
}

export async function usePostgresAuthState(
  instance: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const row = await loadRow(instance);
  let creds: AuthenticationCreds = row.creds
    ? (JSON.parse(JSON.stringify(row.creds), BufferJSON.reviver) as AuthenticationCreds)
    : initAuthCreds();
  const keys: Record<string, Record<string, any>> = row.keys
    ? JSON.parse(JSON.stringify(row.keys), BufferJSON.reviver)
    : {};

  const persist = async () => {
    const credsSerialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    const keysSerialized = JSON.parse(JSON.stringify(keys, BufferJSON.replacer));
    await saveRow(instance, credsSerialized, keysSerialized);
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        const bucket = keys[type] || {};
        for (const id of ids) {
          let value = bucket[id];
          if (value && type === "app-state-sync-key") {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          if (value !== undefined) data[id] = value as any;
        }
        return data;
      },
      set: async (data) => {
        for (const category of Object.keys(data)) {
          if (!keys[category]) keys[category] = {};
          const items = (data as any)[category] as Record<string, any>;
          for (const id of Object.keys(items)) {
            const val = items[id];
            if (val === null || val === undefined) {
              delete keys[category][id];
            } else {
              keys[category][id] = val;
            }
          }
        }
        await persist();
      },
    },
  };

  const saveCreds = async () => {
    await persist();
  };

  return { state, saveCreds };
}
