import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useFlowExecutions(conversationId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["flow_executions", conversationId],
    enabled: !!user && !!conversationId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_executions")
        .select("*, chatbot_flows(name)")
        .eq("conversation_id", conversationId!)
        .in("status", ["running", "waiting_click"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (executionId: string) => {
      const { error } = await supabase
        .from("flow_executions")
        .update({ status: "cancelled" })
        .eq("id", executionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow_executions", conversationId] });
    },
  });

  return { data: query.data, isLoading: query.isLoading, cancel };
}
