import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationMessage {
  id: string;
  content: string | null;
  direction: "inbound" | "outbound";
  message_type: string;
  media_url: string | null;
  created_at: string;
}

export function useReminderConversation(
  remoteJid: string | null,
  instanceName: string | null
) {
  return useQuery({
    queryKey: ["reminder-conversation", remoteJid, instanceName],
    queryFn: async () => {
      if (!remoteJid) return [];

      // 1. Find the conversation
      let convQuery = (supabase as any)
        .from("conversations")
        .select("id")
        .eq("remote_jid", remoteJid);

      if (instanceName) {
        convQuery = convQuery.eq("instance_name", instanceName);
      }

      const { data: convData, error: convError } = await convQuery.limit(1).single();

      if (convError || !convData) return [];

      // 2. Fetch last 50 messages
      const { data: messages, error: msgError } = await (supabase as any)
        .from("messages")
        .select("id, content, direction, message_type, media_url, created_at")
        .eq("conversation_id", convData.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (msgError) throw msgError;
      return (messages || []) as ConversationMessage[];
    },
    enabled: !!remoteJid,
    staleTime: 30_000,
  });
}
