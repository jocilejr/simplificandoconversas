import { getServiceClient } from "./supabase";

/**
 * Resolve workspace_id from the request body (preferred) or fallback to DB lookup.
 * If a workspaceId is provided, validate that the user belongs to it or is super admin.
 */
export async function resolveWorkspaceIdFromRequest(body: any, userId: string): Promise<string | null> {
  if (body?.workspaceId && typeof body.workspaceId === "string") {
    const sb = getServiceClient();
    const requestedWorkspaceId = body.workspaceId;

    const [{ data: adminRole }, { data: membership }] = await Promise.all([
      sb.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      sb.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("workspace_id", requestedWorkspaceId).maybeSingle(),
    ]);

    if (adminRole || membership) {
      return requestedWorkspaceId;
    }

    return null;
  }
  return resolveWorkspaceId(userId);
}

/**
 * Resolve the workspace_id for a given user.
 * Strategy: return first workspace the user belongs to.
 * Falls back to null if no workspace found.
 */
export async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.workspace_id || null;
}

/**
 * Resolve workspace_id from a whatsapp instance name.
 */
export async function resolveWorkspaceFromInstance(instanceName: string): Promise<{ userId: string; workspaceId: string } | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("whatsapp_instances")
    .select("user_id, workspace_id")
    .eq("instance_name", instanceName)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, workspaceId: data.workspace_id };
}

/**
 * Resolve workspace_id from a customer phone number by matching conversations.
 * Uses last-8-digit matching for resilience against formatting differences.
 * Falls back to resolveWorkspaceId(userId) if no match found.
 */
export async function resolveWorkspaceFromPhone(userId: string, phone: string | null | undefined): Promise<string | null> {
  if (!phone) return resolveWorkspaceId(userId);

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return resolveWorkspaceId(userId);

  const last8 = digits.slice(-8);
  const sb = getServiceClient();

  // Try to find a conversation with this phone in the user's workspaces
  const { data } = await sb
    .from("conversations")
    .select("workspace_id, phone_number")
    .eq("user_id", userId)
    .not("phone_number", "is", null);

  if (data && data.length > 0) {
    for (const row of data) {
      const rowDigits = (row.phone_number || "").replace(/\D/g, "");
      if (rowDigits.length >= 8 && rowDigits.slice(-8) === last8) {
        return row.workspace_id;
      }
    }
  }

  return resolveWorkspaceId(userId);
}
