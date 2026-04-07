import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export function useRecoveryClicks(transactionIds: string[]) {
  const { workspaceId } = useWorkspace();

  const { data: clicks = [] } = useQuery({
    queryKey: ["recovery-clicks", workspaceId, transactionIds],
    enabled: !!workspaceId && transactionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_clicks")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .in("transaction_id", transactionIds);
      if (error) throw error;
      return data || [];
    },
  });

  const queryClient = useQueryClient();

  const addClick = useMutation({
    mutationFn: async ({ transactionId, recoveryType }: { transactionId: string; recoveryType: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("recovery_clicks").insert({
        transaction_id: transactionId,
        user_id: user.id,
        workspace_id: workspaceId!,
        recovery_type: recoveryType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-clicks"] });
    },
  });

  const getClickCount = (transactionId: string) =>
    clicks.filter((c) => c.transaction_id === transactionId).length;

  return { clicks, addClick, getClickCount };
}
