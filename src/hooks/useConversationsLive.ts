import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface ChatConversation {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  phone_number: string | null;
  instance_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  workspace_id: string;
}

export function useConversationsLive(opts: {
  instanceName?: string | null;
  labelId?: string | null;
  search?: string;
}) {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-conversations", workspaceId, opts.instanceName, opts.labelId, opts.search],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("conversations")
        .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, unread_count, workspace_id")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);

      if (opts.instanceName) q = q.eq("instance_name", opts.instanceName);

      if (opts.search && opts.search.trim()) {
        const s = opts.search.trim().replace(/[%,]/g, "");
        q = q.or(`contact_name.ilike.%${s}%,phone_number.ilike.%${s}%,remote_jid.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      let list = (data || []) as ChatConversation[];

      if (opts.labelId) {
        const { data: links } = await (supabase as any)
          .from("conversation_labels")
          .select("conversation_id")
          .eq("workspace_id", workspaceId)
          .eq("label_id", opts.labelId);
        const ids = new Set((links || []).map((l: any) => l.conversation_id));
        list = list.filter((c) => ids.has(c.id));
      }

      return list;
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`chat-conversations-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-conversations", workspaceId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);

  return query;
}

export async function markConversationRead(conversationId: string) {
  await (supabase as any)
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
}
