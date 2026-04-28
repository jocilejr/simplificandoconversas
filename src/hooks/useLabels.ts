import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";

export interface Label {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
}

export function useLabels() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["labels", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("labels")
        .select("id, name, color, workspace_id")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Label[];
    },
  });
}

export function useConversationLabels(conversationId: string | null) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["conversation-labels", conversationId],
    enabled: !!conversationId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversation_labels")
        .select("id, label_id, conversation_id, labels(id,name,color)")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      return (data || []) as Array<{ id: string; label_id: string; conversation_id: string; labels: Label }>;
    },
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await (supabase as any)
        .from("labels")
        .insert({ name, color, workspace_id: workspaceId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast({ title: "Etiqueta criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useAssignLabel() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async ({ conversationId, labelId }: { conversationId: string; labelId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceId) throw new Error("Workspace não selecionado");
      const { error } = await (supabase as any)
        .from("conversation_labels")
        .insert({ conversation_id: conversationId, label_id: labelId, workspace_id: workspaceId, user_id: user.id });
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-labels", vars.conversationId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId, conversationId }: { linkId: string; conversationId: string }) => {
      const { error } = await (supabase as any).from("conversation_labels").delete().eq("id", linkId);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ["conversation-labels", conversationId] });
    },
  });
}
