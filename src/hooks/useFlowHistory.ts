import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FlowHistoryEntry {
  id: string;
  flow_id: string;
  user_id: string;
  name: string;
  nodes: any[];
  edges: any[];
  created_at: string;
}

export function useFlowHistory(flowId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["flow-history", flowId],
    enabled: !!user && !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatbot_flow_history" as any)
        .select("*")
        .eq("flow_id", flowId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as FlowHistoryEntry[];
    },
  });

  const saveSnapshot = useMutation({
    mutationFn: async ({ name, nodes, edges }: { name: string; nodes: any[]; edges: any[] }) => {
      const { error } = await supabase
        .from("chatbot_flow_history" as any)
        .insert({
          flow_id: flowId,
          user_id: user!.id,
          name,
          nodes,
          edges,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-history", flowId] }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chatbot_flow_history" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-history", flowId] }),
  });

  return { ...query, saveSnapshot, deleteEntry };
}
