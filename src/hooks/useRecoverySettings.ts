import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";

export function useRecoverySettings() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["recovery-settings", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data } = await supabase
        .from("recovery_settings" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!workspaceId,
  });

  const upsert = useMutation({
    mutationFn: async (values: {
      enabled?: boolean;
      instance_name?: string;
      delay_seconds?: number;
      send_after_minutes?: number;
    }) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace");

      if (settings?.id) {
        const { error } = await supabase
          .from("recovery_settings" as any)
          .update(values)
          .eq("id", (settings as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recovery_settings" as any)
          .insert({
            workspace_id: workspaceId,
            user_id: user.id,
            ...values,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-settings", workspaceId] });
    },
  });

  return { settings, isLoading, upsert };
}

export function useRecoveryQueue() {
  const { workspaceId } = useWorkspace();

  const { data: queue, isLoading, refetch } = useQuery({
    queryKey: ["recovery-queue", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("recovery_queue" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });

  const cancelItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recovery_queue" as any)
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  return { queue: queue || [], isLoading, refetch, cancelItem };
}
