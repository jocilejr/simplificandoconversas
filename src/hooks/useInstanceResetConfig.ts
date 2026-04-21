import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useInstanceResetConfig() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["instance-reset-config", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("instance_reset_config" as any)
        .select("*")
        .eq("workspace_id", workspaceId);
      return (data || []) as any[];
    },
    enabled: !!workspaceId,
  });

  const upsertConfig = useMutation({
    mutationFn: async (params: {
      instanceName: string;
      enabled: boolean;
      intervalMinutes: number;
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      const existing = configs.find((c: any) => c.instance_name === params.instanceName);

      if (existing) {
        const { error } = await supabase
          .from("instance_reset_config" as any)
          .update({
            enabled: params.enabled,
            interval_minutes: params.intervalMinutes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("instance_reset_config" as any)
          .insert({
            workspace_id: workspaceId,
            instance_name: params.instanceName,
            enabled: params.enabled,
            interval_minutes: params.intervalMinutes,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-reset-config", workspaceId] });
    },
  });

  const getConfig = (instanceName: string) => {
    return configs.find((c: any) => c.instance_name === instanceName);
  };

  return { configs, isLoading, upsertConfig, getConfig };
}
