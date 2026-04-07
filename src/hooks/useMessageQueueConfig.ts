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

  const upsertConfig = useMutation({
    mutationFn: async (params: {
      instanceName: string;
      delaySeconds?: number;
      pauseAfterSends?: number | null;
      pauseMinutes?: number | null;
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      const existing = configs.find((c: any) => c.instance_name === params.instanceName);
      const values: any = {};
      if (params.delaySeconds !== undefined) values.delay_seconds = params.delaySeconds;
      if (params.pauseAfterSends !== undefined) values.pause_after_sends = params.pauseAfterSends;
      if (params.pauseMinutes !== undefined) values.pause_minutes = params.pauseMinutes;

      if (existing) {
        const { error } = await supabase
          .from("message_queue_config" as any)
          .update(values)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("message_queue_config" as any)
          .insert({
            workspace_id: workspaceId,
            instance_name: params.instanceName,
            delay_seconds: params.delaySeconds ?? 30,
            pause_after_sends: params.pauseAfterSends ?? null,
            pause_minutes: params.pauseMinutes ?? null,
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

  return { configs, isLoading, upsertConfig, getDelay };
}
