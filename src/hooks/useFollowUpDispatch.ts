import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl, safeJsonResponse } from "@/lib/api";

export interface FollowUpDispatchJob {
  id: string;
  transaction_id: string;
  rule_id: string;
  customer_name: string | null;
  normalized_phone: string | null;
  status: "pending" | "processing" | "sent" | "failed" | "skipped_phone_limit" | "skipped_invalid_phone" | "skipped_duplicate";
  last_error: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface FollowUpDispatchStatus {
  ok: true;
  workspaceId: string;
  date: string;
  counts: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    skipped_phone_limit: number;
    skipped_invalid_phone: number;
    skipped_duplicate: number;
  };
  jobs: FollowUpDispatchJob[];
}

export interface RunFollowUpNowResult {
  ok: true;
  source: "manual";
  processed: number;
  generated: number;
  requeued: number;
  sent: number;
  failed: number;
  skipped: number;
  pendingAfterRun: number;
  locked: number;
}

export function useFollowUpDispatchStatus() {
  const { workspaceId } = useWorkspace();

  return useQuery<FollowUpDispatchStatus | null>({
    queryKey: ["followup-dispatch-status", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 10000,
    queryFn: async () => {
      if (!workspaceId) return null;
      const resp = await fetch(`${apiUrl("followup-daily/status")}?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!resp.ok) {
        throw new Error("Erro ao carregar status do Follow Up");
      }
      return (await safeJsonResponse(resp)) as FollowUpDispatchStatus;
    },
  });
}

export function useRunFollowUpNow() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation<RunFollowUpNowResult>({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Workspace não encontrado");
      const resp = await fetch(apiUrl("followup-daily/process"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          includeFailed: true,
        }),
      });
      if (!resp.ok) {
        const error = await safeJsonResponse(resp).catch(() => ({ error: "Erro ao executar Follow Up" }));
        throw new Error(error?.error || "Erro ao executar Follow Up");
      }
      return (await safeJsonResponse(resp)) as RunFollowUpNowResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["followup-dispatch-status", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] }),
      ]);
    },
  });
}
