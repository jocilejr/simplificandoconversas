import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export function useRecoveryClicks(transactionIds: string[]) {
  const { workspaceId } = useWorkspace();

  // Fetch manual clicks
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

  // Fetch automatic recovery sends (status = sent)
  const { data: queueSent = [] } = useQuery({
    queryKey: ["recovery-queue-sent", workspaceId, transactionIds],
    enabled: !!workspaceId && transactionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("recovery_queue" as any)
        .select("transaction_id")
        .eq("workspace_id", workspaceId!)
        .eq("status", "sent")
        .in("transaction_id", transactionIds) as any);
      if (error) throw error;
      return (data || []) as { transaction_id: string }[];
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

  const getClickCount = (transactionId: string) => {
    const manualCount = clicks.filter((c) => c.transaction_id === transactionId).length;
    const autoCount = queueSent.filter((q) => q.transaction_id === transactionId).length;
    return manualCount + autoCount;
  };

  return { clicks, addClick, getClickCount };
}
