import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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
  });

  useEffect(() => {
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markAsRead = async (conversationId: string) => {
    await supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId);
  };

  return { ...query, markAsRead };
}
