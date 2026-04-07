import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useAIConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let { data, error } = await (supabase as any)
        .from("ai_config")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newConfig, error: insertError } = await (supabase as any)
          .from("ai_config")
          .insert({ user_id: user.id, workspace_id: workspaceId })
          .select()
          .single();
        if (insertError) throw insertError;
        data = newConfig;
      }

      return data;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: {
      reply_system_prompt?: string;
      listen_rules?: string;
      max_context_messages?: number;
      reply_stop_contexts?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!workspaceId) throw new Error("Workspace não selecionado");

      const { error } = await (supabase as any)
        .from("ai_config")
        .upsert({ user_id: user.id, workspace_id: workspaceId, ...updates }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast({ title: "Configuração de IA salva!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  return { config, isLoading, updateConfig };
}
