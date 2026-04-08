import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl, safeJsonResponse } from "@/lib/api";

export interface QueueHistoryItem {
  label: string;
  status: "sent" | "failed";
  timestamp: string;
  error?: string;
}

export interface QueueStatus {
  instanceName: string;
  queueSize: number;
  processing: boolean;
  inCooldown: boolean;
  sendCount: number;
  currentLabel: string | null;
  pendingLabels: string[];
  delayMs: number;
  pauseAfterSends: number | null;
  pauseMinutes: number | null;
  history: QueueHistoryItem[];
}

export function useQueueStatus() {
  return useQuery<QueueStatus[]>({
    queryKey: ["queue-status"],
    queryFn: async () => {
      const resp = await fetch(apiUrl("queue-status"));
      if (!resp.ok) return [];
      return safeJsonResponse(resp);
    },
    refetchInterval: 3000,
    retry: 0,
  });
}

export function useClearQueueHistory() {
  const queryClient = useQueryClient();
  return async (instanceName: string) => {
    await fetch(apiUrl("queue-clear-history"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceName }),
    });
    queryClient.invalidateQueries({ queryKey: ["queue-status"] });
  };
}
