import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface CrossInstanceConversation {
  id: string;
  remote_jid: string;
  instance_name: string | null;
  contact_name: string | null;
  phone_number: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  message_count?: number;
}

/**
 * Finds the same contact (by phone/remote_jid) across OTHER instances in the workspace,
 * excluding the currently open conversation.
 */
export function useCrossInstanceConversations(params: {
  currentConversationId: string | null;
  remoteJid: string | null;
  phoneNumber: string | null;
}) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: [
      "cross-instance-conversations",
      workspaceId,
      params.currentConversationId,
      params.remoteJid,
      params.phoneNumber,
    ],
    enabled: !!workspaceId && !!params.remoteJid,
    queryFn: async () => {
      if (!params.remoteJid) return [];

      // Build OR filter: same remote_jid OR same phone_number
      const filters: string[] = [`remote_jid.eq.${params.remoteJid}`];
      if (params.phoneNumber) {
        filters.push(`phone_number.eq.${params.phoneNumber}`);
      }

      const { data, error } = await (supabase as any)
        .from("conversations")
        .select(
          "id, remote_jid, instance_name, contact_name, phone_number, last_message, last_message_at, unread_count"
        )
        .eq("workspace_id", workspaceId)
        .or(filters.join(","))
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return ((data || []) as CrossInstanceConversation[]).filter(
        (c) => c.id !== params.currentConversationId
      );
    },
  });
}
