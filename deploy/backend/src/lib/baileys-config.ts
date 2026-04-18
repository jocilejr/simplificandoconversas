/**
 * Baileys gateway configuration.
 *
 * Reads BAILEYS_URL / BAILEYS_API_KEY first; falls back to legacy
 * EVOLUTION_URL / EVOLUTION_API_URL / EVOLUTION_API_KEY env vars so existing
 * `.env` files keep working during the migration window.
 */
export const BAILEYS_URL =
  process.env.BAILEYS_URL ||
  process.env.EVOLUTION_URL ||
  process.env.EVOLUTION_API_URL ||
  "http://baileys-gateway:8080";

export const BAILEYS_API_KEY =
  process.env.BAILEYS_API_KEY || process.env.EVOLUTION_API_KEY || "";

export function baileysHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: BAILEYS_API_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function baileysRequest(
  path: string,
  method: string = "POST",
  body?: any,
) {
  const resp = await fetch(`${BAILEYS_URL}${path}`, {
    method,
    headers: baileysHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return resp;
}
