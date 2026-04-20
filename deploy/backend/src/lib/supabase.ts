import { createClient } from "@supabase/supabase-js";
import { Agent, fetch as undiciFetch } from "undici";

// Direct PostgREST URL — used by restGet/restUpdate/restInsert (bypasses supabase-js)
const POSTGREST_URL = process.env.POSTGREST_DIRECT_URL || "http://postgrest:3000";
// Supabase-JS client URL — supabase-js appends /rest/v1/ internally, so point at nginx which proxies /rest/v1/ → postgrest
const SUPABASE_CLIENT_URL = process.env.SUPABASE_URL || "http://nginx";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

console.log(`[supabase-client] POSTGREST_URL=${POSTGREST_URL} SUPABASE_CLIENT_URL=${SUPABASE_CLIENT_URL}`);

// Force IPv4 to avoid Docker DNS returning IPv6 that doesn't route to postgrest
const ipv4Agent = new Agent({ connect: { family: 4 } as any });

const customFetch: typeof fetch = (async (input: any, init: any = {}) => {
  try {
    return await undiciFetch(input, { ...init, dispatcher: ipv4Agent } as any) as any;
  } catch (err: any) {
    console.error("[supabase-fetch] Network error:", {
      url: typeof input === "string" ? input : input?.url,
      message: err?.message,
      code: err?.code,
      errno: err?.errno,
      cause: err?.cause ? {
        message: err.cause.message,
        code: err.cause.code,
        errno: err.cause.errno,
        syscall: err.cause.syscall,
        address: err.cause.address,
        port: err.cause.port,
      } : undefined,
    });
    throw err;
  }
}) as any;

export function getServiceClient() {
  return createClient(SUPABASE_CLIENT_URL, SERVICE_ROLE_KEY, {
    global: { fetch: customFetch as any },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPostgrestUrl() {
  return POSTGREST_URL;
}

export function getAnonClient(authHeader?: string) {
  const opts: any = { global: { fetch: customFetch as any } };
  if (authHeader) {
    opts.global.headers = { Authorization: authHeader };
  }
  return createClient(SUPABASE_CLIENT_URL, ANON_KEY, opts);
}

export async function restGet<T = any>(table: string, query: string): Promise<T[]> {
  const url = `${POSTGREST_URL}/${table}?${query}`;
  const resp = await undiciFetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
    dispatcher: ipv4Agent,
  } as any);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`PostgREST ${resp.status}: ${body}`);
  }
  return (await resp.json()) as T[];
}

export async function restInsert<T = any>(
  table: string,
  payload: any,
  returnRepresentation = true
): Promise<T[]> {
  const url = `${POSTGREST_URL}/${table}`;
  const resp = await undiciFetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: returnRepresentation ? "return=representation" : "return=minimal",
    },
    body: JSON.stringify(payload),
    dispatcher: ipv4Agent,
  } as any);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`PostgREST ${resp.status}: ${body}`);
  }
  return returnRepresentation ? ((await resp.json()) as T[]) : ([] as T[]);
}

export async function restUpdate(table: string, query: string, payload: any): Promise<void> {
  const url = `${POSTGREST_URL}/${table}?${query}`;
  const resp = await undiciFetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
    dispatcher: ipv4Agent,
  } as any);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`PostgREST ${resp.status}: ${body}`);
  }
}

export { SERVICE_ROLE_KEY, ANON_KEY };
