import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface ActiveFlowExecution {
  id: string;
  status: "running" | "waiting_reply" | "waiting_click";
  flow_id: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  running: "Fluxo em andamento",
  waiting_reply: "Aguardando mensagem",
  waiting_click: "Aguardando clique no link",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function useActiveFlowExecution(remoteJid: string | null) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ["active-flow-execution", workspaceId, remoteJid],
    enabled: !!workspaceId && !!remoteJid,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("flow_executions")
        .select("id, status, flow_id")
        .eq("workspace_id", workspaceId)
        .eq("remote_jid", remoteJid)
        .in("status", ["running", "waiting_reply", "waiting_click"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as ActiveFlowExecution | null) ?? null;
    },
  });
}
