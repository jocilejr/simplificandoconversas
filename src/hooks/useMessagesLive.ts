import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  content: string | null;
  message_type: string;
  direction: "inbound" | "outbound";
  status: string;
  media_url: string | null;
  transcription: string | null;
  created_at: string;
  external_id: string | null;
}

export function useMessagesLive(conversationId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("id, conversation_id, content, message_type, direction, status, media_url, transcription, created_at, external_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}
