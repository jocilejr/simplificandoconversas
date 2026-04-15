import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";

export type QuickReply = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
};

export function useQuickReplies() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ["quick_replies", workspaceId],
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_replies")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QuickReply[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quick_replies"] });

  const create = useMutation({
    mutationFn: async ({ title, content, category }: { title: string; content: string; category: string }) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { error } = await supabase
        .from("quick_replies")
        .insert({ title, content, category, user_id: user!.id, workspace_id: workspaceId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, title, content, category }: { id: string; title: string; content: string; category: string }) => {
      const { error } = await supabase
        .from("quick_replies")
        .update({ title, content, category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_replies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const renameCategory = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { error } = await supabase
        .from("quick_replies")
        .update({ category: newName })
        .eq("workspace_id", workspaceId)
        .eq("category", oldName);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, create, update, remove, renameCategory };
}
