import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export type EventPeriod = "today" | "yesterday" | "custom";
type GroupActionCounts = { add: number; remove: number; promote: number; demote: number };

const emptyCounts: GroupActionCounts = { add: 0, remove: 0, promote: 0, demote: 0 };

function buildParams(workspaceId: string, period: EventPeriod, customRange?: { from: Date; to: Date }) {
  const params = new URLSearchParams({ workspaceId, period });
  if (period === "custom" && customRange) {
    const fmt = (d: Date) => {
      // Envia data civil em BRT (UTC-3); o backend interpreta como YYYY-MM-DD BRT.
      const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return brt.toISOString().slice(0, 10);
    };
    params.set("from", fmt(customRange.from));
    params.set("to", fmt(customRange.to));
  }
  return params.toString();
}

/**
 * Dumb client: front apenas exibe o que o backend retorna.
 * Toda lógica de janela, filtragem, dedup e agregação vive em groups-api.ts.
 */
export function useGroupEvents() {
  const { workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<EventPeriod>("today");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();

  const queryString = workspaceId ? buildParams(workspaceId, period, customRange) : "";

  const { data: metrics = { events: [] as any[], eventCounts: emptyCounts, groupCounts: {} as Record<string, GroupActionCounts> }, isLoading } = useQuery({
    queryKey: ["group-events", workspaceId, period, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const [summaryResp, eventsResp] = await Promise.all([
        fetch(`${apiUrl("groups/events-summary")}?${queryString}`),
        fetch(`${apiUrl("groups/events")}?${queryString}`),
      ]);
      if (!summaryResp.ok) throw new Error(await summaryResp.text() || "Erro ao carregar resumo de eventos");
      if (!eventsResp.ok) throw new Error(await eventsResp.text() || "Erro ao carregar eventos de grupo");

      const summary = await summaryResp.json();
      const events = await eventsResp.json();

      return {
        events: Array.isArray(events) ? events : [],
        eventCounts: summary.eventCounts || emptyCounts,
        groupCounts: summary.groupCounts || {},
      };
    },
  });

  return {
    events: metrics.events,
    eventCounts: metrics.eventCounts,
    groupCounts: metrics.groupCounts,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    isLoading,
  };
}
