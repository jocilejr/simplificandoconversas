import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  remote_jid: string;
  content: string | null;
  message_type: string;
  direction: string;
  status: string;
  external_id: string | null;
  media_url: string | null;
  created_at: string;
};

export function useMessages(conversationId: string | null, remoteJid?: string | null) {
  const queryClient = useQueryClient();
  const fetchedRef = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
  });

  // Auto-fetch messages from Evolution API when conversation is selected and has no local messages
  useEffect(() => {
    if (!conversationId || !remoteJid) return;
    if (fetchedRef.current.has(conversationId)) return;

    // Fetch messages from Evolution API when conversation is selected
    // We do this once per conversation to populate the local DB
    fetchedRef.current.add(conversationId);
    supabase.functions
      .invoke("evolution-proxy", {
        body: { action: "fetch-messages", remoteJid, count: 100 },
      })
      .then(({ data, error }) => {
        console.log("fetch-messages result:", data, error);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
      });
  }, [conversationId, remoteJid, queryClient]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      remoteJid,
      message,
      messageType = "text",
      mediaUrl,
    }: {
      remoteJid: string;
      message: string;
      messageType?: string;
      mediaUrl?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "send-message", remoteJid, message, messageType, mediaUrl },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return { ...query, sendMessage };
}
