import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";

export type QuickReplyCategory = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export function useQuickReplyCategories() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();

  const query = useQuery({
    queryKey: ["quick_reply_categories", workspaceId],
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_reply_categories" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as QuickReplyCategory[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quick_reply_categories"] });
    queryClient.invalidateQueries({ queryKey: ["quick_replies"] });
  };

  const create = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nome inválido");
      const { error } = await supabase
        .from("quick_reply_categories" as any)
        .insert({ name: trimmed, user_id: user!.id, workspace_id: workspaceId } as any);
      if (error) {
        if ((error as any).code === "23505") throw new Error("Já existe uma categoria com este nome");
        throw error;
      }
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, oldName, newName }: { id: string; oldName: string; newName: string }) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      const { error: e1 } = await supabase
        .from("quick_reply_categories" as any)
        .update({ name: trimmed } as any)
        .eq("id", id);
      if (e1) {
        if ((e1 as any).code === "23505") throw new Error("Já existe uma categoria com este nome");
        throw e1;
      }
      const { error: e2 } = await supabase
        .from("quick_replies")
        .update({ category: trimmed })
        .eq("workspace_id", workspaceId)
        .eq("category", oldName);
      if (e2) throw e2;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { count, error: countErr } = await supabase
        .from("quick_replies")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("category", name);
      if (countErr) throw countErr;
      if ((count || 0) > 0) {
        throw new Error(`Esta categoria contém ${count} resposta(s). Mova ou exclua antes.`);
      }
      const { error } = await supabase.from("quick_reply_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, create, rename, remove };
}
