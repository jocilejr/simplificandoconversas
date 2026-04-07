import { getServiceClient } from "./supabase";

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
