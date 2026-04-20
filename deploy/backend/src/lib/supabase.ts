import { createClient } from "@supabase/supabase-js";

// PostgREST URL (internal Docker network)
// Default to direct PostgREST to avoid passing through internal nginx (which can mask schema cache issues).
const POSTGREST_URL = process.env.SUPABASE_URL || "http://postgrest:3000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

console.log(`[supabase-client] Using POSTGREST_URL=${POSTGREST_URL}`);

export function getServiceClient() {
  return createClient(POSTGREST_URL, SERVICE_ROLE_KEY);
}

export function getPostgrestUrl() {
  return POSTGREST_URL;
}

export function getAnonClient(authHeader?: string) {
  const opts: any = {};
  if (authHeader) {
    opts.global = { headers: { Authorization: authHeader } };
  }
  return createClient(POSTGREST_URL, ANON_KEY, opts);
}

export { SERVICE_ROLE_KEY, ANON_KEY };
