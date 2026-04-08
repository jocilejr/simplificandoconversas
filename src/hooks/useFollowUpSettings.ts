import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";

export function useFollowUpSettings() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["followup-settings", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data } = await supabase
        .from("followup_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return data;
    },
    enabled: !!workspaceId,
  });

  const upsert = useMutation({
    mutationFn: async (values: {
      enabled?: boolean;
      instance_name?: string | null;
      send_after_minutes?: number;
      send_at_hour?: string;
    }) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace");

      const { error } = await supabase
        .from("followup_settings")
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: user.id,
            updated_at: new Date().toISOString(),
            ...values,
          },
          { onConflict: "workspace_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-settings", workspaceId] });
    },
  });

  return { settings, isLoading, upsert };
}
