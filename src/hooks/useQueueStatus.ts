import { useQuery } from "@tanstack/react-query";
import { apiUrl, safeJsonResponse } from "@/lib/api";

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
