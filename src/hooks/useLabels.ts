import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Label = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type ConversationLabel = {
  id: string;
  conversation_id: string;
  label_id: string;
  user_id: string;
};

export function useLabels() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["labels"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Label[];
    },
  });

  const create = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("labels")
        .insert({ name, color, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["labels"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from("labels")
        .update({ name, color })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["labels"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["conversation_labels"] });
    },
  });

  return { ...query, create, update, remove };
}

export function useConversationLabels(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["conversation_labels", conversationId],
    enabled: !!conversationId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_labels")
        .select("*, labels(*)")
        .eq("conversation_id", conversationId!);
      if (error) throw error;
      return data as (ConversationLabel & { labels: Label })[];
    },
  });

  const assign = useMutation({
    mutationFn: async (labelId: string) => {
      if (!conversationId || !user) throw new Error("Sem conversa ou usuário");
      const { error } = await supabase
        .from("conversation_labels")
        .insert({ conversation_id: conversationId, label_id: labelId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation_labels", conversationId] });
    },
  });

  const unassign = useMutation({
    mutationFn: async (labelId: string) => {
      if (!conversationId) throw new Error("Sem conversa");
      const { error } = await supabase
        .from("conversation_labels")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("label_id", labelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation_labels", conversationId] });
    },
  });

  return { ...query, assign, unassign };
}
