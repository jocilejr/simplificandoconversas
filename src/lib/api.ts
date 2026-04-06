/**
 * Centralized API URL builder for VPS deployments.
 *
 * In the VPS setup, the frontend runs on APP_DOMAIN and the backend API runs
 * on API_DOMAIN. Relative `/api/...` paths would hit the frontend Nginx block
 * and return `index.html` instead of JSON.
 *
 * This helper builds the correct absolute URL using the VITE_SUPABASE_URL env
 * variable (which maps to the API_DOMAIN via Nginx `functions/v1` → backend).
 *
 * For local development (Lovable preview), it falls back to relative paths.
 */

function getApiBaseUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

  // If the URL looks like a Supabase cloud URL, we're in the Lovable preview
  // and the /api/ paths won't work either way. Use functions/v1 path.
  if (supabaseUrl.includes(".supabase.co")) {
    return `${supabaseUrl}/functions/v1`;
  }

  // VPS: the SUPABASE_URL points to the API_DOMAIN which has the
  // /functions/v1/ → backend proxy. Use that.
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }

  // Fallback: relative path (won't work on split-domain VPS but is a safe default)
  return "/functions/v1";
}

/**
 * Build a full API URL for an email endpoint.
 * Usage: `apiUrl("email/test")` → `https://API_DOMAIN/functions/v1/email/test`
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return `${base}/${path.replace(/^\//, "")}`;
}

/**
 * Safe JSON parsing that detects HTML responses (SPA fallback).
 * Throws a clear error instead of "Unexpected token <".
 */
export async function safeJsonResponse(resp: Response): Promise<any> {
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(
      "O servidor retornou HTML em vez de JSON. Verifique se a API está configurada corretamente na VPS."
    );
  }
  return resp.json();
}
