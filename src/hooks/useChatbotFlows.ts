import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface ChatbotFlow {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  nodes: any[];
  edges: any[];
  active: boolean;
  instance_names: string[];
  folder: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatbotFlows() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chatbot-flows", workspaceId],
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ChatbotFlow[];
    },
  });

  const createFlow = useMutation({
    mutationFn: async (name: string) => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { data, error } = await supabase
        .from("chatbot_flows")
        .insert({ user_id: user!.id, name, nodes: [], edges: [], workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] }),
  });

  const updateFlow = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; nodes?: any[]; edges?: any[]; active?: boolean; instance_names?: string[]; folder?: string | null }) => {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chatbot_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] }),
  });

  return { ...query, createFlow, updateFlow, deleteFlow };
}
