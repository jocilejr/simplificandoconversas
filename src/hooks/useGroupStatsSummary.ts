import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export type StatsSummaryPeriod = { start: string; end: string };

type Counts = { add: number; remove: number; promote: number; demote: number };

export interface StatsSummary extends Counts {
  perGroup: Record<string, Counts>;
  lastSyncedAt: string | null;
}

const empty: StatsSummary = {
  add: 0,
  remove: 0,
  promote: 0,
  demote: 0,
  perGroup: {},
  lastSyncedAt: null,
};

/**
 * Cards "Entraram/Saíram" buscam ESTE endpoint, que faz COUNT direto no banco
 * filtrando por (workspace, instance, group_jid). Source of truth oficial.
 */
export function useGroupStatsSummary(period: StatsSummaryPeriod) {
  const { workspaceId } = useWorkspace();

  const { data = empty, isLoading } = useQuery({
    queryKey: ["group-stats-summary", workspaceId, period.start, period.end],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: workspaceId!, start: period.start, end: period.end });
      const resp = await fetch(`${apiUrl("groups/stats-summary")}?${params}`);
      if (!resp.ok) throw new Error(await resp.text());
      return (await resp.json()) as StatsSummary;
    },
  });

  return { summary: data, isLoading };
}
