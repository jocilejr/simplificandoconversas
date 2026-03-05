import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
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
    onMutate: async ({ remoteJid, message, messageType = "text", mediaUrl }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      const previousMessages = queryClient.getQueryData<Message[]>(["messages", conversationId]);

      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId!,
        user_id: "",
        remote_jid: remoteJid,
        content: message,
        message_type: messageType,
        direction: "outbound",
        status: "sending",
        external_id: null,
        media_url: mediaUrl || null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(["messages", conversationId], (old) => [
        ...(old || []),
        optimisticMsg,
      ]);

      return { previousMessages };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", conversationId], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return { ...query, sendMessage };
}
