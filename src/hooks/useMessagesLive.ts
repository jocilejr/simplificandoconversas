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
    refetchInterval: 1000,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("id, conversation_id, content, message_type, direction, status, media_url, transcription, created_at, external_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      const fresh = (data || []) as ChatMessage[];

      // Preserve pending optimistic messages not yet confirmed in DB
      const current = qc.getQueryData<ChatMessage[]>(["chat-messages", conversationId]) || [];
      const optimistics = current.filter((m) => m.id.startsWith("optimistic-"));
      if (!optimistics.length) return fresh;

      const now = Date.now();
      const freshOutbound = fresh.filter((m) => m.direction === "outbound");
      const stillPending = optimistics.filter((o) => {
        // Drop optimistics older than 15s (failed silently)
        if (now - new Date(o.created_at).getTime() > 15000) return false;
        // Drop if a real outbound message with same content already appeared
        return !freshOutbound.some(
          (m) =>
            m.content === o.content &&
            Math.abs(new Date(m.created_at).getTime() - new Date(o.created_at).getTime()) < 30000
        );
      });

      if (!stillPending.length) return fresh;
      return [...fresh, ...stillPending].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          qc.setQueryData(["chat-messages", conversationId], (old: ChatMessage[] = []) => {
            const msg = payload.new as ChatMessage;
            if (old.some((m) => m.id === msg.id)) return old;
            const withoutOptimistic = old.filter((m) => !m.id.startsWith("optimistic-"));
            return [...withoutOptimistic, msg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          qc.setQueryData(["chat-messages", conversationId], (old: ChatMessage[] = []) =>
            old.map((m) => (m.id === payload.new.id ? ({ ...m, ...payload.new } as ChatMessage) : m))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}
