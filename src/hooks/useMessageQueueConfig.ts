import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useMessageQueueConfig() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["message-queue-config", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("message_queue_config" as any)
        .select("*")
        .eq("workspace_id", workspaceId);
      return (data || []) as any[];
    },
    enabled: !!workspaceId,
  });

  const upsertDelay = useMutation({
    mutationFn: async ({ instanceName, delaySeconds }: { instanceName: string; delaySeconds: number }) => {
      if (!workspaceId) throw new Error("No workspace");
      const existing = configs.find((c: any) => c.instance_name === instanceName);
      if (existing) {
        const { error } = await supabase
          .from("message_queue_config" as any)
          .update({ delay_seconds: delaySeconds })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("message_queue_config" as any)
          .insert({
            workspace_id: workspaceId,
            instance_name: instanceName,
            delay_seconds: delaySeconds,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-queue-config", workspaceId] });
    },
  });

  const getDelay = (instanceName: string): number => {
    const config = configs.find((c: any) => c.instance_name === instanceName);
    return config?.delay_seconds || 30;
  };

  return { configs, isLoading, upsertDelay, getDelay };
}
