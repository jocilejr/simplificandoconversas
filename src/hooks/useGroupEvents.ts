import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useGroupEvents() {
  const { workspaceId } = useWorkspace();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["group-events", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return { events, isLoading };
}
