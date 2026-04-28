/**
 * Helper centralizado para conversar com o Baileys gateway.
 */
export const BAILEYS_URL = process.env.BAILEYS_URL || "http://baileys-gateway:8080";
export const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || "";

export async function baileysRequest<T = any>(
  path: string,
  method: string = "POST",
  body?: any,
): Promise<T> {
  const resp = await fetch(`${BAILEYS_URL}${path}`, {
    method,
    headers: { apikey: BAILEYS_API_KEY, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  // O gateway sempre responde JSON
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!resp.ok) {
    const msg = data?.error || resp.statusText;
    const err = new Error(`Baileys ${resp.status}: ${msg}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return data as T;
}
