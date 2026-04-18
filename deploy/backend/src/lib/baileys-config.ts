/**
 * Baileys gateway configuration.
 */
export const BAILEYS_URL =
  process.env.BAILEYS_URL || "http://baileys-gateway:8080";

export const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || "";

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
