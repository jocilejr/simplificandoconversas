import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Conversation = {
  id: string;
  user_id: string;
  remote_jid: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  instance_name: string | null;
};

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    // Polling every 3s — no Realtime WebSocket on VPS
    refetchInterval: 3000,
  });

  const markAsRead = async (conversationId: string) => {
    await supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId);
  };

  const deleteConversation = async (conversationId: string) => {
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation_labels").delete().eq("conversation_id", conversationId);
    const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  return { ...query, markAsRead, deleteConversation };
}
